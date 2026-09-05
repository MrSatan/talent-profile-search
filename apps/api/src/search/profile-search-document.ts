export interface ProfileSearchDocument {
  id: string;
  fullName: string;
  jobTitle: string | null;
  companyName: string | null;
  industry: string | null;
  location: string | null;
  country: string | null;
  summary: string | null;
  skills: string[];
  skillsText: string;
  experienceText: string;
  educationText: string;
  yearsExperience: number | null;
  linkedinUrl: string;
}
