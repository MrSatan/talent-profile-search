import { Inject, Injectable } from '@nestjs/common';
import { normalizeKey } from '../ingestion/normalizer';
import type { SearchProfilesQueryDto } from './dto/search-profiles-query.dto';
import type {
  ProfileSearchResponseDto,
  SkillSuggestionsResponseDto,
} from './dto/search-response.dto';
import { buildSearchRequest } from './search-query.builder';
import { SearchRepository } from './search.repository';

@Injectable()
export class SearchService {
  constructor(
    @Inject(SearchRepository)
    private readonly searchRepository: SearchRepository,
  ) {}

  async search(
    query: SearchProfilesQueryDto,
  ): Promise<ProfileSearchResponseDto> {
    const normalized = {
      q: query.q?.trim() ?? '',
      skills: [...new Set((query.skills ?? []).map(normalizeKey))].filter(
        Boolean,
      ),
      title: query.title?.trim() ?? '',
      location: query.location ? normalizeKey(query.location) : '',
      page: query.page,
      pageSize: query.pageSize,
    };
    const result = await this.searchRepository.search(
      buildSearchRequest(normalized),
      normalized.skills,
      normalized.location,
    );
    return {
      items: result.items,
      meta: {
        page: normalized.page,
        pageSize: normalized.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / normalized.pageSize),
        tookMs: result.tookMs,
      },
      facets: {
        skills: result.skills,
        locations: result.locations,
      },
    };
  }

  suggestSkills(
    q: string,
    limit: number,
  ): Promise<SkillSuggestionsResponseDto> {
    return this.searchRepository.suggestSkills(q, limit);
  }
}
