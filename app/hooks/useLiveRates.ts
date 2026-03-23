'use client';

import { useState, useEffect, useRef } from 'react';
import { fetchLiveRates, LiveRates } from '@/lib/live-rates';

const CURRENCY_MAP: Record<string, string> = {
  USDKRW: 'USD',
  EURKRW: 'EUR',
  JPYKRW: 'JPY(100)',
  CNYKRW: 'CNH',
  GBPKRW: 'GBP',
  CADKRW: 'CAD',
  HKDKRW: 'HKD',
};

function parseRate(s: string): number {
  return parseFloat((s ?? '').replace(/,/g, '')) || 0;
}

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

async function fetchOffset(liveRates: LiveRates): Promise<Record<string, number>> {
  const apiKey = process.env.NEXT_PUBLIC_KOREAEXIM_API_KEY;
  if (!apiKey) return {};

  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const today = toDateStr(now);

  try {
    const res = await fetch(
      `https://oapi.koreaexim.go.kr/site/program/financial/exchangeJSON?authkey=${apiKey}&searchdate=${today}&data=AP01`,
      { cache: 'no-store' }
    );
    if (!res.ok) return {};
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return {};

    const offset: Record<string, number> = {};
    for (const [code, curUnit] of Object.entries(CURRENCY_MAP)) {
      const row = data.find((r: { cur_unit: string }) => r.cur_unit === curUnit);
      if (!row) continue;
      const eximRate = parseRate(row.deal_bas_r);
      const liveRate = liveRates[code];
      if (eximRate > 0 && liveRate && liveRate > 0) {
        offset[code] = eximRate - liveRate;
      }
    }
    return offset;
  } catch {
    return {};
  }
}

export function useLiveRates(intervalMs = 60_000) {
  const [rates, setRates] = useState<LiveRates | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [error, setError] = useState(false);
  const offsetRef = useRef<Record<string, number>>({});
  const offsetLoadedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timerId: ReturnType<typeof setInterval> | undefined;

    async function load(isFirst = false) {
      try {
        const raw = await fetchLiveRates();
        if (cancelled) return;

        // 첫 호출 시 Koreaexim으로 offset 계산
        if (isFirst && !offsetLoadedRef.current) {
          offsetLoadedRef.current = true;
          fetchOffset(raw).then(off => {
            offsetRef.current = off;
          });
        }

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

    load(true);
    timerId = setInterval(() => load(false), intervalMs);

    return () => {
      cancelled = true;
      if (timerId !== undefined) clearInterval(timerId);
    };
  }, [intervalMs]);

  return { rates, updatedAt, error };
}
