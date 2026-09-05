import { buildSearchRequest } from '../src/search/search-query.builder';

describe('search query builder', () => {
  it('combines keyword relevance and all filters without query-string syntax', () => {
    const result = buildSearchRequest({
      q: 'python engineer',
      skills: ['python', 'postgresql'],
      title: 'senior engineer',
      location: 'austin, united states',
      page: 2,
      pageSize: 20,
    });
    const query = result.query as {
      bool: { must: unknown[]; filter: Array<Record<string, unknown>> };
    };
    expect(result.from).toBe(20);
    expect(query.bool.must).toHaveLength(1);
    expect(query.bool.filter).toEqual([
      { term: { skills: 'python' } },
      { term: { skills: 'postgresql' } },
      {
        match_phrase_prefix: {
          jobTitle: { query: 'senior engineer' },
        },
      },
      { term: { 'location.raw': 'austin, united states' } },
    ]);
    expect(JSON.stringify(result)).not.toContain('query_string');
    expect(result.sort).toEqual([
      { _score: { order: 'desc' } },
      { 'fullName.raw': { order: 'asc' } },
      { id: { order: 'asc' } },
    ]);
    expect(result.highlight).toMatchObject({
      highlight_query: expect.any(Object),
      fields: {
        skillsText: { number_of_fragments: 0 },
        experienceText: { fragment_size: 80, number_of_fragments: 1 },
        educationText: { fragment_size: 80, number_of_fragments: 1 },
      },
    });
  });

  it('supports filter-only browsing', () => {
    const result = buildSearchRequest({
      q: '',
      skills: [],
      title: '',
      location: '',
      page: 1,
      pageSize: 10,
    });
    expect(JSON.stringify(result.query)).toContain('match_all');
    expect(result.highlight).toBeUndefined();
  });
});
