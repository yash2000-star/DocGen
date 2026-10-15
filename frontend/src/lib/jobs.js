import { useEffect, useRef, useState } from "react";

// Helpers for following a background generation job (see backend/jobs/).

export const ACTIVE_JOB_STATUSES = ["queued", "running"];

export function isActiveJob(job) {
  return Boolean(job && ACTIVE_JOB_STATUSES.includes(job.status));
}

/**
 * Polls a job until it finishes. `load` fetches the job (or throws) and returns it.
 * Returns { job, error }.
 */
export function useJobPolling(jobId, load, intervalMs = 2000) {
  const [state, setState] = useState({ job: null, error: null });
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    if (!jobId) return;
    let stopped = false;
    let timer = null;

    const tick = async () => {
      try {
        const job = await loadRef.current(jobId);
        if (stopped) return;
        setState({ job, error: null });
        if (!isActiveJob(job)) return; // Finished: stop polling.
      } catch (error) {
        if (stopped) return;
        setState((s) => ({ ...s, error }));
      }
      timer = setTimeout(tick, intervalMs);
    };
    tick();

    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [jobId, intervalMs]);

  return state;
}
