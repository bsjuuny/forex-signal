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

const DATA_PATH = path.join(process.cwd(), 'public', 'data', 'exchange_rates.json');

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

function buildMessage(data: StoredRateData[]): string {
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
    return `${info?.flag ?? ''} <b>${info?.label ?? d.currency}</b>  ${formatRate(s.currentRate)}  <code>${score}점</code> [${strength}]`;
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

async function sendTelegram(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.error('[notify] TELEGRAM_BOT_TOKEN 또는 TELEGRAM_CHAT_ID가 없습니다.');
    process.exit(1);
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram API 오류 ${res.status}: ${body}`);
  }

  console.log('[notify] 텔레그램 알림 전송 완료');
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

  const message = buildMessage(data);
  console.log('[notify] 발송 메시지:\n' + message);
  await sendTelegram(message);
}

main().catch(err => {
  console.error('[notify] 오류:', err);
  process.exit(1);
});
