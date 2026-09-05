import { useCallback, useEffect, useRef, useState } from 'react';

export function useDebouncedText(
  committedValue: string,
  onCommit: (value: string) => void,
  delay = 320,
) {
  const [draftState, setDraftState] = useState({
    source: committedValue,
    value: committedValue,
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draft =
    draftState.source === committedValue ? draftState.value : committedValue;

  const clearTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => {
    clearTimer();
  }, [clearTimer, committedValue]);

  useEffect(() => clearTimer, [clearTimer]);

  const change = useCallback(
    (value: string) => {
      setDraftState({ source: committedValue, value });
      clearTimer();
      timer.current = setTimeout(() => onCommit(value.trim()), delay);
    },
    [clearTimer, committedValue, delay, onCommit],
  );

  const commitNow = useCallback(() => {
    clearTimer();
    onCommit(draft.trim());
  }, [clearTimer, draft, onCommit]);

  return { draft, change, commitNow };
}
