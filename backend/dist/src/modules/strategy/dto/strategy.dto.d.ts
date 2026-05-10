export declare class CreateStrategyDto {
    name: string;
    type: string;
    symbol: string;
    timeframe: string;
    positionSizeUsdt: number;
    leverage: number;
    marginType: string;
    allowLong: boolean;
    allowShort: boolean;
    takeProfitPct: number;
    stopLossPct: number;
    trailingStopPct: number;
    maxPositions: number;
    maxDailyLoss: number;
    maxDailyTrades: number;
    stopOnConsecLoss: number;
    params?: Record<string, any>;
}
