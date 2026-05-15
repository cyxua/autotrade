import { PrismaService } from '../../prisma/prisma.service';
import { BinanceService } from '../binance/binance.service';
import { StrategyEngineService } from './strategy-engine.service';
export declare class EngineService {
    private prisma;
    private binance;
    private strategyEngine;
    private readonly logger;
    constructor(prisma: PrismaService, binance: BinanceService, strategyEngine: StrategyEngineService);
    getStatus(userId: string): Promise<{
        state: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            status: import(".prisma/client").$Enums.EngineStatus;
            startedAt: Date | null;
            stoppedAt: Date | null;
            stopReason: string | null;
            dailyPnl: number;
            dailyTrades: number;
            dailyLossDate: Date | null;
            consecLossCount: number;
        };
        activeStrategies: number;
    }>;
    start(userId: string): Promise<{
        status: string;
        startedAt: Date;
    }>;
    stop(userId: string, reason?: string): Promise<{
        status: string;
    }>;
    emergencyStop(userId: string, closePositions?: boolean): Promise<{
        status: string;
        canceledOrders: number;
        closedPositions: number;
        positionError: string;
    }>;
    resetEmergencyStop(userId: string): Promise<{
        status: string;
    }>;
    closePosition(userId: string, symbol: string): Promise<{
        status: string;
        symbol?: undefined;
        quantity?: undefined;
    } | {
        status: string;
        symbol: string;
        quantity: string;
    }>;
}
