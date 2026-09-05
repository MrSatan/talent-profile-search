export type ProfileMatchField =
  | 'name'
  | 'title'
  | 'skills'
  | 'company'
  | 'industry'
  | 'summary'
  | 'experience'
  | 'education';

export interface ProfileMatch {
  field: ProfileMatchField;
  excerpt: string | null;
}

export interface ProfileCard {
  id: string;
  fullName: string;
  jobTitle: string | null;
  companyName: string | null;
  location: string | null;
  country: string | null;
  yearsExperience: number | null;
  skills: string[];
  matchedSkills: string[];
  matches: ProfileMatch[];
  summaryExcerpt: string | null;
  linkedinUrl: string;
}

export interface FacetBucket {
  value: string;
  count: number;
  selected: boolean;
}

export interface ProfileSearchResponse {
  items: ProfileCard[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    tookMs: number;
  };
  facets: {
    skills: FacetBucket[];
    locations: FacetBucket[];
  };
}

export interface EmploymentRecord {
  jobTitle: string | null;
  companyName: string | null;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean | null;
  description: string | null;
}

export interface EducationRecord {
  institution: string;
  degree: string | null;
  fieldOfStudy: string | null;
  startYear: number | null;
  endYear: number | null;
}

export interface ProfileDetail {
  id: string;
  fullName: string;
  jobTitle: string | null;
  companyName: string | null;
  industry: string | null;
  location: string | null;
  country: string | null;
  summary: string | null;
  yearsExperience: number | null;
  skills: string[];
  experience: EmploymentRecord[];
  education: EducationRecord[];
  linkedinUrl: string;
}

export interface SkillSuggestionsResponse {
  items: Array<{ value: string; count: number }>;
}
