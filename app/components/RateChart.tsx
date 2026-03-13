'use client';

import { useEffect, useRef } from 'react';
import { TradingSignal, StoredRateData } from '@/lib/signals';
import { sma } from '@/lib/indicators';

interface Props {
  candles: StoredRateData['rates'];
  signal: TradingSignal;
}

export default function RateChart({ candles, signal }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || candles.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const PAD = { top: 20, right: 16, bottom: 30, left: 56 };
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

    // 배경 그리드
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = PAD.top + (i / 4) * chartH;
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + chartW, y); ctx.stroke();
      const val = maxVal - (i / 4) * range;
      ctx.fillStyle = '#71717a';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(val.toFixed(1), PAD.left - 4, y + 4);
    }

    // 캔들스틱
    const candleW = Math.max(1, chartW / candles.length - 2);
    candles.forEach((c, i) => {
      const x = toX(i);
      const isUp = c.close >= c.open;
      ctx.strokeStyle = isUp ? '#10b981' : '#f43f5e';
      ctx.fillStyle = isUp ? '#10b981' : '#f43f5e';
      ctx.lineWidth = 1;

      // 심지
      ctx.beginPath();
      ctx.moveTo(x, toY(c.high));
      ctx.lineTo(x, toY(c.low));
      ctx.stroke();

      // 몸통
      const bodyTop = toY(Math.max(c.open, c.close));
      const bodyH = Math.max(1, Math.abs(toY(c.open) - toY(c.close)));
      ctx.fillRect(x - candleW / 2, bodyTop, candleW, bodyH);
    });

    // MA5
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ma5.forEach((v, i) => {
      if (isNaN(v)) return;
      i === 0 || isNaN(ma5[i - 1])
        ? ctx.moveTo(toX(i), toY(v))
        : ctx.lineTo(toX(i), toY(v));
    });
    ctx.stroke();

    // MA20
    ctx.strokeStyle = '#818cf8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ma20.forEach((v, i) => {
      if (isNaN(v)) return;
      i === 0 || isNaN(ma20[i - 1])
        ? ctx.moveTo(toX(i), toY(v))
        : ctx.lineTo(toX(i), toY(v));
    });
    ctx.stroke();

    // 현재 가격 라인
    ctx.strokeStyle = '#ffffff44';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    const curY = toY(signal.currentRate);
    ctx.beginPath(); ctx.moveTo(PAD.left, curY); ctx.lineTo(PAD.left + chartW, curY); ctx.stroke();
    ctx.setLineDash([]);

    // 범례
    const legends = [
      { color: '#f59e0b', label: 'MA5' },
      { color: '#818cf8', label: 'MA20' },
    ];
    legends.forEach((l, i) => {
      ctx.fillStyle = l.color;
      ctx.fillRect(PAD.left + i * 60, 4, 12, 4);
      ctx.fillStyle = '#a1a1aa';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(l.label, PAD.left + i * 60 + 14, 10);
    });

    // X축 날짜 (처음/중간/끝)
    ctx.fillStyle = '#71717a';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    const dateIndices = [0, Math.floor(candles.length / 2), candles.length - 1];
    dateIndices.forEach(i => {
      const d = candles[i]?.date;
      if (d) {
        const label = `${d.slice(4, 6)}/${d.slice(6, 8)}`;
        ctx.fillText(label, toX(i), H - 8);
      }
    });
  }, [candles, signal]);

  return (
    <canvas
      ref={canvasRef}
      width={640}
      height={240}
      className="w-full h-auto rounded-lg"
      style={{ background: '#09090b' }}
    />
  );
}
