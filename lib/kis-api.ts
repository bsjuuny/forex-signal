/**
 * 한국투자증권 (KIS) Developers API 클라이언트
 * https://apiportal.koreainvestment.com/
 *
 * 환경변수 설정 필요:
 *   KIS_APP_KEY      - 앱 키
 *   KIS_APP_SECRET   - 앱 시크릿
 *   KIS_IS_REAL      - "true" 이면 실전투자, 없으면 모의투자
 */

function getBaseUrl() {
  return process.env.KIS_IS_REAL === 'true'
    ? 'https://openapi.koreainvestment.com:9443'
    : 'https://openapivts.koreainvestment.com:29443';
}

let cachedToken: { token: string; expiresAt: number } | null = null;
let tokenFetchPromise: Promise<string> | null = null;

/** OAuth2 접근토큰 발급 */
export async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

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
async function getHeaders(trId: string) {
  const token = await getAccessToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    appkey: process.env.KIS_APP_KEY!,
    appsecret: process.env.KIS_APP_SECRET!,
    tr_id: trId,
    custtype: 'P',
  };
}

// KIS 통화코드 매핑 (3자리 → KIS FID_INPUT_ISCD)
const KIS_CURRENCY_CODE: Record<string, string> = {
  USDKRW: 'USD',
  EURKRW: 'EUR',
  JPYKRW: 'JPY',
  CNYKRW: 'CNY',
  GBPKRW: 'GBP',
  CADKRW: 'CAD',
  HKDKRW: 'HKD',
};

// JPY는 KIS가 1엔 기준으로 반환 → 100엔 기준으로 변환 필요
const JPY_MULTIPLIER: Record<string, number> = {
  JPYKRW: 100,
};

export interface OHLCCandle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

/**
 * 환율 일봉 데이터 조회
 * TR: FHKST03030100
 */
export async function getExchangeRateHistory(
  currencyCode: string,
  startDate: string,
  endDate: string,
): Promise<OHLCCandle[]> {
  const kisCode = KIS_CURRENCY_CODE[currencyCode];
  if (!kisCode) throw new Error(`지원하지 않는 통화: ${currencyCode}`);

  const headers = await getHeaders('FHKST03030100');
  const multiplier = JPY_MULTIPLIER[currencyCode] ?? 1;

  const params = new URLSearchParams({
    FID_COND_MRKT_DIV_CODE: 'X',
    FID_INPUT_ISCD: kisCode,
    FID_INPUT_DATE_1: startDate,
    FID_INPUT_DATE_2: endDate,
    FID_PERIOD_DIV_CODE: 'D',
  });

  const res = await fetch(
    `${getBaseUrl()}/uapi/overseas-price/v1/quotations/inquire-daily-chartprice?${params}`,
    { headers }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`KIS 환율 히스토리 조회 실패 (${currencyCode}): ${res.status}\n${body}`);
  }

  const json = await res.json();
  const output2: Array<Record<string, string>> = json.output2 ?? [];

  return output2
    .map(d => ({
      date:  d.stck_bsop_date ?? d.xymd ?? '',
      open:  parseFloat(d.ovrs_nmix_oprc ?? d.oprc ?? '0') * multiplier,
      high:  parseFloat(d.ovrs_nmix_hgpr ?? d.hgpr ?? '0') * multiplier,
      low:   parseFloat(d.ovrs_nmix_lwpr ?? d.lwpr ?? '0') * multiplier,
      close: parseFloat(d.ovrs_nmix_prpr ?? d.prpr ?? '0') * multiplier,
    }))
    .filter(d => d.date >= startDate && d.close > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 현재 환율 조회 (오늘 일봉의 최신 close)
 */
export async function getExchangeRate(currencyCode: string): Promise<number> {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const candles = await getExchangeRateHistory(currencyCode, today, today);
  const close = candles[candles.length - 1]?.close ?? 0;
  return close;
}
