'use client';

import { useState, useEffect } from 'react';

function WeekendNotice() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full text-center flex flex-col items-center gap-6">
        <div className="text-7xl">🏖️</div>

        <div>
          <h1 className="text-2xl font-black mb-2">주말에는 쉬어가요</h1>
          <p className="text-zinc-400 leading-relaxed">
            한국수출입은행 환율 API는 영업일(월~금)에만 데이터를 제공합니다.
            <br />
            주말에는 데이터 수집 및 신호 분석을 하지 않습니다.
          </p>
        </div>

        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5 w-full text-left">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">
            다음 업데이트
          </p>
          <div className="flex flex-col gap-2 text-sm text-zinc-300">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400">●</span>
              월요일 오전 9시 (KST) 이후 데이터 수집 시작
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-400">●</span>
              오전 11시 이후 당일 환율 데이터 반영
            </div>
          </div>
        </div>

        <p className="text-xs text-zinc-600">
          💱 FX Signal · 평일 매 3시간마다 자동 업데이트
        </p>
      </div>
    </main>
  );
}

interface Props {
  children: React.ReactNode;
}

export default function WeekendGate({ children }: Props) {
  const [isWeekend, setIsWeekend] = useState<boolean | null>(null);

  useEffect(() => {
    const day = new Date().getDay(); // 0=일, 6=토
    setIsWeekend(day === 0 || day === 6);
  }, []);

  if (isWeekend === null) return null;
  if (isWeekend) return <WeekendNotice />;
  return <>{children}</>;
}
