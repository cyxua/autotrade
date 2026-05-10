import { PrismaService } from '../../prisma/prisma.service';
import { BinanceService } from '../binance/binance.service';
export declare class EngineService {
    private prisma;
    private binance;
    private readonly logger;
    constructor(prisma: PrismaService, binance: BinanceService);
    getStatus(userId: string): Promise<{
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
    }>;
}
