export interface NormalizedSearchRequest {
  q: string;
  skills: string[];
  title: string;
  location: string;
  page: number;
  pageSize: number;
}

export interface SearchRequestBody {
  from: number;
  size: number;
  track_total_hits: true;
  query: Record<string, unknown>;
  sort: Array<Record<string, unknown>>;
  _source: string[];
  aggs: Record<string, unknown>;
  highlight?: Record<string, unknown>;
}

export const HIGHLIGHT_PRE_TAG = '__profile_match_start__';
export const HIGHLIGHT_POST_TAG = '__profile_match_end__';

const SEARCH_FIELDS = [
  'fullName^6',
  'jobTitle^5',
  'skillsText^4',
  'companyName^3',
  'industry^2',
  'summary',
  'experienceText',
  'educationText',
];

export function buildSearchRequest(
  request: NormalizedSearchRequest,
): SearchRequestBody {
  const filters: Array<Record<string, unknown>> = request.skills.map(
    (skill) => ({
      term: { skills: skill },
    }),
  );
  if (request.title) {
    filters.push({
      match_phrase_prefix: { jobTitle: { query: request.title } },
    });
  }
  if (request.location) {
    filters.push({ term: { 'location.raw': request.location } });
  }

  const relevanceQuery = request.q
    ? {
        bool: {
          should: [
            {
              multi_match: {
                query: request.q,
                fields: SEARCH_FIELDS,
                type: 'cross_fields',
                operator: 'and',
              },
            },
            {
              multi_match: {
                query: request.q,
                fields: ['fullName^6', 'jobTitle^5'],
                type: 'phrase',
                boost: 3,
              },
            },
            {
              multi_match: {
                query: request.q,
                fields: SEARCH_FIELDS,
                type: 'best_fields',
                fuzziness: 'AUTO',
                prefix_length: 1,
                boost: 0.35,
              },
            },
          ],
          minimum_should_match: 1,
        },
      }
    : { match_all: {} };

  return {
    from: (request.page - 1) * request.pageSize,
    size: request.pageSize,
    track_total_hits: true,
    query: {
      bool: {
        must: [relevanceQuery],
        filter: filters,
      },
    },
    sort: [
      { _score: { order: 'desc' } },
      { 'fullName.raw': { order: 'asc' } },
      { id: { order: 'asc' } },
    ],
    _source: [
      'id',
      'fullName',
      'jobTitle',
      'companyName',
      'location',
      'country',
      'yearsExperience',
      'skills',
      'summary',
      'linkedinUrl',
    ],
    ...(request.q
      ? {
          highlight: {
            pre_tags: [HIGHLIGHT_PRE_TAG],
            post_tags: [HIGHLIGHT_POST_TAG],
            highlight_query: relevanceQuery,
            fields: {
              fullName: { number_of_fragments: 0 },
              jobTitle: { number_of_fragments: 0 },
              skillsText: { number_of_fragments: 0 },
              companyName: { number_of_fragments: 0 },
              industry: { number_of_fragments: 0 },
              summary: { fragment_size: 80, number_of_fragments: 1 },
              experienceText: { fragment_size: 80, number_of_fragments: 1 },
              educationText: { fragment_size: 80, number_of_fragments: 1 },
            },
          },
        }
      : {}),
    aggs: {
      skills: { terms: { field: 'skills', size: 50 } },
      locations: { terms: { field: 'location.raw', size: 30 } },
    },
  };
}
