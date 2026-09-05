export const profileIndexDefinition = {
  settings: {
    number_of_shards: 1,
    number_of_replicas: 0,
    analysis: {
      analyzer: {
        profile_text: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase', 'asciifolding'],
        },
      },
      normalizer: {
        profile_keyword: {
          type: 'custom',
          filter: ['lowercase', 'asciifolding'],
        },
      },
    },
  },
  mappings: {
    dynamic: 'strict',
    properties: {
      id: { type: 'keyword' },
      fullName: textWithRaw(),
      jobTitle: textWithRaw(),
      companyName: textWithRaw(),
      industry: textWithRaw(),
      location: textWithRaw(),
      country: { type: 'keyword', normalizer: 'profile_keyword' },
      summary: { type: 'text', analyzer: 'profile_text' },
      skills: { type: 'keyword', normalizer: 'profile_keyword' },
      skillsText: { type: 'text', analyzer: 'profile_text' },
      experienceText: { type: 'text', analyzer: 'profile_text' },
      educationText: { type: 'text', analyzer: 'profile_text' },
      yearsExperience: { type: 'float' },
      linkedinUrl: { type: 'keyword', index: false },
    },
  },
} as const;

function textWithRaw() {
  return {
    type: 'text',
    analyzer: 'profile_text',
    fields: {
      raw: { type: 'keyword', normalizer: 'profile_keyword' },
    },
  } as const;
}
