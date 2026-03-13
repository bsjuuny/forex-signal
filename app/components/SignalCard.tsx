'use client';

import { TradingSignal, IndicatorSignal } from '@/lib/signals';
import { SUPPORTED_CURRENCIES } from '@/lib/koreaexim-api';

interface Props {
  signal: TradingSignal;
  isSelected: boolean;
  onClick: () => void;
}

const SIGNAL_COLORS = {
  BUY: {
    bg: 'bg-emerald-950/60',
    border: 'border-emerald-500',
    badge: 'bg-emerald-500 text-white',
    text: 'text-emerald-400',
    label: '매 수',
  },
  SELL: {
    bg: 'bg-rose-950/60',
    border: 'border-rose-500',
    badge: 'bg-rose-500 text-white',
    text: 'text-rose-400',
    label: '매 도',
  },
  NEUTRAL: {
    bg: 'bg-zinc-900/60',
    border: 'border-zinc-600',
    badge: 'bg-zinc-600 text-white',
    text: 'text-zinc-400',
    label: '중 립',
  },
};

const STRENGTH_LABEL = {
  STRONG: '강력',
  MODERATE: '보통',
  WEAK: '약함',
};

export default function SignalCard({ signal, isSelected, onClick }: Props) {
  const colors = SIGNAL_COLORS[signal.signal];
  const currency = SUPPORTED_CURRENCIES.find(c => c.code === signal.currency);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border-2 p-4 transition-all
        ${colors.bg} ${isSelected ? colors.border : 'border-zinc-700'}
        hover:border-opacity-80 hover:scale-[1.01]`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{currency?.flag}</span>
          <span className="font-bold text-white">{currency?.label ?? signal.currency}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${colors.badge} font-bold tracking-wide`}>
            {colors.label}
          </span>
          <span className="text-xs text-zinc-400">{STRENGTH_LABEL[signal.strength]}</span>
        </div>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <div className="text-2xl font-mono font-bold text-white">
            {signal.currentRate.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-zinc-500 mt-0.5">
            {new Date(signal.calculatedAt).toLocaleString('ko-KR', {
              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
            })}
          </div>
        </div>

        {/* 점수 게이지 */}
        <div className="flex flex-col items-end gap-1">
          <span className={`text-sm font-bold ${colors.text}`}>
            {signal.score > 0 ? '+' : ''}{signal.score}점
          </span>
          <div className="w-24 h-2 bg-zinc-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                signal.signal === 'BUY' ? 'bg-emerald-500' :
                signal.signal === 'SELL' ? 'bg-rose-500' : 'bg-zinc-500'
              }`}
              style={{ width: `${Math.abs(signal.score)}%` }}
            />
          </div>
        </div>
      </div>
    </button>
  );
}

export function IndicatorRow({ indicator }: { indicator: IndicatorSignal }) {
  const colors = SIGNAL_COLORS[indicator.signal];
  return (
    <div className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
      <span className="text-sm text-zinc-400 font-mono">{indicator.name}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm text-zinc-300">{indicator.description}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${colors.badge}`}>
          {colors.label}
        </span>
      </div>
    </div>
  );
}
