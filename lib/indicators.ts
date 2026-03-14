/**
 * 기술적 분석 지표 계산 모듈
 * RSI, 이동평균(SMA/EMA), MACD, 볼린저 밴드
 */

/** 단순 이동평균 */
export function sma(values: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      const slice = values.slice(i - period + 1, i + 1);
      result.push(slice.reduce((a, b) => a + b, 0) / period);
    }
  }
  return result;
}

/** 지수 이동평균 */
export function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = [];
  let prev = NaN;

  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else if (i === period - 1) {
      // 첫 EMA = SMA
      const first = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
      result.push(first);
      prev = first;
    } else {
      const val = values[i] * k + prev * (1 - k);
      result.push(val);
      prev = val;
    }
  }
  return result;
}

/** RSI (Relative Strength Index) */
export function rsi(values: number[], period = 14): number[] {
  const result: number[] = new Array(values.length).fill(NaN);

  if (values.length < period + 1) return result;

  let avgGain = 0;
  let avgLoss = 0;

  // 첫 period 구간 평균 계산
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) avgGain += diff;
    else avgLoss += Math.abs(diff);
  }
  avgGain /= period;
  avgLoss /= period;

  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return result;
}

/** MACD (fast=12, slow=26, signal=9) */
export function macd(
  values: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): { macdLine: number[]; signalLine: number[]; histogram: number[] } {
  const fastEma = ema(values, fastPeriod);
  const slowEma = ema(values, slowPeriod);

  const macdLine = fastEma.map((f, i) =>
    isNaN(f) || isNaN(slowEma[i]) ? NaN : f - slowEma[i]
  );

  const validMacd = macdLine.filter(v => !isNaN(v));
  const signalRaw = ema(validMacd, signalPeriod);

  // signalLine을 macdLine과 같은 길이로 맞춤
  const signalLine: number[] = new Array(macdLine.length).fill(NaN);
  let sigIdx = 0;
  for (let i = 0; i < macdLine.length; i++) {
    if (!isNaN(macdLine[i])) {
      if (!isNaN(signalRaw[sigIdx])) signalLine[i] = signalRaw[sigIdx];
      sigIdx++;
    }
  }

  const histogram = macdLine.map((m, i) =>
    isNaN(m) || isNaN(signalLine[i]) ? NaN : m - signalLine[i]
  );

  return { macdLine, signalLine, histogram };
}

/** ADX (Average Directional Index) — Wilder smoothing */
export function adx(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14
): { adx: number[]; plusDI: number[]; minusDI: number[] } {
  const len = closes.length;
  const adxArr: number[] = new Array(len).fill(NaN);
  const plusDIArr: number[] = new Array(len).fill(NaN);
  const minusDIArr: number[] = new Array(len).fill(NaN);

  if (len < period * 2) return { adx: adxArr, plusDI: plusDIArr, minusDI: minusDIArr };

  // True Range, +DM, -DM
  const tr: number[] = [NaN];
  const plusDM: number[] = [NaN];
  const minusDM: number[] = [NaN];

  for (let i = 1; i < len; i++) {
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    const trueRange = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    tr.push(trueRange);
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }

  // Wilder smoothed ATR, +DM14, -DM14
  let smoothTR = tr.slice(1, period + 1).reduce((a, b) => a + b, 0);
  let smoothPlus = plusDM.slice(1, period + 1).reduce((a, b) => a + b, 0);
  let smoothMinus = minusDM.slice(1, period + 1).reduce((a, b) => a + b, 0);

  const calcDX = (p: number, m: number, t: number) => {
    const pdi = t === 0 ? 0 : (p / t) * 100;
    const mdi = t === 0 ? 0 : (m / t) * 100;
    const sum = pdi + mdi;
    return { pdi, mdi, dx: sum === 0 ? 0 : (Math.abs(pdi - mdi) / sum) * 100 };
  };

  const dxValues: number[] = [];

  for (let i = period; i < len; i++) {
    if (i > period) {
      smoothTR = smoothTR - smoothTR / period + tr[i];
      smoothPlus = smoothPlus - smoothPlus / period + plusDM[i];
      smoothMinus = smoothMinus - smoothMinus / period + minusDM[i];
    }
    const { pdi, mdi, dx } = calcDX(smoothPlus, smoothMinus, smoothTR);
    plusDIArr[i] = parseFloat(pdi.toFixed(4));
    minusDIArr[i] = parseFloat(mdi.toFixed(4));
    dxValues.push(dx);
  }

  // ADX = Wilder smoothed DX
  if (dxValues.length < period) return { adx: adxArr, plusDI: plusDIArr, minusDI: minusDIArr };

  let adxVal = dxValues.slice(0, period).reduce((a, b) => a + b, 0) / period;
  adxArr[period * 2 - 1] = parseFloat(adxVal.toFixed(4));

  for (let i = period; i < dxValues.length; i++) {
    adxVal = (adxVal * (period - 1) + dxValues[i]) / period;
    adxArr[period + i] = parseFloat(adxVal.toFixed(4));
  }

  return { adx: adxArr, plusDI: plusDIArr, minusDI: minusDIArr };
}

/** 볼린저 밴드 (period=20, stdDev=2) */
export function bollingerBands(
  values: number[],
  period = 20,
  multiplier = 2
): { upper: number[]; middle: number[]; lower: number[] } {
  const middle = sma(values, period);
  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = 0; i < values.length; i++) {
    if (isNaN(middle[i])) {
      upper.push(NaN);
      lower.push(NaN);
    } else {
      const slice = values.slice(i - period + 1, i + 1);
      const mean = middle[i];
      const std = Math.sqrt(slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period);
      upper.push(mean + multiplier * std);
      lower.push(mean - multiplier * std);
    }
  }

  return { upper, middle, lower };
}
