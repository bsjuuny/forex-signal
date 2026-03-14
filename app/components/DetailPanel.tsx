'use client';

import { StoredRateData } from '@/lib/signals';
import { SIGNAL_COLORS } from '@/lib/signal-colors';
import { IndicatorRow } from './SignalCard';
import RateChart from './RateChart';
import Calculator from './Calculator';
import { useMemo } from 'react';

interface Props {
  data: StoredRateData;
  liveRate?: number;
}

const STRENGTH_LABEL = {
  STRONG: '강력한',
  MODERATE: '보통 강도의',
  WEAK: '약한',
};

export default function DetailPanel({ data, liveRate }: Props) {
  const { signal, rates } = data;
  const colors = SIGNAL_COLORS[signal.signal];
  const displayRate = liveRate ?? signal.currentRate;

  const isFriday = useMemo(() => new Date().getDay() === 5, []);

  return (
    <div className="flex flex-col gap-4">
      {/* 신호 요약 */}
      <div className={`rounded-xl border p-4 ${colors.detailBg}`}>
        <div className="flex items-start justify-between gap-3 mb-2">
          <h2 className="text-base font-bold text-white leading-tight">{signal.currency} 종합 신호</h2>
          <span className={`text-xl font-black ${colors.text} shrink-0 tabular-nums`}>
            {colors.label} {signal.score > 0 ? '+' : ''}{signal.score}점
          </span>
        </div>
        <p className="text-xs text-zinc-400 leading-relaxed">
          {STRENGTH_LABEL[signal.strength]} {colors.label} 신호 · 총 {signal.indicators.length}개 지표 종합 분석
        </p>
        {signal.strength === 'STRONG' && (
          <p className={`mt-2 text-xs font-semibold ${colors.text} opacity-90`}>
            ✦ STRONG 신호 구간은 방향성 적중률이 높습니다.
          </p>
        )}
        {signal.strength === 'MODERATE' && (
          <p className="mt-2 text-xs text-zinc-500">
            STRONG 신호일 때 적중률이 가장 높습니다.
          </p>
        )}
        {signal.strength === 'WEAK' && (
          <p className="mt-2 text-xs text-zinc-600">
            신호 강도가 약합니다. STRONG 신호가 될 때까지 관망을 권장합니다.
          </p>
        )}
      </div>

      {/* 가격 정보 — 2×2 그리드 */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-3 text-center">
          <div className="text-xs text-zinc-500 mb-1.5">목표 매수가</div>
          <div className="font-mono font-bold text-rose-400 tabular-nums">
            {signal.targetBuy.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1.5">
            <span className="text-xs text-zinc-500">현재가</span>
            {liveRate != null && (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </div>
          <div className="font-mono font-bold text-white tabular-nums">
            {displayRate.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-3 text-center">
          <div className="text-xs text-zinc-500 mb-1.5">목표 매도가</div>
          <div className="font-mono font-bold text-blue-400 tabular-nums">
            {signal.targetSell.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="rounded-lg bg-amber-950/40 border border-amber-800/30 p-3 text-center">
          <div className="text-xs text-zinc-500 mb-1.5">손절가 <span className="text-zinc-600">(ATR)</span></div>
          <div className="font-mono font-bold text-amber-400 tabular-nums">
            {signal.stopLoss.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* 차트 */}
      <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 overflow-hidden">
        <RateChart candles={rates} signal={signal} />
      </div>

      {/* 지표별 상세 */}
      <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-4">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-1">지표별 분석</h3>
        {signal.indicators.map(ind => (
          <IndicatorRow key={ind.name} indicator={ind} />
        ))}
      </div>

      {/* 계산기 */}
      <Calculator signal={signal} liveRate={liveRate} />

      {/* 금요일 주말 갭 경고 */}
      {isFriday && (
        <div className="rounded-xl border border-orange-700/50 bg-orange-950/30 p-4">
          <div className="flex items-start gap-3">
            <span className="text-orange-400 text-base leading-none mt-0.5 shrink-0">🗓</span>
            <div>
              <p className="text-xs font-bold text-orange-400 mb-1 uppercase tracking-wide">주말 갭 위험 주의</p>
              <p className="text-xs text-orange-200/70 leading-relaxed">
                오늘은 <span className="font-semibold text-orange-200">금요일</span>입니다.
                주말 사이 발생한 정치·경제 이벤트로 월요일 시가에{' '}
                <span className="font-semibold text-orange-200">갭 상승/하락</span>이 발생할 수 있습니다.
                오늘 신호의 신뢰도가 낮을 수 있으므로 포지션 진입에 유의하세요.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 주의사항 */}
      <div className="rounded-xl border border-amber-700/50 bg-amber-950/30 p-4">
        <div className="flex items-start gap-3">
          <span className="text-amber-400 text-base leading-none mt-0.5 shrink-0">⚠</span>
          <div>
            <p className="text-xs font-bold text-amber-400 mb-1 uppercase tracking-wide">투자 유의사항</p>
            <p className="text-xs text-amber-200/70 leading-relaxed">
              본 신호는 <span className="font-semibold text-amber-200">기술적 분석에만 기반</span>하며 투자를 권유하지 않습니다.
              환율은 정치·경제·금리 등 다양한 요인에 영향받습니다.{' '}
              <span className="font-semibold text-amber-200">투자 결정은 본인 책임입니다.</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
