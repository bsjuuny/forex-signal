/**
 * 거시 지표 수집 모듈
 * VIX (공포지수), 미국채 10년물 금리
 * Yahoo Finance 비공식 v8 API 사용 (API 키 불필요)
 */

export interface MacroData {
  vix: number;       // 현재 VIX
  vixPrev: number;   // ~5일 전 VIX (추세 판단용)
  us10y: number;     // 미국채 10년물 금리 (%)
  us10yPrev: number; // ~5일 전 금리
  fetchedAt: string;
}

async function fetchYahooCloses(symbol: string, rangeDays = 10): Promise<number[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${rangeDays}d`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FXSignal/1.0)' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Yahoo Finance ${res.status} (${symbol})`);
  const json = await res.json();
  const closes: (number | null)[] = json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
  return closes.filter((v): v is number => v !== null);
}

export async function fetchMacroData(): Promise<MacroData | null> {
  try {
    const [vixData, us10yData] = await Promise.all([
      fetchYahooCloses('^VIX', 10),
      fetchYahooCloses('^TNX', 10),
    ]);

    if (vixData.length < 2 || us10yData.length < 2) {
      console.warn('[macro-api] 거시 데이터 부족 — 건너뜀');
      return null;
    }

    return {
      vix: vixData[vixData.length - 1],
      vixPrev: vixData[0],
      us10y: us10yData[us10yData.length - 1],
      us10yPrev: us10yData[0],
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[macro-api] 거시 지표 수집 실패:', err instanceof Error ? err.message : err);
    return null;
  }
}
