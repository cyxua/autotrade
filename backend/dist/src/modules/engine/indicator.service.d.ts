export interface Kline {
    openTime: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    closeTime: number;
    tradeCount: number;
}
export interface BBResult {
    upper: number;
    middle: number;
    lower: number;
}
export declare class IndicatorService {
    calcEMA(closes: number[], period: number): number;
    calcSMA(values: number[], period: number): number;
    calcRSI(closes: number[], period: number): number;
    calcBB(closes: number[], period: number, stdDev: number): BBResult;
    calcATR(highs: number[], lows: number[], closes: number[], period: number): number;
    closes(klines: Kline[]): number[];
    highs(klines: Kline[]): number[];
    lows(klines: Kline[]): number[];
    volumes(klines: Kline[]): number[];
    tradeCounts(klines: Kline[]): number[];
}
