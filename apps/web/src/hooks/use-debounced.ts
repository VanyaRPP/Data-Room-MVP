import { useEffect, useState } from "react";

/**
 * Trails `value` by `delay`, so a query fires once the typing pauses rather
 * than once per keystroke.
 */
export function useDebounced<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return settled;
}
