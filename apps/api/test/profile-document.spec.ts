import { toProfileSearchDocument } from '../src/search/profile-document.mapper';
import type { ProfileProjection } from '../src/profiles/profile.types';

describe('profile search document mapper', () => {
  it('projects only approved search fields', () => {
    const profile: ProfileProjection = {
      id: '00000000-0000-4000-8000-000000000001',
      linkedinUrl: 'https://www.linkedin.com/in/synthetic-profile',
      linkedinId: '1',
      fullName: 'Synthetic Profile',
      jobTitle: 'Search Engineer',
      companyName: 'Example Labs',
      industry: 'Software',
      location: 'Tehran, Iran',
      normalizedLocation: 'tehran, iran',
      country: 'Iran',
      summary: 'Builds search tools.',
      yearsExperience: 5,
      skills: [{ name: 'TypeScript', normalizedName: 'typescript' }],
      experience: [
        {
          jobTitle: 'Search Engineer',
          companyName: 'Example Labs',
          location: 'Tehran, Iran',
          startDate: '2021-01',
          endDate: null,
          isCurrent: true,
          description: 'Builds search tools.',
        },
      ],
      education: [
        {
          institution: 'Synthetic University',
          degree: 'BSc',
          fieldOfStudy: 'Computer Science',
          startYear: 2015,
          endYear: 2019,
        },
      ],
    };
    const document = toProfileSearchDocument(profile);
    expect(Object.keys(document).sort()).toEqual(
      [
        'companyName',
        'country',
        'educationText',
        'experienceText',
        'fullName',
        'id',
        'industry',
        'jobTitle',
        'linkedinUrl',
        'location',
        'skills',
        'skillsText',
        'summary',
        'yearsExperience',
      ].sort(),
    );
  });
});
