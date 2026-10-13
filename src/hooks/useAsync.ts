import { useCallback, useEffect, useRef, useState } from "react";

import { classifyError } from "../services/api/errors";
import { getApiErrorMessage } from "./useFarmerAddresses";

type Settled<T> = {
  key: string;
  depsKey: string;
  data: T | null;
  error: string | null;
};

/**
 * Loads data on mount / when deps change, ignoring stale responses. While a
 * new load is pending the previous data (if any) stays available, and when a
 * reload of the same data fails the last good data is kept alongside `error`
 * so screens can show a "could not refresh" notice instead of wiping the list.
 * `reload` is ignored while a load is already running (no duplicate requests).
 */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[]) {
  const [version, setVersion] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const loadRef = useRef(load);
  const pendingRef = useRef(false);

  useEffect(() => {
    loadRef.current = load;
  });

  const depsKey = deps.map(String).join("|");
  const key = `${version}:${depsKey}`;

  useEffect(() => {
    let cancelled = false;
    pendingRef.current = true;

    // `Promise.resolve().then` also turns a synchronous throw into a rejection,
    // so the loading state can never get stuck.
    Promise.resolve()
      .then(() => loadRef.current())
      .then(
        (data) => {
          if (cancelled) return;
          pendingRef.current = false;
          setSettled({ key, depsKey, data, error: null });
        },
        (error: unknown) => {
          if (cancelled) return;
          pendingRef.current = false;
          if (classifyError(error) !== "cancelled") {
            console.error("Request failed:", error);
          }
          setSettled((previous) => ({
            key,
            depsKey,
            // Only keep old data when reloading the same query; data for other
            // deps (another category, search term, ...) would be misleading.
            data: previous?.depsKey === depsKey ? previous.data : null,
            error: getApiErrorMessage(error),
          }));
        },
      );

    return () => {
      cancelled = true;
      pendingRef.current = false;
    };
  }, [key, depsKey]);

  const reload = useCallback(async () => {
    if (pendingRef.current) return;
    setVersion((v) => v + 1);
  }, []);

  return {
    data: settled?.data ?? null,
    isLoading: settled?.key !== key,
    error: settled?.key === key ? settled.error : null,
    reload,
  };
}
