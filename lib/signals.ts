/**
 * 매수/매도 신호 생성 모듈
 * 여러 지표를 종합해 신호 강도를 점수화
 */

import { OHLCCandle } from './koreaexim-api';
import { rsi, ema, macd, bollingerBands } from './indicators';

export type SignalType = 'BUY' | 'SELL' | 'NEUTRAL';
export type SignalStrength = 'STRONG' | 'MODERATE' | 'WEAK';

export interface IndicatorSignal {
  name: string;
  value: number;
  signal: SignalType;
  description: string;
}

export interface TradingSignal {
  currency: string;
  signal: SignalType;
  strength: SignalStrength;
  score: number;          // -100 ~ +100 (양수 = 매수, 음수 = 매도)
  indicators: IndicatorSignal[];
  currentRate: number;
  targetBuy: number;      // 목표 매수가
  targetSell: number;     // 목표 매도가
  stopLoss: number;       // 손절가
  calculatedAt: string;
}

export interface StoredRateData {
  currency: string;
  rates: Array<{
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
  }>;
  signal: TradingSignal;
  updatedAt: string;
}

/** 종가 배열 추출 */
function closes(candles: OHLCCandle[]): number[] {
  return candles.map(c => c.close);
}

/** 신호 점수 → 타입/강도 변환 */
function scoreToSignal(score: number): { signal: SignalType; strength: SignalStrength } {
  const abs = Math.abs(score);
  const signal: SignalType = score >= 15 ? 'BUY' : score <= -15 ? 'SELL' : 'NEUTRAL';
  const strength: SignalStrength = abs >= 60 ? 'STRONG' : abs >= 30 ? 'MODERATE' : 'WEAK';
  return { signal, strength };
}

/**
 * 캔들 데이터로 매수/매도 신호 계산
 */
