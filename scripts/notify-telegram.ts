/**
 * 텔레그램 환율 시그널 알림 스크립트
 * 실행: npm run notify
 * 필요 환경변수: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import fs from 'fs';
import path from 'path';
import { StoredRateData } from '../lib/signals';
import { fetchLiveRates, LiveRates } from '../lib/live-rates';

const DATA_PATH = path.join(process.cwd(), 'public', 'data', 'exchange_rates.json');
const BASE_RATES_PATH = path.join(process.cwd(), 'public', 'data', 'base_rates.json');

const CURRENCY_INFO: Record<string, { flag: string; label: string }> = {
  USDKRW: { flag: '🇺🇸', label: 'USD/KRW' },
  EURKRW: { flag: '🇪🇺', label: 'EUR/KRW' },
  JPYKRW: { flag: '🇯🇵', label: 'JPY/KRW' },
  CNYKRW: { flag: '🇨🇳', label: 'CNY/KRW' },
  GBPKRW: { flag: '🇬🇧', label: 'GBP/KRW' },
  CADKRW: { flag: '🇨🇦', label: 'CAD/KRW' },
  HKDKRW: { flag: '🇭🇰', label: 'HKD/KRW' },
};

const STRENGTH_LABEL: Record<string, string> = {
  STRONG: '강력',
  MODERATE: '보통',
  WEAK: '약함',
};

function formatRate(n: number): string {
  return n.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
}

function buildMessage(data: StoredRateData[], liveRates: LiveRates): string {
  const now = new Date();
  const kst = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(now);

  const sorted = [...data].sort((a, b) => b.signal.score - a.signal.score);

  const buys   = sorted.filter(d => d.signal.signal === 'BUY');
  const sells  = sorted.filter(d => d.signal.signal === 'SELL');
  const neutrals = sorted.filter(d => d.signal.signal === 'NEUTRAL');

  const lines: string[] = [];
  lines.push(`📊 <b>환율 시그널 업데이트</b>`);
  lines.push(`🕐 ${kst} KST\n`);

  function formatEntry(d: StoredRateData): string {
    const info = CURRENCY_INFO[d.currency];
    const s = d.signal;
    const score = s.score > 0 ? `+${s.score}` : `${s.score}`;
    const strength = STRENGTH_LABEL[s.strength];
    const rate = liveRates[d.currency] ?? s.currentRate;
    return `${info?.flag ?? ''} <b>${info?.label ?? d.currency}</b>  ${formatRate(rate)}  <code>${score}점</code> [${strength}]`;
  }

  if (buys.length > 0) {
    lines.push(`📈 <b>매수 신호 (${buys.length}개)</b>`);
    buys.forEach(d => lines.push(formatEntry(d)));
    lines.push('');
  }

  if (sells.length > 0) {
    lines.push(`📉 <b>매도 신호 (${sells.length}개)</b>`);
    sells.forEach(d => lines.push(formatEntry(d)));
    lines.push('');
  }

  if (neutrals.length > 0) {
    lines.push(`➖ <b>중립 (${neutrals.length}개)</b>`);
    neutrals.forEach(d => lines.push(formatEntry(d)));
  }

  return lines.join('\n');
}

async function sendTelegram(text: string, attempt = 1): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.error('[notify] TELEGRAM_BOT_TOKEN 또는 TELEGRAM_CHAT_ID가 없습니다.');
    process.exit(1);
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15초 timeout

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Telegram API 오류 ${res.status}: ${body}`);
    }

    console.log('[notify] 텔레그램 알림 전송 완료');
  } catch (err) {
    if (attempt < 3) {
      const delay = attempt * 5000; // 5초, 10초
      console.warn(`[notify] 전송 실패 (${attempt}회차), ${delay / 1000}초 후 재시도...`);
      await new Promise(r => setTimeout(r, delay));
      return sendTelegram(text, attempt + 1);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  if (!fs.existsSync(DATA_PATH)) {
    console.error('[notify] exchange_rates.json 파일이 없습니다.');
    process.exit(1);
  }

  const data: StoredRateData[] = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  if (data.length === 0) {
    console.error('[notify] 데이터가 비어 있습니다.');
    process.exit(1);
  }

  // base_rates.json의 eximRates 우선 사용 (Koreaexim 기준율)
  let liveRates: LiveRates = {};
  try {
    if (fs.existsSync(BASE_RATES_PATH)) {
      const base = JSON.parse(fs.readFileSync(BASE_RATES_PATH, 'utf-8'));
      if (base?.eximRates && Object.keys(base.eximRates).length > 0) {
        liveRates = base.eximRates;
        console.log('[notify] Koreaexim 기준율 사용');
      }
    }
    if (Object.keys(liveRates).length === 0) {
      liveRates = await fetchLiveRates();
      console.log('[notify] 실시간 환율 조회 완료 (exchangerate-api.com)');
    }
  } catch {
    console.warn('[notify] 환율 조회 실패 — 시그널 기준 환율 사용');
  }

  const message = buildMessage(data, liveRates);
  console.log('[notify] 발송 메시지:\n' + message);
  await sendTelegram(message);
}

main().catch(err => {
  console.error('[notify] 오류:', err);
  process.exit(1);
});
