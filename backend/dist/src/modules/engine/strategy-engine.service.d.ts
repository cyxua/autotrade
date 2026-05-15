import { PrismaService } from '../../prisma/prisma.service';
import { BinanceService } from '../binance/binance.service';
export declare class StrategyEngineService {
    private prisma;
    private binance;
    private readonly logger;
    private timers;
    constructor(prisma: PrismaService, binance: BinanceService);
    startEngine(userId: string): Promise<void>;
    stopEngine(userId: string): void;
    private haltEngine;
    private scanStrategies;
    private riskGuard;
    private processStrategy;
    private placeOrder;
    private placeTpSl;
    private calcRSI;
    private calcEMA;
}
