/**
 * 한국수출입은행 환율 API
 * https://www.koreaexim.go.kr/ir/HPHKIR020M01?apino=2
 *
 * 환경변수:
 *   KOREAEXIM_API_KEY - 무료 API 키 (위 URL에서 신청)
 *
 * 특징:
 *   - 완전 무료, 매 영업일 11시 이후 갱신
 *   - 매매기준율 / 전신환 매입(ttb) / 전신환 매도(tts) 제공
 *   - 1회 호출 = 1일치 데이터 (날짜별 호출 필요)
 */

const BASE_URL = 'https://oapi.koreaexim.go.kr/site/program/financial/exchangeJSON';

// KOREAEXIM cur_unit 매핑
const CURRENCY_MAP: Record<string, string> = {
  USDKRW: 'USD',
  EURKRW: 'EUR',
  JPYKRW: 'JPY(100)',
  CNYKRW: 'CNH', // 역외 위안화 (offshore yuan)
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

function isWeekday(date: Date): boolean {
  const d = date.getDay();
  return d !== 0 && d !== 6;
}

/** YYYYMMDD → Date 변환 */
function parseDate(s: string): Date {
  return new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`);
}

interface RawRate {
  result: number;
  cur_unit: string;
  ttb: string;   // 전신환 매입률 (낮은 값)
  tts: string;   // 전신환 매도률 (높은 값)
  deal_bas_r: string; // 매매기준율 (종가로 사용)
}

/**
 * 특정 날짜의 전체 환율 조회
 * AP01: 기준환율 (USD, EUR, JPY, GBP, CAD, HKD 등 직거래 통화)
 * AP02: 재정환율 (CNY 등 직거래 없는 통화 - USD 환율 경유 계산)
 */
async function fetchRatesForDate(date: string, dataType = 'AP01'): Promise<RawRate[]> {
  const url = `${BASE_URL}?authkey=${process.env.KOREAEXIM_API_KEY}&searchdate=${date}&data=${dataType}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`KOREAEXIM 오류 ${res.status} (${date})`);
  const data = await res.json();
  return Array.isArray(data) ? data.filter((r: RawRate) => r.result === 1) : [];
}


export interface OHLCCandle {
  date: string;   // YYYYMMDD
  open: number;
  high: number;
  low: number;
  close: number;
}

/**
 * 지정 기간의 환율 일봉 데이터 조회
 * - 이미 가진 데이터(existing)를 넘기면 누락 날짜만 API 호출 (효율적)
 */
export async function getExchangeRateHistory(
  currencyCode: string,
  startDate: string,
  endDate: string,
  existing: OHLCCandle[] = [],
): Promise<OHLCCandle[]> {
  const curUnit = CURRENCY_MAP[currencyCode];
  if (!curUnit) throw new Error(`지원하지 않는 통화: ${currencyCode}`);

  // 이미 보유한 날짜 집합
  const existingDates = new Set(existing.map(c => c.date));

  // 조회 대상 날짜 목록 (영업일만)
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const missingDates: string[] = [];

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const ds = toDateStr(new Date(d));
    if (isWeekday(d) && !existingDates.has(ds)) {
      missingDates.push(ds);
    }
  }

  if (missingDates.length === 0) return existing;

  console.log(`    [KOREAEXIM] ${currencyCode} 누락 ${missingDates.length}일 수집 중...`);

  const newCandles: OHLCCandle[] = [];
  let prevClose = existing.length > 0 ? existing[existing.length - 1].close : 0;

  for (const date of missingDates) {
    try {
      const rates = await fetchRatesForDate(date);
      const rate = rates.find(r => r.cur_unit === curUnit);

      if (rate) {
        const close = parseRate(rate.deal_bas_r);
        const high  = parseRate(rate.tts);
        const low   = parseRate(rate.ttb);
        const open  = prevClose > 0 ? prevClose : close;

        if (close > 0) {
          newCandles.push({ date, open, high, low, close });
          prevClose = close;
        }
      }
      // API 레이트 리밋 방지
      await new Promise(r => setTimeout(r, 150));
    } catch {
      // 해당 날짜 건너뜀 (공휴일 등)
    }
  }

  // 기존 + 신규 병합 후 날짜 정렬
  const merged = [...existing, ...newCandles]
    .sort((a, b) => a.date.localeCompare(b.date));

  // 90일 초과 데이터는 제거
  return merged.slice(-90);
}

export interface ExchangeRateData {
  currency: string;
  rate: number;
  high: number;
  low: number;
  timestamp: string;
}

/** 오늘 환율 조회 */
export async function getTodayRate(currencyCode: string): Promise<ExchangeRateData | null> {
  const curUnit = CURRENCY_MAP[currencyCode];
  if (!curUnit) return null;

  const today = toDateStr(new Date());
  const rates = await fetchRatesForDate(today);
  const rate = rates.find(r => r.cur_unit === curUnit);
  if (!rate) return null;

  return {
    currency: currencyCode,
    rate: parseRate(rate.deal_bas_r),
    high: parseRate(rate.tts),
    low: parseRate(rate.ttb),
    timestamp: new Date().toISOString(),
  };
}

/** 지원 통화 목록 */
export const SUPPORTED_CURRENCIES = [
  { code: 'USDKRW', label: 'USD/KRW', flag: '🇺🇸' },
  { code: 'EURKRW', label: 'EUR/KRW', flag: '🇪🇺' },
  { code: 'JPYKRW', label: 'JPY/KRW (100엔)', flag: '🇯🇵' },
  { code: 'CNYKRW', label: 'CNY/KRW', flag: '🇨🇳' },
  { code: 'GBPKRW', label: 'GBP/KRW', flag: '🇬🇧' },
  { code: 'CADKRW', label: 'CAD/KRW', flag: '🇨🇦' },
  { code: 'HKDKRW', label: 'HKD/KRW', flag: '🇭🇰' },
];
