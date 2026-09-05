import type {
  ProfileDetail,
  ProfileSearchResponse,
  SkillSuggestionsResponse,
} from './contracts';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function getProfiles(
  search: URLSearchParams,
  signal: AbortSignal,
): Promise<ProfileSearchResponse> {
  const response = await request(
    `/api/v1/profiles?${search.toString()}`,
    signal,
  );
  if (!isProfileSearchResponse(response)) {
    throw new ApiError(
      502,
      'INVALID_RESPONSE',
      'The search response was invalid.',
    );
  }
  return response;
}

export async function getProfile(
  id: string,
  signal: AbortSignal,
): Promise<ProfileDetail> {
  const response = await request(
    `/api/v1/profiles/${encodeURIComponent(id)}`,
    signal,
  );
  if (!isProfileDetail(response)) {
    throw new ApiError(
      502,
      'INVALID_RESPONSE',
      'The profile response was invalid.',
    );
  }
  return response;
}

export async function getSkillSuggestions(
  q: string,
  signal: AbortSignal,
): Promise<SkillSuggestionsResponse> {
  const search = new URLSearchParams({ q, limit: '20' });
  const response = await request(
    `/api/v1/facets/skills?${search.toString()}`,
    signal,
  );
  if (!isSkillSuggestionsResponse(response)) {
    throw new ApiError(
      502,
      'INVALID_RESPONSE',
      'Skill suggestions were invalid.',
    );
  }
  return response;
}

async function request(path: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(path, {
    signal,
    headers: { Accept: 'application/json' },
  });
  const body = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const safe = isApiError(body)
      ? body
      : {
          code: 'REQUEST_FAILED',
          message: 'The request could not be completed.',
        };
    throw new ApiError(response.status, safe.code, safe.message);
  }
  return body;
}

function isApiError(
  value: unknown,
): value is { code: string; message: string } {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    typeof (value as { code?: unknown }).code === 'string' &&
    typeof (value as { message?: unknown }).message === 'string'
  );
}

function isProfileSearchResponse(
  value: unknown,
): value is ProfileSearchResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<ProfileSearchResponse>;
  return (
    Array.isArray(candidate.items) &&
    Boolean(candidate.meta) &&
    typeof candidate.meta?.total === 'number' &&
    typeof candidate.meta?.page === 'number' &&
    typeof candidate.meta?.totalPages === 'number' &&
    Boolean(candidate.facets) &&
    Array.isArray(candidate.facets?.skills) &&
    Array.isArray(candidate.facets?.locations)
  );
}

function isSkillSuggestionsResponse(
  value: unknown,
): value is SkillSuggestionsResponse {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    Array.isArray((value as Partial<SkillSuggestionsResponse>).items)
  );
}

function isProfileDetail(value: unknown): value is ProfileDetail {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<ProfileDetail>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.fullName === 'string' &&
    typeof candidate.linkedinUrl === 'string' &&
    Array.isArray(candidate.skills) &&
    Array.isArray(candidate.experience) &&
    Array.isArray(candidate.education)
  );
}
