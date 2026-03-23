'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'fx-signal-disclaimer-agreed-v1';

export default function DisclaimerModal() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setShow(true);
    }
  }, []);

  function handleAgree() {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-700 p-6 space-y-5 shadow-2xl">
        {/* 헤더 */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 text-lg shrink-0">
            ⚠
          </div>
          <div>
            <h2 className="text-base font-bold text-white">이용 전 반드시 확인하세요</h2>
            <p className="text-xs text-zinc-500 mt-0.5">서비스 이용약관 및 투자 위험 고지</p>
          </div>
        </div>

        {/* 본문 */}
        <div className="space-y-3 text-xs text-zinc-400 leading-relaxed">
          <div className="rounded-lg bg-zinc-800/60 border border-zinc-700/50 p-3 space-y-2">
            <p className="font-bold text-zinc-200">📌 본 서비스는 투자자문이 아닙니다</p>
            <p>
              FX Signal은 <span className="text-white font-semibold">금융위원회에 투자자문업 등록이 되어 있지 않은 기술적 분석 정보 제공 서비스</span>입니다.
              금융투자상품의 거래를 권유하거나 중개하지 않습니다.
            </p>
          </div>

          <div className="rounded-lg bg-zinc-800/60 border border-zinc-700/50 p-3 space-y-2">
            <p className="font-bold text-zinc-200">📌 투자 손실 책임</p>
            <p>
              본 서비스에서 제공하는 신호·지표·분석은 <span className="text-white font-semibold">투자 참고 자료에 불과</span>하며,
              이를 근거로 한 투자 결정 및 손실에 대해 서비스 운영자는 <span className="text-white font-semibold">어떠한 법적 책임도 지지 않습니다.</span>
            </p>
          </div>

          <div className="rounded-lg bg-zinc-800/60 border border-zinc-700/50 p-3 space-y-2">
            <p className="font-bold text-zinc-200">📌 데이터 정확성</p>
            <p>
              환율 데이터 및 기술적 지표는 오류가 있을 수 있으며, 실제 시장 환율과 차이가 있을 수 있습니다.
              실제 거래 시 반드시 금융기관의 공시 환율을 기준으로 하시기 바랍니다.
            </p>
          </div>
        </div>

        {/* 동의 버튼 */}
        <div className="space-y-2">
          <button
            onClick={handleAgree}
            className="w-full py-3 rounded-xl bg-white text-zinc-900 font-bold text-sm hover:bg-zinc-100 transition-colors"
          >
            위 내용을 이해했으며 동의합니다
          </button>
          <p className="text-center text-[10px] text-zinc-600">
            동의 시 해당 내용을 확인한 것으로 기록됩니다
          </p>
        </div>
      </div>
    </div>
  );
}
