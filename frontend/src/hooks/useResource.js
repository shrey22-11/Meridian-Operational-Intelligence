import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";

// Each resource fails independently; a missing forecast cannot blank the dashboard.
export function useResource(path, revision = 0) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({
    data: null,
    error: null,
    loading: true,
  });
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    if (!path) {
      setState({ data: null, error: null, loading: false });
      return;
    }
    setState({ data: null, error: null, loading: true });
    api(path, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted)
          setState({ data, error: null, loading: false });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ data: null, error, loading: false });
      });
    return () => controller.abort();
  }, [path, revision, attempt]);
  return { ...state, retry };
}
