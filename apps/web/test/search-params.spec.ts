import {
  parseSearchParams,
  serializeSearchParams,
  toApiSearchParams,
} from '../src/features/search/search-params';

describe('search URL state', () => {
  it('reads repeated skills and ignores unknown parameters', () => {
    const result = parseSearchParams(
      new URLSearchParams(
        'q=engineer&skills=typescript&skills=postgresql&title=senior&location=austin&page=2&unknown=value',
      ),
    );
    expect(result).toEqual({
      q: 'engineer',
      skills: ['typescript', 'postgresql'],
      title: 'senior',
      location: 'austin',
      page: 2,
      pageSize: 20,
    });
    expect(serializeSearchParams(result).has('unknown')).toBe(false);
    expect(toApiSearchParams(result).getAll('skills')).toEqual([
      'typescript',
      'postgresql',
    ]);
  });

  it('bounds invalid pagination values', () => {
    const result = parseSearchParams(
      new URLSearchParams('page=-1&pageSize=500'),
    );
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });
});
