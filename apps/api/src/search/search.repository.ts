import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Client } from '@elastic/elasticsearch';
import {
  normalizeKey,
  sanitizeProfessionalText,
} from '../ingestion/normalizer';
import type {
  FacetBucketDto,
  ProfileCardDto,
  ProfileMatchFieldDto,
  SkillSuggestionsResponseDto,
} from './dto/search-response.dto';
import type { ProfileSearchDocument } from './profile-search-document';
import {
  HIGHLIGHT_POST_TAG,
  HIGHLIGHT_PRE_TAG,
  type SearchRequestBody,
} from './search-query.builder';
import { SearchUnavailableException } from './search-unavailable.exception';
import { ELASTICSEARCH_CLIENT } from './search.tokens';

interface RawSearchResponse {
  took?: number;
  hits?: {
    total?: number | { value?: number };
    hits?: Array<{ _source?: unknown; highlight?: unknown }>;
  };
  aggregations?: Record<string, unknown>;
}

@Injectable()
export class SearchRepository {
  private readonly alias: string;

  constructor(
    @Inject(ELASTICSEARCH_CLIENT) private readonly client: Client,
    @Inject(ConfigService) config: ConfigService,
  ) {
    this.alias = config.getOrThrow<string>('ELASTICSEARCH_INDEX_ALIAS');
  }

  async search(
    body: SearchRequestBody,
    selectedSkills: string[],
    selectedLocation: string,
  ): Promise<{
    items: ProfileCardDto[];
    total: number;
    tookMs: number;
    skills: FacetBucketDto[];
    locations: FacetBucketDto[];
  }> {
    try {
      const response = (await this.client.search({
        index: this.alias,
        ...body,
      } as never)) as unknown as RawSearchResponse;
      const selected = new Set(selectedSkills);
      return {
        items: (response.hits?.hits ?? [])
          .map((hit) => toCard(hit._source, hit.highlight))
          .filter((card): card is ProfileCardDto => card !== null),
        total: totalHits(response.hits?.total),
        tookMs: response.took ?? 0,
        skills: aggregationBuckets(response.aggregations?.skills).map(
          (bucket) => ({ ...bucket, selected: selected.has(bucket.value) }),
        ),
        locations: aggregationBuckets(response.aggregations?.locations).map(
          (bucket) => ({
            ...bucket,
            selected: bucket.value === selectedLocation,
          }),
        ),
      };
    } catch {
      throw new SearchUnavailableException();
    }
  }

  async suggestSkills(
    q: string,
    limit: number,
  ): Promise<SkillSuggestionsResponseDto> {
    try {
      const normalized = normalizeKey(q);
      const include = normalized ? `${escapeRegex(normalized)}.*` : undefined;
      const response = (await this.client.search({
        index: this.alias,
        size: 0,
        track_total_hits: false,
        query: { match_all: {} },
        aggs: {
          skills: {
            terms: {
              field: 'skills',
              size: limit,
              ...(include ? { include } : {}),
              order: [{ _count: 'desc' }, { _key: 'asc' }],
            },
          },
        },
      } as never)) as unknown as RawSearchResponse;
      return {
        items: aggregationBuckets(response.aggregations?.skills).map(
          ({ value, count }) => ({ value, count }),
        ),
      };
    } catch {
      throw new SearchUnavailableException();
    }
  }

  async checkReady(): Promise<void> {
    try {
      const [reachable, aliasExists] = await Promise.all([
        this.client.ping(),
        this.client.indices.existsAlias({ name: this.alias }),
      ]);
      if (!reachable || !aliasExists) {
        throw new Error('Search alias is unavailable');
      }
      await this.client.search({ index: this.alias, size: 0 });
    } catch {
      throw new SearchUnavailableException();
    }
  }
}

const MATCH_FIELD_BY_HIGHLIGHT = [
  ['fullName', 'name'],
  ['jobTitle', 'title'],
  ['skillsText', 'skills'],
  ['companyName', 'company'],
  ['industry', 'industry'],
  ['summary', 'summary'],
  ['experienceText', 'experience'],
  ['educationText', 'education'],
] as const satisfies ReadonlyArray<readonly [string, ProfileMatchFieldDto]>;

