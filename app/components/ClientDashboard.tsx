'use client';

import { useState } from 'react';
import { StoredRateData } from '@/lib/signals';
import SignalCard from './SignalCard';
import DetailPanel from './DetailPanel';

interface Props {
  data: StoredRateData[];
}

// 신호 타입 순서: 강력 매수 → 매수 → 중립 → 매도 → 강력 매도
function signalScore(d: StoredRateData) {
  return d.signal.score;
}

export default function ClientDashboard({ data }: Props) {
  const sorted = [...data].sort((a, b) => signalScore(b) - signalScore(a));
  const [selected, setSelected] = useState<string>(sorted[0]?.currency ?? '');

  const selectedData = data.find(d => d.currency === selected);

  const buyCount = data.filter(d => d.signal.signal === 'BUY').length;
  const sellCount = data.filter(d => d.signal.signal === 'SELL').length;
  const neutralCount = data.filter(d => d.signal.signal === 'NEUTRAL').length;

  return (
    <div className="flex flex-col gap-6">
      {/* 시장 요약 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-emerald-950/40 border border-emerald-800/40 p-3 text-center">
          <div className="text-2xl font-black text-emerald-400">{buyCount}</div>
          <div className="text-xs text-zinc-500 mt-1">매수 신호</div>
        </div>
        <div className="rounded-xl bg-zinc-900 border border-zinc-700 p-3 text-center">
          <div className="text-2xl font-black text-zinc-400">{neutralCount}</div>
          <div className="text-xs text-zinc-500 mt-1">중립</div>
        </div>
        <div className="rounded-xl bg-rose-950/40 border border-rose-800/40 p-3 text-center">
          <div className="text-2xl font-black text-rose-400">{sellCount}</div>
          <div className="text-xs text-zinc-500 mt-1">매도 신호</div>
        </div>
      </div>

      {/* 메인 레이아웃 */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        {/* 왼쪽: 통화 목록 */}
        <div className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest px-1">
            통화별 신호
          </h2>
          {sorted.map(d => (
            <SignalCard
              key={d.currency}
              signal={d.signal}
              isSelected={d.currency === selected}
              onClick={() => setSelected(d.currency)}
            />
          ))}
        </div>

        {/* 오른쪽: 상세 패널 */}
        <div>
          {selectedData ? (
            <DetailPanel data={selectedData} />
          ) : (
            <div className="flex items-center justify-center h-64 text-zinc-600">
              왼쪽에서 통화를 선택하세요
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
