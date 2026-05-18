import { PrismaService } from '../../prisma/prisma.service';
import { BinanceService } from '../binance/binance.service';
export interface TradingHealthFlags {
    isSafeToStartAutoTrade: boolean;
    hasOpenPosition: boolean;
    hasOpenOrders: boolean;
    hasOpenAlgoOrders: boolean;
    hasUnprotectedPosition: boolean;
    hasCriticalRiskBlock: boolean;
    criticalWindowMinutes: number;
    scannedSymbols: number;
    fetchErrors: string[];
}
export interface TradingHealthResult {
    flags: TradingHealthFlags;
    positions: any[];
    openOrders: any[];
    openAlgoOrders: any[];
}
export declare class TradingHealthService {
    private prisma;
    private binance;
    private readonly logger;
    constructor(prisma: PrismaService, binance: BinanceService);
    getTradingHealth(userId: string): Promise<TradingHealthResult>;
}
