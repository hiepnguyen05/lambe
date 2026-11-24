import { useEffect, useState } from 'react';

/**
 * Debounce hook that delays updating the returned value until delayMs
 * has elapsed since the last change. Essential for search inputs to prevent
 * network request thrashing and unnecessary re-renders on every keystroke.
 */
export function useDebounce<T>(value: T, delayMs: number = 350): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);

  return debouncedValue;
}

