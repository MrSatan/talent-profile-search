import { useCallback, useEffect, useRef, useState } from 'react';
import {
  parseSearchParams,
  serializeSearchParams,
  type SearchParams,
} from './search-params';

export function useUrlSearchState(): [
  SearchParams,
  (patch: Partial<SearchParams>) => void,
] {
  const [params, setParams] = useState(() =>
    parseSearchParams(new URLSearchParams(window.location.search)),
  );
  const paramsRef = useRef(params);

  useEffect(() => {
    const onPopState = () => {
      const next = parseSearchParams(
        new URLSearchParams(window.location.search),
      );
      paramsRef.current = next;
      setParams(next);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const update = useCallback((patch: Partial<SearchParams>) => {
    const next = { ...paramsRef.current, ...patch };
    paramsRef.current = next;
    const search = serializeSearchParams(next).toString();
    const url = `${window.location.pathname}${search ? `?${search}` : ''}`;
    window.history.pushState(null, '', url);
    setParams(next);
  }, []);

  return [params, update];
}
