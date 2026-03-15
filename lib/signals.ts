/**
 * 매수/매도 신호 생성 모듈
 * 여러 지표를 종합해 신호 강도를 점수화
 */

import { OHLCCandle } from './koreaexim-api';
import { rsi, ema, macd, bollingerBands, adx } from './indicators';
import { MacroData } from './macro-api';

export type SignalType = 'BUY' | 'SELL' | 'NEUTRAL';
export type SignalStrength = 'STRONG' | 'MODERATE' | 'WEAK';

/** 통화별 은행 환전 스프레드 (단방향 %, 매매기준율 대비) */
const CURRENCY_SPREAD: Record<string, number> = {
  USDKRW: 1.75,
  EURKRW: 1.75,
  JPYKRW: 1.75,
  GBPKRW: 1.75,
  CADKRW: 1.75,
  CNYKRW: 2.00,
  HKDKRW: 2.00,
};

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
  targetBuy: number;      // 목표 매수가 (매매기준율 기준)
  targetSell: number;     // 목표 매도가 (매매기준율 기준)
  stopLoss: number;       // 손절가
  spreadPct: number;      // 환전 스프레드 (단방향 %)
  effectiveBuyRate: number;   // 실제 매수 시 지불 환율 (수수료 포함)
  effectiveSellRate: number;  // 실제 매도 시 수령 환율 (수수료 포함)
  breakEvenPct: number;   // 손익분기 이동 필요량 (%)
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
  macro?: MacroData;
  updatedAt: string;
}

export type { MacroData };

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

/** 일봉 → 주봉 집계 */
function toWeeklyCandles(candles: OHLCCandle[]): OHLCCandle[] {
  if (candles.length === 0) return [];
  const weeks: OHLCCandle[] = [];
  let week: OHLCCandle | null = null;

  for (const c of candles) {
    const date = new Date(c.date);
    const day = date.getDay(); // 0=일, 1=월, ..., 5=금

    if (!week || day === 1) {
      if (week) weeks.push(week);
      week = { date: c.date, open: c.open, high: c.high, low: c.low, close: c.close };
    } else {
      week.high = Math.max(week.high, c.high);
      week.low = Math.min(week.low, c.low);
      week.close = c.close;
    }
  }
  if (week) weeks.push(week);
  return weeks;
}

/**
 * 캔들 데이터로 매수/매도 신호 계산
 */
