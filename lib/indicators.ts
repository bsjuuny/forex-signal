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
