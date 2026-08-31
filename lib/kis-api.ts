/**
 * 한국투자증권 (KIS) Developers API 클라이언트
 * https://apiportal.koreainvestment.com/
 *
 * 환경변수 설정 필요:
 *   KIS_APP_KEY      - 앱 키
 *   KIS_APP_SECRET   - 앱 시크릿
 *   KIS_IS_REAL      - "true" 이면 실전투자, 없으면 모의투자
 *
 * 토큰 캐시: kis-quant-lab(실거래 엔진)/today-signal과 공유하는 DPAPI 암호화 캐시
 * (C:/github/.kis-token-cache) - KIS는 같은 앱키로 새 토큰을 발급하면 기존 유효 토큰을
 * 즉시 무효화하므로, 독립적으로 재발급하면 서로의 토큰을 깨뜨린다.
 */

const BASE_URL = 'https://openapi.koreainvestment.com:9443';

interface TokenCache { value: string; expiresAt: number; }

interface SharedCacheModule {
  loadSharedToken(args: { environment: string; appKey: string | undefined }): { accessToken: string; expiresAt: number } | null;
  withSharedTokenLock<T>(
    args: { environment: string; appKey: string | undefined },
    fn: (ctx: { cached: { accessToken: string; expiresAt: number } | null; save: (token: string, expiresInSeconds: number) => void }) => Promise<T>,
  ): Promise<T>;
}

let _sharedCache: SharedCacheModule | null = null;
// ts-node(이 프로젝트의 CJS 트랜스파일 대상)는 `import()`조차 컴파일 시점에 require()로
// 다운레벨링해서 .mjs를 못 읽는다(ERR_REQUIRE_ESM) — TS 정적 분석이 보지 못하게
// new Function으로 감싸 진짜 런타임 동적 import를 강제한다.
const _dynamicImport = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<unknown>;
async function sharedCache(): Promise<SharedCacheModule> {
  if (!_sharedCache) {
    const { pathToFileURL } = await import('url');
    _sharedCache = (await _dynamicImport(pathToFileURL('C:/github/scheduler/lib/kis-token-cache.mjs').href)) as SharedCacheModule;
  }
  return _sharedCache;
}

let _token: TokenCache | null = null;
let _tokenPromise: Promise<string> | null = null;

async function loadTokenCache(): Promise<TokenCache | null> {
  try {
    const { loadSharedToken } = await sharedCache();
    const cached = loadSharedToken({ environment: 'live', appKey: process.env.KIS_APP_KEY });
    return cached ? { value: cached.accessToken, expiresAt: cached.expiresAt } : null;
  } catch {
    return null;
  }
}

async function issueTokenHttp(): Promise<{ access_token: string; expires_in: number }> {
  let lastError: Error | null = null;
  for (const retry of [true, false]) {
    const res = await fetch(`${BASE_URL}/oauth2/tokenP`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant_type: 'client_credentials', appkey: process.env.KIS_APP_KEY, appsecret: process.env.KIS_APP_SECRET }),
    });
    const body = await res.text().catch(() => '');
    if (res.ok) return JSON.parse(body);
    if (retry && body.includes('EGW00133')) {
      console.warn('[KIS] 토큰 발급 1분 제한 — 65초 대기 후 재시도...');
      await new Promise(r => setTimeout(r, 65000));
      continue;
    }
    lastError = new Error(`KIS 토큰 발급 실패: ${res.status}\n${body.slice(0, 200)}`);
    break;
  }
  throw lastError;
}

/**
 * 캐시 재확인 → 없으면 발급 → 저장을 공유 락 하나로 원자적으로 수행 (동시 재발급으로
 * 서로의 토큰을 무효화하는 경쟁 방지).
 */
async function issueToken(): Promise<string> {
  const { withSharedTokenLock } = await sharedCache();
  return withSharedTokenLock(
    { environment: 'live', appKey: process.env.KIS_APP_KEY },
    async ({ cached, save }) => {
      if (cached) {
        _token = { value: cached.accessToken, expiresAt: cached.expiresAt };
        return cached.accessToken;
      }
      const data = await issueTokenHttp();
      save(data.access_token, data.expires_in);
      _token = { value: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
      return _token.value;
    },
  );
}

/** OAuth2 접근토큰 발급 (메모리 → 공유 캐시 → 신규 발급 순서로 캐시 확인) */
export async function getAccessToken(): Promise<string> {
  if (_token && Date.now() < _token.expiresAt) return _token.value;
  const cached = await loadTokenCache();
  if (cached) { _token = cached; return _token.value; }
  if (_tokenPromise) return _tokenPromise;
  _tokenPromise = issueToken().finally(() => { _tokenPromise = null; });
  return _tokenPromise;
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

// KIS 통화코드 매핑
const KIS_CURRENCY_CODE: Record<string, string> = {
  USDKRW: 'USD',
  EURKRW: 'EUR',
  JPYKRW: 'JPY',
  CNYKRW: 'CNY',
  GBPKRW: 'GBP',
  CADKRW: 'CAD',
  HKDKRW: 'HKD',
};

// JPY는 KIS가 1엔 기준 반환 → 100엔 기준으로 변환
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
    `${BASE_URL}/uapi/overseas-price/v1/quotations/inquire-daily-chartprice?${params}`,
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
  return candles[candles.length - 1]?.close ?? 0;
}