export function calculateSignal(currency: string, candles: OHLCCandle[], macro?: MacroData | null): TradingSignal {
  const prices = closes(candles);
  const current = prices[prices.length - 1];
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
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

  // ── 5. ADX (14) — 추세 강도 필터 ──────────────
  // ADX < 20: 횡보장 → 기존 점수 감쇄 (추세 신호 신뢰도 낮음)
  const { adx: adxValues, plusDI, minusDI } = adx(highs, lows, prices, 14);
  const adxNow = adxValues.filter(v => !isNaN(v)).slice(-1)[0];
  if (!isNaN(adxNow)) {
    let adxSignal: SignalType;
    let adxDesc: string;
    let adxDampener = 1.0;

    if (adxNow < 20) {
      adxSignal = 'NEUTRAL';
      adxDesc = `횡보 (ADX ${adxNow.toFixed(1)} < 20) — 추세 신호 신뢰도 낮음`;
      adxDampener = 0.6; // 횡보장에서 기존 점수 40% 감쇄
    } else if (adxNow < 35) {
      adxSignal = 'NEUTRAL';
      adxDesc = `보통 추세 (ADX ${adxNow.toFixed(1)})`;
    } else {
      adxSignal = plusDI[plusDI.length - 1] > minusDI[minusDI.length - 1] ? 'BUY' : 'SELL';
      adxDesc = `강한 추세 (ADX ${adxNow.toFixed(1)}, +DI ${(plusDI[plusDI.length - 1] ?? 0).toFixed(1)} / -DI ${(minusDI[minusDI.length - 1] ?? 0).toFixed(1)})`;
    }

    // 횡보장이면 지금까지의 score를 감쇄
    if (adxDampener < 1.0) {
      score = Math.round(score * adxDampener);
    }

    indicators.push({ name: 'ADX(14)', value: adxNow, signal: adxSignal, description: adxDesc });
  }

  // ── 6. EMA(60) 장기 추세 필터 ─────────────────
  // (데이터가 ~90일이므로 EMA(200) 대신 EMA(60) 사용)
  const ema60 = ema(prices, 60);
  const e60 = ema60[ema60.length - 1];
  if (!isNaN(e60)) {
    const aboveLong = current > e60;
    const gap = ((current - e60) / e60) * 100;

    let e60Signal: SignalType;
    let e60Desc: string;
    let e60Score: number;

    if (aboveLong) {
      e60Signal = 'BUY';
      e60Score = 15;
      e60Desc = `장기 상승 추세 (현재 ${gap.toFixed(2)}% > EMA60)`;
    } else {
      e60Signal = 'SELL';
      e60Score = -15;
      e60Desc = `장기 하락 추세 (현재 ${Math.abs(gap).toFixed(2)}% < EMA60)`;
    }

    indicators.push({ name: 'EMA(60) 추세', value: gap, signal: e60Signal, description: e60Desc });
    score += e60Score;
  }

  // ── 7. 주봉 EMA(5/20) 다중 시간대 ───────────────
  const weekly = toWeeklyCandles(candles);
  if (weekly.length >= 20) {
    const wPrices = weekly.map(c => c.close);
    const wEma5 = ema(wPrices, 5);
    const wEma20 = ema(wPrices, 20);
    const we5 = wEma5[wEma5.length - 1];
    const we20 = wEma20[wEma20.length - 1];
    const we5Prev = wEma5[wEma5.length - 2];
    const we20Prev = wEma20[wEma20.length - 2];

    if (!isNaN(we5) && !isNaN(we20)) {
      const wCrossUp = we5Prev < we20Prev && we5 > we20;
      const wCrossDn = we5Prev > we20Prev && we5 < we20;
      const wAbove = we5 > we20;

      let wSignal: SignalType;
      let wDesc: string;
      let wScore: number;

      if (wCrossUp) {
        wSignal = 'BUY'; wScore = 25; wDesc = '주봉 골든크로스';
      } else if (wCrossDn) {
        wSignal = 'SELL'; wScore = -25; wDesc = '주봉 데드크로스';
      } else if (wAbove) {
        wSignal = 'BUY'; wScore = 15; wDesc = `주봉 단기 > 장기 (${we5.toFixed(1)} > ${we20.toFixed(1)})`;
      } else {
        wSignal = 'SELL'; wScore = -15; wDesc = `주봉 단기 < 장기 (${we5.toFixed(1)} < ${we20.toFixed(1)})`;
      }

      indicators.push({ name: 'Weekly EMA(5/20)', value: we5 - we20, signal: wSignal, description: wDesc });
      score += wScore;
    }
  }

  // ── 8. 신호 연속성 — 전일 방향 일치 보정 ──────────
  // 전일(마지막-1)을 기준으로 기본 지표(RSI+EMA+MACD+BB) 방향이 같으면 +10, 반대면 -10
  if (prices.length >= 2) {
    const prevPrices = prices.slice(0, -1);
    const prevHighs = highs.slice(0, -1);
    const prevLows = lows.slice(0, -1);

    let prevScore = 0;

    const prevRsi = rsi(prevPrices, 14);
    const prevRsiNow = prevRsi[prevRsi.length - 1];
    if (!isNaN(prevRsiNow)) {
      if (prevRsiNow < 30) prevScore += 30;
      else if (prevRsiNow < 40) prevScore += 15;
      else if (prevRsiNow > 70) prevScore -= 30;
      else if (prevRsiNow > 60) prevScore -= 15;
    }

    const pe5 = ema(prevPrices, 5);
    const pe20 = ema(prevPrices, 20);
    if (!isNaN(pe5[pe5.length - 1]) && !isNaN(pe20[pe20.length - 1])) {
      prevScore += pe5[pe5.length - 1] > pe20[pe20.length - 1] ? 10 : -10;
    }

    const { histogram: prevHist } = macd(prevPrices);
    const prevHistNow = prevHist[prevHist.length - 1];
    if (!isNaN(prevHistNow)) {
      prevScore += prevHistNow > 0 ? 10 : -10;
    }

    const sameDirection = (score > 0 && prevScore > 0) || (score < 0 && prevScore < 0);
    const continuityScore = sameDirection ? 10 : -10;
    const contSignal: SignalType = sameDirection ? (score > 0 ? 'BUY' : 'SELL') : 'NEUTRAL';

    indicators.push({
      name: '신호 연속성',
      value: prevScore,
      signal: contSignal,
      description: sameDirection
        ? `전일 방향 일치 (+${continuityScore})`
        : `전일 방향 반전 (${continuityScore})`,
    });
    score += continuityScore;
  }

  // ── 9. 거시 지표 (VIX / US10Y) ───────────────
  if (macro) {
    // VIX: 글로벌 공포지수 → KRW 약세/강세 판단
    let vixSignal: SignalType;
    let vixDesc: string;
    let vixScore: number;

    if (macro.vix > 30) {
      vixSignal = 'BUY'; vixScore = 20;
      vixDesc = `공포 구간 (VIX ${macro.vix.toFixed(1)}) — KRW 약세 압력`;
    } else if (macro.vix > 20) {
      vixSignal = 'BUY'; vixScore = 10;
      vixDesc = `리스크 오프 (VIX ${macro.vix.toFixed(1)}) — 외화 강세 우위`;
    } else if (macro.vix < 15) {
      vixSignal = 'SELL'; vixScore = -15;
      vixDesc = `리스크 온 (VIX ${macro.vix.toFixed(1)}) — KRW 강세 압력`;
    } else {
      vixSignal = 'NEUTRAL'; vixScore = 0;
      vixDesc = `VIX 중립 (${macro.vix.toFixed(1)})`;
    }

    indicators.push({ name: 'VIX 공포지수', value: macro.vix, signal: vixSignal, description: vixDesc });
    score += vixScore;

    // 미국채 10Y: USD/KRW 전용 (금리 ↑ = USD 강세)
    if (currency === 'USDKRW') {
      const yieldChange = macro.us10y - macro.us10yPrev;
      let yieldSignal: SignalType;
      let yieldDesc: string;
      let yieldScore: number;

      if (yieldChange > 0.1) {
        yieldSignal = 'BUY'; yieldScore = 15;
        yieldDesc = `미국채 10Y 금리 상승 (+${yieldChange.toFixed(2)}%) → USD 강세`;
      } else if (yieldChange < -0.1) {
        yieldSignal = 'SELL'; yieldScore = -15;
        yieldDesc = `미국채 10Y 금리 하락 (${yieldChange.toFixed(2)}%) → USD 약세`;
      } else {
        yieldSignal = 'NEUTRAL'; yieldScore = 0;
        yieldDesc = `미국채 10Y 보합 (현재 ${macro.us10y.toFixed(2)}%)`;
      }

      indicators.push({ name: 'US10Y 국채금리', value: macro.us10y, signal: yieldSignal, description: yieldDesc });
      score += yieldScore;
    }
  }

  // ── 10. 갭 감지 (주말/공휴일 후 시가 괴리) ────────
  if (candles.length >= 2) {
    const today = candles[candles.length - 1];
    const prev  = candles[candles.length - 2];

    // 날짜 차이(일) 계산
    const todayDate = new Date(
      `${today.date.slice(0,4)}-${today.date.slice(4,6)}-${today.date.slice(6,8)}`
    );
    const prevDate = new Date(
      `${prev.date.slice(0,4)}-${prev.date.slice(4,6)}-${prev.date.slice(6,8)}`
    );
    const dayDiff = Math.round((todayDate.getTime() - prevDate.getTime()) / 86400000);
    const isWeekendGap = dayDiff >= 3; // 금요일→월요일(3일) 또는 공휴일 연휴

    const gapPct = prev.close > 0 ? ((today.open - prev.close) / prev.close) * 100 : 0;

    let gapSignal: SignalType = 'NEUTRAL';
    let gapScore = 0;
    let gapDesc = '';

    const gapLabel = isWeekendGap ? '주말 갭' : '갭';

    if (gapPct > 1.0) {
      gapSignal = 'BUY'; gapScore = 20;
      gapDesc = `${gapLabel} 상승 +${gapPct.toFixed(2)}% — 강한 매수 압력`;
    } else if (gapPct > 0.5) {
      gapSignal = 'BUY'; gapScore = 10;
      gapDesc = `${gapLabel} 상승 +${gapPct.toFixed(2)}%`;
    } else if (gapPct < -1.0) {
      gapSignal = 'SELL'; gapScore = -20;
      gapDesc = `${gapLabel} 하락 ${gapPct.toFixed(2)}% — 강한 매도 압력`;
    } else if (gapPct < -0.5) {
      gapSignal = 'SELL'; gapScore = -10;
      gapDesc = `${gapLabel} 하락 ${gapPct.toFixed(2)}%`;
    } else {
      gapDesc = `갭 없음 (${gapPct >= 0 ? '+' : ''}${gapPct.toFixed(2)}%)`;
    }

    if (gapScore !== 0 || isWeekendGap) {
      indicators.push({
        name: isWeekendGap ? '주말 갭' : '갭',
        value: gapPct,
        signal: gapSignal,
        description: gapDesc,
      });
      score += gapScore;
    }
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

  // ── 환전 수수료 계산 ──────────────────────────
  const spreadPct = CURRENCY_SPREAD[currency] ?? 1.75;
  // 매수 시: 은행이 기준율보다 높게 팔므로 (기준율 × (1 + spread))
  const effectiveBuyRate = current * (1 + spreadPct / 100);
  // 매도 시: 은행이 기준율보다 낮게 사므로 (기준율 × (1 - spread))
  const effectiveSellRate = current * (1 - spreadPct / 100);
  // 손익분기: 왕복 수수료를 넘어야 이익 (단방향 spread × 2)
  const breakEvenPct = spreadPct * 2;

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
    spreadPct,
    effectiveBuyRate: parseFloat(effectiveBuyRate.toFixed(2)),
    effectiveSellRate: parseFloat(effectiveSellRate.toFixed(2)),
    breakEvenPct: parseFloat(breakEvenPct.toFixed(2)),
    calculatedAt: new Date().toISOString(),
  };
}
