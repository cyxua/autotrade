import { Injectable } from '@nestjs/common';

export interface Kline {
  openTime: number;
  open:     number;
  high:     number;
  low:      number;
  close:    number;
  volume:   number;
  closeTime:number;
}

export interface BBResult {
  upper:  number;
  middle: number;
  lower:  number;
}

@Injectable()
export class IndicatorService {

  calcEMA(closes: number[], period: number): number {
    if (closes.length === 0) return 0;
    if (closes.length < period) return closes.at(-1) ?? 0;
    const k = 2 / (period + 1);
    let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < closes.length; i++) {
      ema = closes[i] * k + ema * (1 - k);
    }
    return ema;
  }

  calcSMA(values: number[], period: number): number {
    if (values.length === 0) return 0;
    const slice = values.slice(-Math.min(period, values.length));
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  }

  calcRSI(closes: number[], period: number): number {
    if (closes.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = closes.length - period; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff > 0) gains += diff; else losses -= diff;
    }
    const rs = gains / (losses || 0.0001);
    return 100 - 100 / (1 + rs);
  }

  calcBB(closes: number[], period: number, stdDev: number): BBResult {
    if (closes.length < period) {
      const last = closes.at(-1) ?? 0;
      return { upper: last, middle: last, lower: last };
    }
    const slice  = closes.slice(-period);
    const middle = slice.reduce((a, b) => a + b, 0) / period;
    const std    = Math.sqrt(slice.reduce((s, v) => s + (v - middle) ** 2, 0) / period);
    return { upper: middle + stdDev * std, middle, lower: middle - stdDev * std };
  }

  calcATR(highs: number[], lows: number[], closes: number[], period: number): number {
    if (highs.length < period + 1) return 0;
    const trs: number[] = [];
    for (let i = highs.length - period; i < highs.length; i++) {
      const prevClose = closes[i - 1];
      trs.push(Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - prevClose),
        Math.abs(lows[i]  - prevClose),
      ));
    }
    return trs.reduce((a, b) => a + b, 0) / trs.length;
  }

  // klines 배열에서 추출 헬퍼
  closes(klines: Kline[]):  number[] { return klines.map(k => k.close);  }
  highs(klines: Kline[]):   number[] { return klines.map(k => k.high);   }
  lows(klines: Kline[]):    number[] { return klines.map(k => k.low);    }
  volumes(klines: Kline[]): number[] { return klines.map(k => k.volume); }
}
