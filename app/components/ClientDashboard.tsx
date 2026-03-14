'use client';

import { useState, useRef } from 'react';
import { StoredRateData } from '@/lib/signals';
import { useLiveRates } from '@/app/hooks/useLiveRates';
import SignalCard from './SignalCard';
import DetailPanel from './DetailPanel';

interface Props {
  data: StoredRateData[];
}

function signalScore(d: StoredRateData) {
  return d.signal.score;
}

export default function ClientDashboard({ data }: Props) {
  const sorted = [...data].sort((a, b) => signalScore(b) - signalScore(a));
  const [selected, setSelected] = useState<string>(sorted[0]?.currency ?? '');
  const { rates: liveRates, updatedAt, error } = useLiveRates();
  const detailRef = useRef<HTMLDivElement>(null);

  const selectedData = data.find(d => d.currency === selected);

  const buyCount = data.filter(d => d.signal.signal === 'BUY').length;
  const sellCount = data.filter(d => d.signal.signal === 'SELL').length;
  const neutralCount = data.filter(d => d.signal.signal === 'NEUTRAL').length;

  function handleSelect(currency: string) {
    setSelected(currency);
    // 모바일에서 선택 시 상세 패널로 부드럽게 스크롤
    if (window.innerWidth < 1024) {
      setTimeout(() => {
        detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* 시장 요약 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-emerald-950/40 border border-emerald-900/50 p-3 text-center">
          <div className="text-2xl font-black text-emerald-400 tabular-nums">{buyCount}</div>
          <div className="text-xs text-zinc-500 mt-0.5">매수 신호</div>
        </div>
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-3 text-center">
          <div className="text-2xl font-black text-zinc-400 tabular-nums">{neutralCount}</div>
          <div className="text-xs text-zinc-500 mt-0.5">중립</div>
        </div>
        <div className="rounded-xl bg-rose-950/40 border border-rose-900/50 p-3 text-center">
          <div className="text-2xl font-black text-rose-400 tabular-nums">{sellCount}</div>
          <div className="text-xs text-zinc-500 mt-0.5">매도 신호</div>
        </div>
      </div>

      {/* 메인 레이아웃 */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
        {/* 왼쪽: 통화 목록 */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-1 mb-1">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
              통화별 신호
            </h2>
            {/* 실시간 연결 상태 — 카드 목록 헤더 우측 */}
            <div className="flex items-center gap-1.5">
              {liveRates ? (
                <>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {updatedAt && (
                    <span className="text-xs text-zinc-600">
                      {updatedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </>
              ) : error ? (
                <>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-zinc-600" />
                  <span className="text-xs text-zinc-600">저장 데이터</span>
                </>
              ) : (
                <>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-zinc-700 animate-pulse" />
                  <span className="text-xs text-zinc-600">연결 중</span>
                </>
              )}
            </div>
          </div>

          {sorted.map(d => (
            <SignalCard
              key={d.currency}
              signal={d.signal}
              liveRate={liveRates?.[d.currency]}
              isSelected={d.currency === selected}
              onClick={() => handleSelect(d.currency)}
            />
          ))}
        </div>

        {/* 오른쪽: 상세 패널 */}
        <div ref={detailRef} className="scroll-mt-20">
          {selectedData ? (
            <DetailPanel
              data={selectedData}
              liveRate={liveRates?.[selected]}
            />
          ) : (
            <div className="flex items-center justify-center h-64 text-zinc-700 text-sm">
              통화를 선택하세요
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