export function calculateSignal(currency: string, candles: OHLCCandle[]): TradingSignal {
  const prices = closes(candles);
  const current = prices[prices.length - 1];
  const indicators: IndicatorSignal[] = [];
  let score = 0;

  // ── 1. RSI (14) ─────────────────────────────
  const rsiValues = rsi(prices, 14);
  const rsiNow = rsiValues[rsiValues.length - 1];
  if (!isNaN(rsiNow)) {
    let rsiSignal: SignalType;
    let rsiDesc: string;
    let rsiScore: number;

    if (rsiNow < 30) {
      rsiSignal = 'BUY'; rsiScore = 30; rsiDesc = `과매도 (${rsiNow.toFixed(1)})`;
    } else if (rsiNow < 40) {
      rsiSignal = 'BUY'; rsiScore = 15; rsiDesc = `약한 과매도 (${rsiNow.toFixed(1)})`;
    } else if (rsiNow > 70) {
      rsiSignal = 'SELL'; rsiScore = -30; rsiDesc = `과매수 (${rsiNow.toFixed(1)})`;
    } else if (rsiNow > 60) {
      rsiSignal = 'SELL'; rsiScore = -15; rsiDesc = `약한 과매수 (${rsiNow.toFixed(1)})`;
    } else {
      rsiSignal = 'NEUTRAL'; rsiScore = 0; rsiDesc = `중립 (${rsiNow.toFixed(1)})`;
    }

    indicators.push({ name: 'RSI(14)', value: rsiNow, signal: rsiSignal, description: rsiDesc });
    score += rsiScore;
  }

  // ── 2. EMA 크로스 (5/20) ──────────────────────
  const ema5 = ema(prices, 5);
  const ema20 = ema(prices, 20);
  const e5 = ema5[ema5.length - 1];
  const e20 = ema20[ema20.length - 1];
  const e5Prev = ema5[ema5.length - 2];
  const e20Prev = ema20[ema20.length - 2];

  if (!isNaN(e5) && !isNaN(e20)) {
    const crossedUp = e5Prev < e20Prev && e5 > e20;   // 골든크로스
    const crossedDn = e5Prev > e20Prev && e5 < e20;   // 데드크로스
    const above = e5 > e20;

    let emaSignal: SignalType;
    let emaDesc: string;
    let emaScore: number;

    if (crossedUp) {
      emaSignal = 'BUY'; emaScore = 25; emaDesc = '골든크로스 발생';
    } else if (crossedDn) {
      emaSignal = 'SELL'; emaScore = -25; emaDesc = '데드크로스 발생';
    } else if (above) {
      emaSignal = 'BUY'; emaScore = 10; emaDesc = `단기 > 장기 (${e5.toFixed(1)} > ${e20.toFixed(1)})`;
    } else {
      emaSignal = 'SELL'; emaScore = -10; emaDesc = `단기 < 장기 (${e5.toFixed(1)} < ${e20.toFixed(1)})`;
    }

    indicators.push({ name: 'EMA(5/20)', value: e5 - e20, signal: emaSignal, description: emaDesc });
    score += emaScore;
  }

  // ── 3. MACD (12/26/9) ─────────────────────────
  const { macdLine, signalLine, histogram } = macd(prices);
  const macdNow = macdLine[macdLine.length - 1];
  const sigNow = signalLine[signalLine.length - 1];
  const histNow = histogram[histogram.length - 1];
  const histPrev = histogram[histogram.length - 2];

  if (!isNaN(macdNow) && !isNaN(sigNow)) {
    const crossedUp = histPrev < 0 && histNow >= 0;
    const crossedDn = histPrev > 0 && histNow <= 0;

    let macdSignal: SignalType;
    let macdDesc: string;
    let macdScore: number;

    if (crossedUp) {
      macdSignal = 'BUY'; macdScore = 25; macdDesc = 'MACD 매수 크로스';
    } else if (crossedDn) {
      macdSignal = 'SELL'; macdScore = -25; macdDesc = 'MACD 매도 크로스';
    } else if (histNow > 0) {
      macdSignal = 'BUY'; macdScore = 10; macdDesc = `히스토그램 양(+${histNow.toFixed(2)})`;
    } else {
      macdSignal = 'SELL'; macdScore = -10; macdDesc = `히스토그램 음(${histNow.toFixed(2)})`;
    }

    indicators.push({ name: 'MACD(12/26/9)', value: histNow, signal: macdSignal, description: macdDesc });
    score += macdScore;
  }

  // ── 4. 볼린저 밴드 (20/2) ─────────────────────
  const { upper, middle, lower } = bollingerBands(prices, 20, 2);
  const bbUpper = upper[upper.length - 1];
  const bbMiddle = middle[middle.length - 1];
  const bbLower = lower[lower.length - 1];

  if (!isNaN(bbUpper)) {
    const bandwidth = bbUpper - bbLower;
    const position = (current - bbLower) / bandwidth; // 0=하단, 1=상단

    let bbSignal: SignalType;
    let bbDesc: string;
    let bbScore: number;

    if (position < 0.1) {
      bbSignal = 'BUY'; bbScore = 20; bbDesc = `하단 터치 (현재: ${current.toFixed(1)}, 하단: ${bbLower.toFixed(1)})`;
    } else if (position < 0.3) {
      bbSignal = 'BUY'; bbScore = 10; bbDesc = `하단 근접 (위치: ${(position * 100).toFixed(0)}%)`;
    } else if (position > 0.9) {
      bbSignal = 'SELL'; bbScore = -20; bbDesc = `상단 터치 (현재: ${current.toFixed(1)}, 상단: ${bbUpper.toFixed(1)})`;
    } else if (position > 0.7) {
      bbSignal = 'SELL'; bbScore = -10; bbDesc = `상단 근접 (위치: ${(position * 100).toFixed(0)}%)`;
    } else {
      bbSignal = 'NEUTRAL'; bbScore = 0; bbDesc = `중간 구간 (위치: ${(position * 100).toFixed(0)}%)`;
    }

    indicators.push({ name: 'Bollinger(20/2)', value: position, signal: bbSignal, description: bbDesc });
    score += bbScore;
  }

  // ── 목표가 계산 ──────────────────────────────
  const atr = prices.slice(-14).reduce((acc, p, i, arr) => {
    if (i === 0) return acc;
    return acc + Math.abs(p - arr[i - 1]);
  }, 0) / 13; // 14일 평균 변동폭(ATR 근사)

  const { signal, strength } = scoreToSignal(score);
  const targetBuy = current - atr * 1.5;
  const targetSell = current + atr * 2.0;
  const stopLoss = signal === 'BUY' ? current - atr * 1.0 : current + atr * 1.0;

  return {
    currency,
    signal,
    strength,
    score: Math.max(-100, Math.min(100, score)),
    indicators,
    currentRate: current,
    targetBuy: parseFloat(targetBuy.toFixed(2)),
    targetSell: parseFloat(targetSell.toFixed(2)),
    stopLoss: parseFloat(stopLoss.toFixed(2)),
    calculatedAt: new Date().toISOString(),
  };
}
