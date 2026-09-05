import type { ProfileProjection } from '../profiles/profile.types';
import type { ProfileSearchDocument } from './profile-search-document';

export function toProfileSearchDocument(
  profile: ProfileProjection,
): ProfileSearchDocument {
  return {
    id: profile.id,
    fullName: profile.fullName,
    jobTitle: profile.jobTitle,
    companyName: profile.companyName,
    industry: profile.industry,
    location: profile.location,
    country: profile.country,
    summary: profile.summary,
    skills: profile.skills.map((skill) => skill.name),
    skillsText: profile.skills.map((skill) => skill.name).join(' '),
    experienceText: profile.experience
      .flatMap((record) => [
        record.jobTitle,
        record.companyName,
        record.location,
        record.description,
      ])
      .filter((value): value is string => Boolean(value))
      .join(' '),
    educationText: profile.education
      .flatMap((record) => [
        record.institution,
        record.degree,
        record.fieldOfStudy,
      ])
      .filter((value): value is string => Boolean(value))
      .join(' '),
    yearsExperience: profile.yearsExperience,
    linkedinUrl: profile.linkedinUrl,
  };
}