function toCard(source: unknown, rawHighlight: unknown): ProfileCardDto | null {
  if (!source || typeof source !== 'object') {
    return null;
  }
  const document = source as Partial<ProfileSearchDocument>;
  if (
    typeof document.id !== 'string' ||
    typeof document.fullName !== 'string' ||
    typeof document.linkedinUrl !== 'string' ||
    !Array.isArray(document.skills)
  ) {
    return null;
  }
  const summary =
    typeof document.summary === 'string' ? document.summary : null;
  const skills = document.skills.filter(
    (skill): skill is string => typeof skill === 'string',
  );
  const highlight = toHighlightRecord(rawHighlight);
  const highlightedSkillTerms = extractHighlightedTerms(
    highlight.skillsText ?? [],
  );
  const matchedSkills = skills.filter((skill) =>
    skillMatchesTerms(skill, highlightedSkillTerms),
  );
  const matchedSkillSet = new Set(matchedSkills);
  const visibleSkills = [
    ...matchedSkills,
    ...skills.filter((skill) => !matchedSkillSet.has(skill)),
  ];
  return {
    id: document.id,
    fullName: document.fullName,
    jobTitle: nullableString(document.jobTitle),
    companyName: nullableString(document.companyName),
    location: nullableString(document.location),
    country: nullableString(document.country),
    yearsExperience:
      typeof document.yearsExperience === 'number'
        ? document.yearsExperience
        : null,
    skills: visibleSkills,
    matchedSkills,
    matches: MATCH_FIELD_BY_HIGHLIGHT.flatMap(([field, matchField]) => {
      const fragments = highlight[field];
      if (!hasMarkedHighlight(fragments)) {
        return [];
      }
      return [
        {
          field: matchField,
          excerpt: matchExcerpt(matchField, fragments),
        },
      ];
    }),
    summaryExcerpt: summary ? [...summary].slice(0, 240).join('').trim() : null,
    linkedinUrl: document.linkedinUrl,
  };
}

const EXCERPT_FIELDS = new Set<ProfileMatchFieldDto>([
  'industry',
  'summary',
  'experience',
  'education',
]);

function matchExcerpt(
  field: ProfileMatchFieldDto,
  fragments: string[] | undefined,
): string | null {
  if (!EXCERPT_FIELDS.has(field) || !fragments?.[0]) {
    return null;
  }
  const plainText = fragments[0]
    .replaceAll(HIGHLIGHT_PRE_TAG, '')
    .replaceAll(HIGHLIGHT_POST_TAG, '');
  return sanitizeProfessionalText(plainText, 180);
}

function toHighlightRecord(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== 'object') {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).flatMap(([field, fragments]) => {
      if (!Array.isArray(fragments)) {
        return [];
      }
      const strings = fragments.filter(
        (fragment): fragment is string => typeof fragment === 'string',
      );
      return strings.length > 0 ? [[field, strings]] : [];
    }),
  );
}

function hasMarkedHighlight(fragments: string[] | undefined): boolean {
  return (
    fragments?.some((fragment) => fragment.includes(HIGHLIGHT_PRE_TAG)) ?? false
  );
}

function extractHighlightedTerms(fragments: string[]): Set<string> {
  const terms = new Set<string>();
  for (const fragment of fragments) {
    let cursor = 0;
    while (cursor < fragment.length) {
      const start = fragment.indexOf(HIGHLIGHT_PRE_TAG, cursor);
      if (start < 0) {
        break;
      }
      const valueStart = start + HIGHLIGHT_PRE_TAG.length;
      const end = fragment.indexOf(HIGHLIGHT_POST_TAG, valueStart);
      if (end < 0) {
        break;
      }
      const term = normalizeKey(fragment.slice(valueStart, end));
      if (term) {
        terms.add(term);
      }
      cursor = end + HIGHLIGHT_POST_TAG.length;
    }
  }
  return terms;
}

function skillMatchesTerms(skill: string, terms: Set<string>): boolean {
  const normalizedSkill = normalizeKey(skill);
  return [...terms].some((term) =>
    normalizedSkill.split(/\s+/u).includes(term),
  );
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function totalHits(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }
  if (value && typeof value === 'object' && 'value' in value) {
    const total = (value as { value?: unknown }).value;
    return typeof total === 'number' ? total : 0;
  }
  return 0;
}

function aggregationBuckets(
  value: unknown,
): Array<{ value: string; count: number }> {
  if (!value || typeof value !== 'object' || !('buckets' in value)) {
    return [];
  }
  const buckets = (value as { buckets?: unknown }).buckets;
  if (!Array.isArray(buckets)) {
    return [];
  }
  return buckets.flatMap((bucket) => {
    if (!bucket || typeof bucket !== 'object') {
      return [];
    }
    const candidate = bucket as { key?: unknown; doc_count?: unknown };
    return typeof candidate.key === 'string' &&
      typeof candidate.doc_count === 'number'
      ? [{ value: candidate.key, count: candidate.doc_count }]
      : [];
  });
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
