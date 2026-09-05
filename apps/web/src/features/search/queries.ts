import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getProfiles, getSkillSuggestions } from '../../api/client';
import type { SearchParams } from './search-params';
import { toApiSearchParams } from './search-params';

export function useProfileSearch(params: SearchParams) {
  return useQuery({
    queryKey: [
      'profiles',
      params.q,
      params.skills,
      params.title,
      params.location,
      params.page,
      params.pageSize,
    ],
    queryFn: ({ signal }) => getProfiles(toApiSearchParams(params), signal),
    placeholderData: keepPreviousData,
    retry: 1,
  });
}

export function useSkillSuggestions(q: string, enabled: boolean) {
  return useQuery({
    queryKey: ['skill-suggestions', q],
    queryFn: ({ signal }) => getSkillSuggestions(q, signal),
    enabled,
    staleTime: 30_000,
    retry: 1,
  });
}
