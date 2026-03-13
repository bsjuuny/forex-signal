/**
 * 한국투자증권 (KIS) Developers API 클라이언트
 * https://apiportal.koreainvestment.com/
 *
 * 환경변수 설정 필요:
 *   KIS_APP_KEY      - 앱 키
 *   KIS_APP_SECRET   - 앱 시크릿
 *   KIS_ACCOUNT_NO   - 계좌번호 (XXXXXXXXXX-XX)
 *   KIS_IS_REAL      - "true" 이면 실전투자, 없으면 모의투자
 */

function getBaseUrl() {
  return process.env.KIS_IS_REAL === 'true'
    ? 'https://openapi.koreainvestment.com:9443'
    : 'https://openapivts.koreainvestment.com:29443'; // 모의투자
}

let cachedToken: { token: string; expiresAt: number } | null = null;
let tokenFetchPromise: Promise<string> | null = null; // 중복 발급 방지

/** OAuth2 접근토큰 발급 */
export async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  // 이미 발급 중이면 같은 Promise를 공유
  if (tokenFetchPromise) return tokenFetchPromise;

  tokenFetchPromise = (async () => {
    const res = await fetch(`${getBaseUrl()}/oauth2/tokenP`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        appkey: process.env.KIS_APP_KEY,
        appsecret: process.env.KIS_APP_SECRET,
      }),
    });

    if (!res.ok) throw new Error(`KIS 토큰 발급 실패: ${res.status}`);
    const data = await res.json();

    cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    };
    return cachedToken.token;
  })().finally(() => { tokenFetchPromise = null; });

  return tokenFetchPromise;
}

/** KIS API 공통 헤더 */
async function getHeaders(trId: string, extra?: Record<string, string>) {
  const token = await getAccessToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    appkey: process.env.KIS_APP_KEY!,
    appsecret: process.env.KIS_APP_SECRET!,
    tr_id: trId,
    custtype: 'P',
    ...extra,
  };
}

// ────────────────────────────────────────────
// 환율 관련
// ────────────────────────────────────────────

export interface ExchangeRateData {
  currency: string;      // 통화코드 (USDKRW, EURKRW, ...)
  rate: number;          // 현재 환율
  baseRate: number;      // 기준환율
  change: number;        // 전일 대비 변동
  changeRate: number;    // 전일 대비 변동률(%)
  high: number;          // 당일 고가
  low: number;           // 당일 저가
  timestamp: string;     // 조회 시각 (ISO)
}

/**
 * 현재 환율 조회 (오늘 일봉의 최신값)
 * inquire-daily-chartprice 로 오늘 데이터만 요청
 */
export async function getExchangeRate(currencyCode: string): Promise<ExchangeRateData> {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const candles = await getExchangeRateHistory(currencyCode, today, today);
  const latest = candles[candles.length - 1];

  return {
    currency: currencyCode,
    rate: latest?.close ?? 0,
    baseRate: latest?.open ?? 0,
    change: latest ? latest.close - latest.open : 0,
    changeRate: latest ? ((latest.close - latest.open) / latest.open) * 100 : 0,
    high: latest?.high ?? 0,
    low: latest?.low ?? 0,
    timestamp: new Date().toISOString(),
  };
}

// ────────────────────────────────────────────
// 환율 일봉 (OHLC) 조회
// ────────────────────────────────────────────

export interface OHLCCandle {
  date: string;   // YYYYMMDD
  open: number;
  high: number;
  low: number;
  close: number;
}

/**
 * 환율 일봉 데이터 조회
 * TR: FHKST03030100
 * URL: /uapi/overseas-price/v1/quotations/inquire-daily-chartprice
 */
export async function getExchangeRateHistory(
  currencyCode: string,
  startDate: string, // YYYYMMDD
  endDate: string,   // YYYYMMDD
): Promise<OHLCCandle[]> {
  const headers = await getHeaders('FHKST03030100');

  const params = new URLSearchParams({
    FID_COND_MRKT_DIV_CODE: 'X',              // X: 외환
    FID_INPUT_ISCD: currencyCode.slice(0, 3), // USD, EUR, JPY ...
    FID_INPUT_DATE_1: startDate,
    FID_INPUT_DATE_2: endDate,
    FID_PERIOD_DIV_CODE: 'D',                 // D: 일봉
  });

  const res = await fetch(
    `${getBaseUrl()}/uapi/overseas-price/v1/quotations/inquire-daily-chartprice?${params}`,
    { headers }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`환율 히스토리 조회 실패 (${currencyCode}): ${res.status}\n${body}`);
  }
  const json = await res.json();

  console.log('[DEBUG] raw response:', JSON.stringify(json, null, 2).slice(0, 2000));

  const output2: Array<Record<string, string>> = json.output2 || [];
  return output2
    .filter(d => {
      const date = d.stck_bsop_date || d.xymd || d.date || '';
      return date >= startDate;
    })
    .map(d => ({
      date: d.stck_bsop_date || d.xymd || d.date || '',
      open:  parseFloat(d.ovrs_nmix_oprc || d.open  || d.oprc || '0'),
      high:  parseFloat(d.ovrs_nmix_hgpr || d.high  || d.hgpr || '0'),
      low:   parseFloat(d.ovrs_nmix_lwpr || d.low   || d.lwpr || '0'),
      close: parseFloat(d.ovrs_nmix_prpr || d.clos  || d.prpr || '0'),
    }))
    .filter(d => d.date && d.close > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** 지원 통화 목록 */
export const SUPPORTED_CURRENCIES = [
  { code: 'USDKRW', label: 'USD/KRW', flag: '🇺🇸' },
  { code: 'EURKRW', label: 'EUR/KRW', flag: '🇪🇺' },
  { code: 'JPYKRW', label: 'JPY/KRW (100엔)', flag: '🇯🇵' },
  { code: 'CNYKRW', label: 'CNY/KRW', flag: '🇨🇳' },
  { code: 'GBPKRW', label: 'GBP/KRW', flag: '🇬🇧' },
];
