import { useCallback, useRef } from "react";

/**
 * Returns a runner that ignores calls made while a previous one is still
 * pending. A ref (not state) is used so two taps in the same frame, before React
 * re-renders a disabled button, still cannot submit twice.
 */
export function useSingleFlight() {
  const pending = useRef(false);

  return useCallback(async <T>(task: () => Promise<T>): Promise<T | undefined> => {
    if (pending.current) return undefined;
    pending.current = true;
    try {
      return await task();
    } finally {
      pending.current = false;
    }
  }, []);
}
