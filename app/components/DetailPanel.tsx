'use client';

import { StoredRateData } from '@/lib/signals';
import { IndicatorRow } from './SignalCard';
import RateChart from './RateChart';

const SIGNAL_COLORS = {
  BUY: { label: '매수', text: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  SELL: { label: '매도', text: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30' },
  NEUTRAL: { label: '중립', text: 'text-zinc-400', bg: 'bg-zinc-700/30 border-zinc-600/30' },
};

interface Props {
  data: StoredRateData;
}

export default function DetailPanel({ data }: Props) {
  const { signal, rates } = data;
  const colors = SIGNAL_COLORS[signal.signal];

  return (
    <div className="flex flex-col gap-4">
      {/* 신호 요약 */}
      <div className={`rounded-xl border p-4 ${colors.bg}`}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-white">{signal.currency} 종합 신호</h2>
          <span className={`text-2xl font-black ${colors.text}`}>
            {colors.label} ({signal.score > 0 ? '+' : ''}{signal.score}점)
          </span>
        </div>
        <p className="text-sm text-zinc-400">
          {signal.strength === 'STRONG' ? '강력한' : signal.strength === 'MODERATE' ? '보통 강도의' : '약한'}{' '}
          {colors.label} 신호입니다.
          총 {signal.indicators.length}개 지표를 종합 분석했습니다.
        </p>
      </div>

      {/* 목표가 / 손절가 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-zinc-800/60 p-3 text-center">
          <div className="text-xs text-zinc-500 mb-1">목표 매수가</div>
          <div className="font-mono font-bold text-emerald-400 text-sm">
            {signal.targetBuy.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="rounded-lg bg-zinc-800/60 p-3 text-center">
          <div className="text-xs text-zinc-500 mb-1">현재가</div>
          <div className="font-mono font-bold text-white">
            {signal.currentRate.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="rounded-lg bg-zinc-800/60 p-3 text-center">
          <div className="text-xs text-zinc-500 mb-1">목표 매도가</div>
          <div className="font-mono font-bold text-rose-400 text-sm">
            {signal.targetSell.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>
      <div className="text-center text-xs text-zinc-600">
        손절가: <span className="text-amber-500 font-mono">{signal.stopLoss.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}</span>
        <span className="ml-2">(ATR 기반 자동 계산)</span>
      </div>

      {/* 차트 */}
      <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-3">
        <h3 className="text-sm font-semibold text-zinc-400 mb-3">최근 90일 환율 추이</h3>
        <RateChart candles={rates} signal={signal} />
      </div>

      {/* 지표별 상세 */}
      <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-4">
        <h3 className="text-sm font-semibold text-zinc-400 mb-2">지표별 분석</h3>
        {signal.indicators.map(ind => (
          <IndicatorRow key={ind.name} indicator={ind} />
        ))}
      </div>

      {/* 주의사항 */}
      <div className="rounded-lg bg-amber-950/30 border border-amber-800/30 p-3">
        <p className="text-xs text-amber-600">
          ⚠️ 본 신호는 기술적 분석에만 기반하며 투자를 권유하지 않습니다.
          환율은 정치·경제·금리 등 다양한 요인에 영향받습니다. 투자 결정은 본인 책임입니다.
        </p>
      </div>
    </div>
  );
}
