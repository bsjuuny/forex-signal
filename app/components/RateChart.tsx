'use client';

import { useEffect, useRef } from 'react';
import { TradingSignal, StoredRateData } from '@/lib/signals';
import { sma } from '@/lib/indicators';

interface Props {
  candles: StoredRateData['rates'];
  signal: TradingSignal;
}

const LEGEND = [
  { color: '#f59e0b', label: 'MA5' },
  { color: '#818cf8', label: 'MA20' },
];

export default function RateChart({ candles, signal }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || candles.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Retina / HiDPI 대응
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || 640;
    const cssH = canvas.clientHeight || 220;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    ctx.scale(dpr, dpr);

    const W = cssW;
    const H = cssH;
    const PAD = { top: 16, right: 16, bottom: 28, left: 58 };
    const chartW = W - PAD.left - PAD.right;
    const chartH = H - PAD.top - PAD.bottom;

    ctx.clearRect(0, 0, W, H);

    const closes = candles.map(c => c.close);
    const ma5 = sma(closes, 5);
    const ma20 = sma(closes, 20);

    const minVal = Math.min(...candles.map(c => c.low)) * 0.999;
    const maxVal = Math.max(...candles.map(c => c.high)) * 1.001;
    const range = maxVal - minVal;

    const toX = (i: number) => PAD.left + (i / (candles.length - 1)) * chartW;
    const toY = (v: number) => PAD.top + (1 - (v - minVal) / range) * chartH;

    // 그리드
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = PAD.top + (i / 4) * chartH;
      ctx.beginPath();
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(PAD.left + chartW, y);
      ctx.stroke();
      const val = maxVal - (i / 4) * range;
      ctx.fillStyle = '#52525b';
      ctx.font = `${10 * Math.min(dpr, 1)}px monospace`;
      ctx.textAlign = 'right';
      ctx.fillText(val.toLocaleString('ko-KR', { maximumFractionDigits: 1 }), PAD.left - 5, y + 3.5);
    }

    // 캔들스틱
    const candleW = Math.max(1.5, chartW / candles.length - 1.5);
    candles.forEach((c, i) => {
      const x = toX(i);
      const isUp = c.close >= c.open;
      ctx.strokeStyle = isUp ? '#10b981' : '#f43f5e';
      ctx.fillStyle = isUp ? '#10b981' : '#f43f5e';
      ctx.lineWidth = 1;

      ctx.beginPath();
      ctx.moveTo(x, toY(c.high));
      ctx.lineTo(x, toY(c.low));
      ctx.stroke();

      const bodyTop = toY(Math.max(c.open, c.close));
      const bodyH = Math.max(1.5, Math.abs(toY(c.open) - toY(c.close)));
      ctx.fillRect(x - candleW / 2, bodyTop, candleW, bodyH);
    });

    // MA5
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ma5.forEach((v, i) => {
      if (isNaN(v)) return;
      i === 0 || isNaN(ma5[i - 1]) ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v));
    });
    ctx.stroke();

    // MA20
    ctx.strokeStyle = '#818cf8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ma20.forEach((v, i) => {
      if (isNaN(v)) return;
      i === 0 || isNaN(ma20[i - 1]) ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v));
    });
    ctx.stroke();

    // 현재가 점선
    ctx.strokeStyle = '#ffffff30';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    const curY = toY(signal.currentRate);
    ctx.beginPath();
    ctx.moveTo(PAD.left, curY);
    ctx.lineTo(PAD.left + chartW, curY);
    ctx.stroke();
    ctx.setLineDash([]);

    // X축 — 월별 첫 영업일 표시
    ctx.fillStyle = '#52525b';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    let lastMonth = '';
    candles.forEach((c, i) => {
      const month = c.date.slice(4, 6);
      if (month !== lastMonth) {
        lastMonth = month;
        const label = `${parseInt(c.date.slice(4, 6))}월`;
        const x = toX(i);
        // 가장자리 클리핑 방지
        if (x > PAD.left + 12 && x < PAD.left + chartW - 12) {
          ctx.fillText(label, x, H - 6);
        }
      }
    });
  }, [candles, signal]);

  return (
    <div>
      {/* 범례 — 차트 외부 상단 */}
      <div className="flex items-center gap-4 px-4 pt-3 pb-1">
        <span className="text-xs text-zinc-500 font-medium">90일 환율 추이</span>
        <div className="flex items-center gap-3 ml-auto">
          {LEGEND.map(l => (
            <div key={l.label} className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-0.5 rounded-full" style={{ backgroundColor: l.color }} />
              <span className="text-xs text-zinc-500">{l.label}</span>
            </div>
          ))}
        </div>
      </div>
      <canvas
        ref={canvasRef}
        className="w-full block"
        style={{ height: '220px', background: 'transparent' }}
      />
    </div>
  );
}
