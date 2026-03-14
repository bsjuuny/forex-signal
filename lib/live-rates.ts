/**
 * 실시간 환율 조회 (브라우저 클라이언트 전용)
 * API: https://api.exchangerate-api.com/v4/latest/USD
 * - 무료, API 키 불필요, ~60분 간격 갱신
 */

// USD 기준 → KRW 쌍 계산 공식
const CALC: Record<string, (r: Record<string, number>) => number> = {
  USDKRW: r => r.KRW,
  EURKRW: r => r.KRW / r.EUR,
  JPYKRW: r => (r.KRW / r.JPY) * 100,   // 100엔 기준
  CNYKRW: r => r.KRW / r.CNY,
  GBPKRW: r => r.KRW / r.GBP,
  CADKRW: r => r.KRW / r.CAD,
  HKDKRW: r => r.KRW / r.HKD,
};

export type LiveRates = Record<string, number>;

export async function fetchLiveRates(): Promise<LiveRates> {
  const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD', {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`ExchangeRate-API error ${res.status}`);
  const data = await res.json();
  const r = data.rates as Record<string, number>;

  const result: LiveRates = {};
  for (const [code, calc] of Object.entries(CALC)) {
    const val = calc(r);
    if (isFinite(val) && val > 0) {
      result[code] = Math.round(val * 100) / 100;
    }
  }
  return result;
}
