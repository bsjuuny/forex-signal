'use client';

import { useState } from 'react';
import { TradingSignal } from '@/lib/signals';
import { SUPPORTED_CURRENCIES } from '@/lib/koreaexim-api';

interface Props {
  signal: TradingSignal;
  liveRate?: number;
}

type Tab = 'convert' | 'profit';

export default function Calculator({ signal, liveRate }: Props) {
  const [tab, setTab] = useState<Tab>('convert');

  // 환율 계산기
  const [fromKRW, setFromKRW] = useState(false);
  const [amount, setAmount] = useState('');

  // 수익 계산기
  const [buyPrice, setBuyPrice] = useState(String(signal.targetBuy));
  const [sellPrice, setSellPrice] = useState(String(signal.targetSell));
  const [investKRW, setInvestKRW] = useState('1000000');

  const currency = SUPPORTED_CURRENCIES.find(c => c.code === signal.currency);
  const rate = liveRate ?? signal.currentRate;
  const isJPY = signal.currency === 'JPYKRW';
  const unitRate = isJPY ? rate / 100 : rate; // 1단위당 KRW
  const code = signal.currency.replace('KRW', '');
  const jpyLabel = isJPY ? ' (100엔)' : '';

  // 환율 계산
  const numAmount = parseFloat(amount) || 0;
  const converted = fromKRW ? numAmount / unitRate : numAmount * unitRate;

  // 수익 계산
  const numBuy = parseFloat(buyPrice) || 0;
  const numSell = parseFloat(sellPrice) || 0;
  const numInvest = parseFloat(investKRW) || 0;
  const unitBuy = isJPY ? numBuy / 100 : numBuy;
  const unitSell = isJPY ? numSell / 100 : numSell;
  const foreignQty = unitBuy > 0 ? numInvest / unitBuy : 0;
  const sellKRW = foreignQty * unitSell;
  const profit = sellKRW - numInvest;
  const profitRate = numInvest > 0 ? (profit / numInvest) * 100 : 0;
  const isProfit = profit >= 0;

  return (
    <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 overflow-hidden">
      {/* 탭 헤더 */}
      <div className="flex border-b border-zinc-800">
        {(['convert', 'profit'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
              tab === t ? 'text-white bg-zinc-800/60' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {t === 'convert' ? '환율 계산기' : '수익 계산기'}
          </button>
        ))}
      </div>

      <div className="p-4">
        {tab === 'convert' ? (
          /* ── 환율 계산기 ── */
          <div className="flex flex-col gap-3">
            <div className="flex items-end gap-2">
              {/* 입력 */}
              <div className="flex-1">
                <div className="text-xs text-zinc-500 mb-1.5">
                  {fromKRW ? 'KRW' : `${currency?.flag} ${code}${jpyLabel}`}
                </div>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-zinc-500 transition-colors"
                />
              </div>

              {/* 방향 전환 */}
              <button
                onClick={() => { setFromKRW(v => !v); setAmount(''); }}
                className="mb-0.5 w-9 h-9 flex items-center justify-center rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-all active:scale-95 text-base shrink-0"
              >
                ⇄
              </button>

              {/* 결과 */}
              <div className="flex-1">
                <div className="text-xs text-zinc-500 mb-1.5">
                  {fromKRW ? `${currency?.flag} ${code}${jpyLabel}` : 'KRW'}
                </div>
                <div className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 font-mono text-sm text-white tabular-nums min-h-[38px]">
                  {numAmount > 0
                    ? converted.toLocaleString('ko-KR', { maximumFractionDigits: fromKRW ? 4 : 0 })
                    : <span className="text-zinc-700">—</span>}
                </div>
              </div>
            </div>

            <div className="text-xs text-zinc-600 text-center tabular-nums">
              1 {code}{jpyLabel} = {rate.toLocaleString('ko-KR', { maximumFractionDigits: 2 })} KRW
              {liveRate && <span className="ml-1 text-emerald-500/60">· 실시간</span>}
            </div>
          </div>
        ) : (
          /* ── 수익 계산기 ── */
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-zinc-500 mb-1.5">매수가{jpyLabel}</div>
                <input
                  type="number"
                  value={buyPrice}
                  onChange={e => setBuyPrice(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-zinc-500 transition-colors"
                />
              </div>
              <div>
                <div className="text-xs text-zinc-500 mb-1.5">매도가{jpyLabel}</div>
                <input
                  type="number"
                  value={sellPrice}
                  onChange={e => setSellPrice(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-zinc-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="text-xs text-zinc-500 mb-1.5">투자 금액 (KRW)</div>
              <input
                type="number"
                value={investKRW}
                onChange={e => setInvestKRW(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-zinc-500 transition-colors"
              />
            </div>

            {/* 결과 카드 */}
            <div className="rounded-lg bg-zinc-800/50 border border-zinc-700/50 p-3 flex flex-col gap-2">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">매입 {code} 수량</span>
                <span className="font-mono text-zinc-300 tabular-nums">
                  {foreignQty > 0 ? foreignQty.toLocaleString('ko-KR', { maximumFractionDigits: 2 }) : '—'}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">매도 후 KRW</span>
                <span className="font-mono text-zinc-300 tabular-nums">
                  {sellKRW > 0 ? sellKRW.toLocaleString('ko-KR', { maximumFractionDigits: 0 }) : '—'}
                </span>
              </div>
              <div className="h-px bg-zinc-700/60 my-0.5" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">예상 수익</span>
                <div className="flex items-baseline gap-2">
                  <span className={`font-mono font-bold tabular-nums ${isProfit ? 'text-rose-400' : 'text-blue-400'}`}>
                    {isProfit ? '+' : ''}{Math.round(profit).toLocaleString('ko-KR')} KRW
                  </span>
                  <span className={`text-xs font-mono tabular-nums ${isProfit ? 'text-rose-400' : 'text-blue-400'}`}>
                    ({isProfit ? '+' : ''}{profitRate.toFixed(2)}%)
                  </span>
                </div>
              </div>
            </div>

            {/* 빠른 채우기 버튼 */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { setBuyPrice(String(signal.targetBuy)); setSellPrice(String(signal.targetSell)); }}
                className="text-xs py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors active:scale-95"
              >
                신호 목표가 적용
              </button>
              <button
                onClick={() => setBuyPrice(rate.toFixed(2))}
                className="text-xs py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors active:scale-95"
              >
                현재가를 매수가로
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
