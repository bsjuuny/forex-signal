'use client';

import { useState, useEffect, useRef } from 'react';
import { fetchLiveRates, LiveRates } from '@/lib/live-rates';

interface BaseRates {
  offset: Record<string, number>;
  date: string;
}

async function fetchBaseRates(): Promise<BaseRates | null> {
  try {
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
    const res = await fetch(`${base}/data/base_rates.json`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function useLiveRates(intervalMs = 60_000) {
  const [rates, setRates] = useState<LiveRates | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [error, setError] = useState(false);
  const offsetRef = useRef<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    let timerId: ReturnType<typeof setInterval> | undefined;

    async function load() {
      try {
        const raw = await fetchLiveRates();
        if (cancelled) return;

        const adjusted: LiveRates = {};
        for (const [code, val] of Object.entries(raw)) {
          const off = offsetRef.current[code] ?? 0;
          adjusted[code] = Math.round((val + off) * 100) / 100;
        }
        setRates(adjusted);
        setUpdatedAt(new Date());
        setError(false);
      } catch {
        if (!cancelled) setError(true);
      }
    }

    // base_rates.json 먼저 로드 후 폴링 시작
    fetchBaseRates().then(base => {
      if (!cancelled && base?.offset) {
        offsetRef.current = base.offset;
      }
      if (!cancelled) {
        load();
        timerId = setInterval(load, intervalMs);
      }
    });

    return () => {
      cancelled = true;
      if (timerId !== undefined) clearInterval(timerId);
    };
  }, [intervalMs]);

  return { rates, updatedAt, error };
}
