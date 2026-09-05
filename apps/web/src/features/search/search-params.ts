export interface SearchParams {
  q: string;
  skills: string[];
  title: string;
  location: string;
  page: number;
  pageSize: number;
}

export const DEFAULT_SEARCH_PARAMS: SearchParams = {
  q: '',
  skills: [],
  title: '',
  location: '',
  page: 1,
  pageSize: 20,
};

export function parseSearchParams(input: URLSearchParams): SearchParams {
  return {
    q: bounded(input.get('q'), 100),
    skills: [
      ...new Set(
        input
          .getAll('skills')
          .map((value) => bounded(value, 100))
          .filter(Boolean),
      ),
    ].slice(0, 10),
    title: bounded(input.get('title'), 100),
    location: bounded(input.get('location'), 100),
    page: boundedInteger(input.get('page'), 1, Number.MAX_SAFE_INTEGER, 1),
    pageSize: boundedInteger(input.get('pageSize'), 1, 50, 20),
  };
}

export function serializeSearchParams(params: SearchParams): URLSearchParams {
  const result = new URLSearchParams();
  if (params.q) result.set('q', params.q);
  for (const skill of params.skills) result.append('skills', skill);
  if (params.title) result.set('title', params.title);
  if (params.location) result.set('location', params.location);
  if (params.page > 1) result.set('page', String(params.page));
  if (params.pageSize !== 20) result.set('pageSize', String(params.pageSize));
  return result;
}

export function toApiSearchParams(params: SearchParams): URLSearchParams {
  const result = serializeSearchParams(params);
  result.set('page', String(params.page));
  result.set('pageSize', String(params.pageSize));
  return result;
}

export function hasActiveSearch(params: SearchParams): boolean {
  return Boolean(
    params.q || params.skills.length || params.title || params.location,
  );
}

function bounded(value: string | null, max: number): string {
  return value?.trim().slice(0, max) ?? '';
}

function boundedInteger(
  value: string | null,
  min: number,
  max: number,
  fallback: number,
): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max
    ? parsed
    : fallback;
}
