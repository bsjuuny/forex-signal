'use client';

import { useState, useRef } from 'react';
import { StoredRateData } from '@/lib/signals';
import { useLiveRates } from '@/app/hooks/useLiveRates';
import SignalCard, { SwipeTab } from './SignalCard';
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
    if (window.innerWidth < 1024) {
      setTimeout(() => {
        detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
    }
  }

  /* 실시간 연결 상태 표시 (공통) */
  const liveStatus = (
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
  );

  return (
    <div className="flex flex-col gap-5">
      {/* 시장 요약 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-rose-950/40 border border-rose-900/50 p-3 text-center">
          <div className="text-2xl font-black text-rose-400 tabular-nums">{buyCount}</div>
          <div className="text-xs text-zinc-500 mt-0.5">매수 신호</div>
        </div>
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-3 text-center">
          <div className="text-2xl font-black text-zinc-400 tabular-nums">{neutralCount}</div>
          <div className="text-xs text-zinc-500 mt-0.5">중립</div>
        </div>
        <div className="rounded-xl bg-blue-950/40 border border-blue-900/50 p-3 text-center">
          <div className="text-2xl font-black text-blue-400 tabular-nums">{sellCount}</div>
          <div className="text-xs text-zinc-500 mt-0.5">매도 신호</div>
        </div>
      </div>

      {/* ── 모바일: sticky 수평 스와이프 탭 바 ── */}
      <div className="lg:hidden sticky top-14 z-10 -mx-4 px-4 py-2 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800/60">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">통화별 신호</span>
          {liveStatus}
        </div>
        <div className="flex gap-2 overflow-x-auto snap-x snap-mandatory pb-1 scrollbar-none"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {sorted.map(d => (
            <SwipeTab
              key={d.currency}
              signal={d.signal}
              liveRate={liveRates?.[d.currency]}
              isSelected={d.currency === selected}
              onClick={() => handleSelect(d.currency)}
            />
          ))}
        </div>
      </div>

      {/* ── 데스크탑: 세로 목록 + 상세 패널 나란히 ── */}
      <div className="hidden lg:grid lg:grid-cols-[300px_1fr] gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-1 mb-1">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">통화별 신호</h2>
            {liveStatus}
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
        <div>
          {selectedData ? (
            <DetailPanel data={selectedData} liveRate={liveRates?.[selected]} />
          ) : (
            <div className="flex items-center justify-center h-64 text-zinc-700 text-sm">
              통화를 선택하세요
            </div>
          )}
        </div>
      </div>

      {/* ── 모바일: 상세 패널 ── */}
      <div ref={detailRef} className="lg:hidden scroll-mt-4">
        {selectedData ? (
          <DetailPanel data={selectedData} liveRate={liveRates?.[selected]} />
        ) : (
          <div className="flex items-center justify-center h-40 text-zinc-700 text-sm">
            위에서 통화를 선택하세요
          </div>
        )}
      </div>
    </div>
  );
}
