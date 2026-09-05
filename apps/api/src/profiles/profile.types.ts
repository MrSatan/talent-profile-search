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

export interface CanonicalSkill {
  name: string;
  normalizedName: string;
}

export interface CanonicalProfile {
  linkedinUrl: string;
  linkedinId: string | null;
  fullName: string;
  jobTitle: string | null;
  companyName: string | null;
  industry: string | null;
  location: string | null;
  normalizedLocation: string | null;
  country: string | null;
  summary: string | null;
  yearsExperience: number | null;
  experience: EmploymentRecord[];
  education: EducationRecord[];
  skills: CanonicalSkill[];
}

export interface ProfileProjection extends CanonicalProfile {
  id: string;
}
