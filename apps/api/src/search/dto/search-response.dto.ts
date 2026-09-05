export type ProfileMatchFieldDto =
  | 'name'
  | 'title'
  | 'skills'
  | 'company'
  | 'industry'
  | 'summary'
  | 'experience'
  | 'education';

export interface ProfileMatchDto {
  field: ProfileMatchFieldDto;
  excerpt: string | null;
}

export interface ProfileCardDto {
  id: string;
  fullName: string;
  jobTitle: string | null;
  companyName: string | null;
  location: string | null;
  country: string | null;
  yearsExperience: number | null;
  skills: string[];
  matchedSkills: string[];
  matches: ProfileMatchDto[];
  summaryExcerpt: string | null;
  linkedinUrl: string;
}

export interface FacetBucketDto {
  value: string;
  count: number;
  selected: boolean;
}

export interface ProfileSearchResponseDto {
  items: ProfileCardDto[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    tookMs: number;
  };
  facets: {
    skills: FacetBucketDto[];
    locations: FacetBucketDto[];
  };
}

export interface SkillSuggestionsResponseDto {
  items: Array<{ value: string; count: number }>;
}
