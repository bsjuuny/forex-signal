/**
 * 환율 데이터 수집 스크립트 (한국수출입은행 API)
 * GitHub Actions에서 주기적으로 실행 → public/data/exchange_rates.json 저장
 *
 * 실행: npm run data:update
 * 필요 환경변수: KOREAEXIM_API_KEY
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import fs from 'fs';
import path from 'path';
import { getExchangeRateHistory, SUPPORTED_CURRENCIES } from '../lib/koreaexim-api';
import { calculateSignal, StoredRateData } from '../lib/signals';
import { fetchMacroData, MacroData } from '../lib/macro-api';

const OUTPUT_PATH = path.join(process.cwd(), 'public', 'data', 'exchange_rates.json');
const BASE_RATES_PATH = path.join(process.cwd(), 'public', 'data', 'base_rates.json');

const CURRENCY_MAP: Record<string, string> = {
  USDKRW: 'USD',
  EURKRW: 'EUR',
  JPYKRW: 'JPY(100)',
  CNYKRW: 'CNH',
  GBPKRW: 'GBP',
  CADKRW: 'CAD',
  HKDKRW: 'HKD',
};

const LIVE_CALC: Record<string, (r: Record<string, number>) => number> = {
  USDKRW: r => r.KRW,
  EURKRW: r => r.KRW / r.EUR,
  JPYKRW: r => (r.KRW / r.JPY) * 100,
  CNYKRW: r => r.KRW / r.CNY,
  GBPKRW: r => r.KRW / r.GBP,
  CADKRW: r => r.KRW / r.CAD,
  HKDKRW: r => r.KRW / r.HKD,
};

function parseRateStr(s: string): number {
  return parseFloat((s ?? '').replace(/,/g, '')) || 0;
}

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

async function collectBaseRates(): Promise<void> {
  const apiKey = process.env.KOREAEXIM_API_KEY;
  if (!apiKey) return;

  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const today = toDateStr(now);

  try {
    console.log('  [기준율] Koreaexim + exchangerate-api.com 동시 수집 중...');

    const [eximRes, liveRes] = await Promise.all([
      fetch(`https://oapi.koreaexim.go.kr/site/program/financial/exchangeJSON?authkey=${apiKey}&searchdate=${today}&data=AP01`),
      fetch('https://api.exchangerate-api.com/v4/latest/USD'),
    ]);

    if (!eximRes.ok || !liveRes.ok) {
      console.warn('  [기준율] API 호출 실패 — base_rates.json 생략');
      return;
    }

    const eximData = await eximRes.json();
    const liveData = await liveRes.json();
    const liveRates = liveData.rates as Record<string, number>;

    const eximRates: Record<string, number> = {};
    if (Array.isArray(eximData)) {
      for (const [code, curUnit] of Object.entries(CURRENCY_MAP)) {
        const row = eximData.find((r: { cur_unit: string }) => r.cur_unit === curUnit);
        if (row) {
          const rate = parseRateStr(row.deal_bas_r);
          if (rate > 0) eximRates[code] = rate;
        }
      }
    }

    if (Object.keys(eximRates).length === 0) {
      console.warn('  [기준율] Koreaexim 데이터 없음 (주말/공휴일?) — base_rates.json 생략');
      return;
    }

    const liveSnapshot: Record<string, number> = {};
    for (const [code, calc] of Object.entries(LIVE_CALC)) {
      const val = calc(liveRates);
      if (isFinite(val) && val > 0) {
        liveSnapshot[code] = Math.round(val * 100) / 100;
      }
    }

    const offset: Record<string, number> = {};
    for (const code of Object.keys(eximRates)) {
      if (liveSnapshot[code]) {
        offset[code] = Math.round((eximRates[code] - liveSnapshot[code]) * 100) / 100;
      }
    }

    fs.writeFileSync(BASE_RATES_PATH, JSON.stringify({
      eximRates,
      liveSnapshot,
      offset,
      date: today,
      fetchedAt: new Date().toISOString(),
    }, null, 2));

    console.log(`  [기준율] 저장 완료 → base_rates.json (offset 예: USDKRW ${offset.USDKRW ?? 'N/A'})`);
  } catch (err) {
    console.warn('  [기준율] 수집 오류 — 건너뜀:', err instanceof Error ? err.message : err);
  }
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

async function main() {
  if (!process.env.KOREAEXIM_API_KEY) {
    console.error('[collect-data] 오류: KOREAEXIM_API_KEY 환경변수가 없습니다.');
    console.error('  https://www.koreaexim.go.kr/ir/HPHKIR020M01?apino=2 에서 무료 신청 후 .env.local에 추가하세요.');
    process.exit(1);
  }

  console.log('[collect-data] 환율 데이터 수집 시작...');

  // 기준율 수집 (Koreaexim + exchangerate-api.com offset)
  await collectBaseRates();

  // 거시 지표 수집 (실패해도 계속 진행)
  console.log('  [매크로] VIX / 미국채 10Y 수집 중...');
  const macro: MacroData | null = await fetchMacroData();
  if (macro) {
    console.log(`  [매크로] VIX ${macro.vix.toFixed(1)}, US10Y ${macro.us10y.toFixed(2)}%`);
  } else {
    console.warn('  [매크로] 거시 지표 수집 실패 — 기술적 분석만 사용');
  }

  const endDate = formatDate(new Date());
  const startDate = formatDate(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000));

  // 기존 데이터 로드
  let existing: StoredRateData[] = [];
  if (fs.existsSync(OUTPUT_PATH)) {
    try {
      existing = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8'));
    } catch {}
  }

  const results: StoredRateData[] = [];

  for (const { code, label } of SUPPORTED_CURRENCIES) {
    try {
      console.log(`  - ${label} (${code}) 수집 중...`);

      // 기존 캔들 데이터 (누락 날짜만 API 호출하도록)
      const existingEntry = existing.find(e => e.currency === code);
      const existingCandles = existingEntry?.rates ?? [];

      const history = await getExchangeRateHistory(code, startDate, endDate, existingCandles);

      if (history.length < 26) {
        console.warn(`    경고: ${code} 히스토리 데이터 부족 (${history.length}일, 최소 26일 필요)`);
        continue;
      }

      const signal = calculateSignal(code, history, macro);

      results.push({
        currency: code,
        rates: history,
        signal,
        ...(macro ? { macro } : {}),
        updatedAt: new Date().toISOString(),
      });

      console.log(`    완료: ${signal.signal} (점수: ${signal.score}, ${history.length}일)`);
    } catch (err) {
      console.error(`  오류 (${code}):`, err instanceof Error ? err.message : err);
    }
  }

  // 수집 실패한 통화는 기존 데이터 유지
  const merged = [...existing];
  for (const r of results) {
    const idx = merged.findIndex(e => e.currency === r.currency);
    if (idx >= 0) merged[idx] = r;
    else merged.push(r);
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(merged, null, 2));

  console.log(`[collect-data] 완료! ${results.length}개 통화 저장됨 → ${OUTPUT_PATH}`);
}

main().catch(err => {
  console.error('[collect-data] 치명적 오류:', err);
  process.exit(1);
});
