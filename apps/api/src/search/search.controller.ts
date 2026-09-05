import { Controller, Get, Inject, Query } from '@nestjs/common';
import { SearchProfilesQueryDto } from './dto/search-profiles-query.dto';
import type {
  ProfileSearchResponseDto,
  SkillSuggestionsResponseDto,
} from './dto/search-response.dto';
import { SkillSuggestionsQueryDto } from './dto/skill-suggestions-query.dto';
import { SearchService } from './search.service';

@Controller('api/v1')
export class SearchController {
  constructor(
    @Inject(SearchService) private readonly searchService: SearchService,
  ) {}

  @Get('profiles')
  search(
    @Query() query: SearchProfilesQueryDto,
  ): Promise<ProfileSearchResponseDto> {
    return this.searchService.search(query);
  }

  @Get('facets/skills')
  suggestSkills(
    @Query() query: SkillSuggestionsQueryDto,
  ): Promise<SkillSuggestionsResponseDto> {
    return this.searchService.suggestSkills(query.q, query.limit);
  }
}
