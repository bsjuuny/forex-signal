'use client';

import { useState, useEffect } from 'react';
import { fetchLiveRates, LiveRates } from '@/lib/live-rates';

export function useLiveRates(intervalMs = 60_000) {
  const [rates, setRates] = useState<LiveRates | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await fetchLiveRates();
        if (!cancelled) {
          setRates(data);
          setUpdatedAt(new Date());
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    }

    load();
    const id = setInterval(load, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [intervalMs]);

  return { rates, updatedAt, error };
}
