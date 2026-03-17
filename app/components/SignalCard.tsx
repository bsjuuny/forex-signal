'use client';

import { TradingSignal, IndicatorSignal } from '@/lib/signals';
import { SUPPORTED_CURRENCIES } from '@/lib/koreaexim-api';
import { SIGNAL_COLORS } from '@/lib/signal-colors';

const STRENGTH_LABEL = {
  STRONG: '강력',
  MODERATE: '보통',
  WEAK: '약함',
};

interface Props {
  signal: TradingSignal;
  liveRate?: number;
  isSelected: boolean;
  onClick: () => void;
}

export default function SignalCard({ signal, liveRate, isSelected, onClick }: Props) {
  const colors = SIGNAL_COLORS[signal.signal];
  const currency = SUPPORTED_CURRENCIES.find(c => c.code === signal.currency);
  const displayRate = liveRate ?? signal.currentRate;
  const change = liveRate != null
    ? ((liveRate - signal.currentRate) / signal.currentRate) * 100
    : null;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border-2 p-4 transition-all duration-200
        ${colors.bg} ${isSelected ? colors.border : 'border-zinc-700/60'}
        hover:border-zinc-500 hover:scale-[1.015] active:scale-[0.995]`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{currency?.flag}</span>
          <span className="font-semibold text-white text-sm">{currency?.label ?? signal.currency}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${colors.badge} font-semibold tracking-wide`}>
            {colors.label}
          </span>
          <span className="text-xs text-zinc-500">{STRENGTH_LABEL[signal.strength]}</span>
        </div>
      </div>

      <div className="flex items-end justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <div className="text-xl font-mono font-bold text-white tabular-nums">
              {displayRate.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
            </div>
            {liveRate != null && (
              <div className="flex items-center gap-1.5 ml-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-tighter">Live</span>
              </div>
            )}
          </div>
          {liveRate != null ? (
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-zinc-600 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
                시그널가 {signal.currentRate.toLocaleString('ko-KR')}
              </span>
              <div className={`text-xs font-mono tabular-nums ${change! >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {change! >= 0 ? '+' : ''}{change!.toFixed(2)}%
              </div>
            </div>
          ) : (
            <div className="text-xs text-zinc-600 mt-0.5">
              기준: {new Date(signal.calculatedAt).toLocaleString('ko-KR', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
            </div>
          )}
        </div>

        {/* 점수 게이지 */}
        <div className="flex flex-col items-end gap-1 ml-3 shrink-0">
          <span className={`text-sm font-bold tabular-nums ${colors.text}`}>
            {signal.score > 0 ? '+' : ''}{signal.score}
          </span>
          <div className="w-20 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                signal.signal === 'BUY' ? 'bg-rose-500' :
                signal.signal === 'SELL' ? 'bg-blue-500' : 'bg-zinc-500'
              }`}
              style={{ width: `${Math.min(100, Math.abs(signal.score))}%` }}
            />
          </div>
        </div>
      </div>
    </button>
  );
}

interface SwipeTabProps {
  signal: TradingSignal;
  liveRate?: number;
  isSelected: boolean;
  onClick: () => void;
}

export function SwipeTab({ signal, liveRate, isSelected, onClick }: SwipeTabProps) {
  const colors = SIGNAL_COLORS[signal.signal];
  const currency = SUPPORTED_CURRENCIES.find(c => c.code === signal.currency);
  const displayRate = liveRate ?? signal.currentRate;

  return (
    <button
      onClick={onClick}
      className={`snap-start shrink-0 flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl border-2 transition-all duration-200 min-w-[88px]
        ${isSelected ? `${colors.bg} ${colors.border}` : 'bg-zinc-900 border-zinc-800'}
        active:scale-95`}
    >
      <span className="text-lg leading-none">{currency?.flag}</span>
      <span className={`text-xs font-bold leading-none ${isSelected ? colors.text : 'text-zinc-400'}`}>
        {signal.currency.replace('KRW', '')}
      </span>
      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold leading-none ${colors.badge}`}>
        {colors.label}
      </span>
      <span className="text-[11px] font-mono tabular-nums text-zinc-300 leading-none">
        {displayRate.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
      </span>
      {liveRate != null && (
        <span className="text-[9px] text-zinc-600 font-mono leading-none">
          Live
        </span>
      )}
    </button>
  );
}

export function IndicatorRow({ indicator }: { indicator: IndicatorSignal }) {
  const colors = SIGNAL_COLORS[indicator.signal];
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-zinc-800/80 last:border-0 gap-3">
      <span className="text-xs text-zinc-500 font-mono shrink-0">{indicator.name}</span>
      <span className="text-xs text-zinc-400 min-w-0 truncate text-right">{indicator.description}</span>
      <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${colors.badge}`}>
        {colors.label}
      </span>
    </div>
  );
}
