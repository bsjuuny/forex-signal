'use client';

import { useState, useEffect } from 'react';
import { LiveRates } from '@/lib/live-rates';

export function useLiveRates(intervalMs = 5 * 60_000) {
  const [rates, setRates] = useState<LiveRates | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timerId: ReturnType<typeof setInterval> | undefined;

    async function load() {
      try {
        const base = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
        const res = await fetch(`${base}/data/base_rates.json`, { cache: 'no-store' });
        if (!res.ok) throw new Error('base_rates fetch failed');
        const data = await res.json();

        if (!cancelled && data?.liveSnapshot && Object.keys(data.liveSnapshot).length > 0) {
          setRates(data.liveSnapshot);
          setUpdatedAt(new Date(data.snapshotAt ?? data.fetchedAt));
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    }

    load();
    timerId = setInterval(load, intervalMs);
    return () => { cancelled = true; clearInterval(timerId); };
  }, [intervalMs]);

  return { rates, updatedAt, error };
}
