import type { EducationRecord, EmploymentRecord } from '../profile.types';

export interface ProfileDetailDto {
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
