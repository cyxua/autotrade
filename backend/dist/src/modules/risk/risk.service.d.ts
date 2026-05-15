import { PrismaService } from '../../prisma/prisma.service';
export declare class RiskService {
    private prisma;
    constructor(prisma: PrismaService);
    getConfig(userId: string): import(".prisma/client").Prisma.Prisma__RiskConfigClient<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        maxPositionRatioPct: number;
        maxTotalPositionRatioPct: number;
        maxLeverage: number;
        minLiqDistancePct: number;
        maxDailyLossUsdt: number;
        maxDailyTrades: number;
        consecutiveLossStop: number;
        volatilityPausePct: number;
        volatilityPauseMinutes: number;
        userId: string;
    }, null, import("@prisma/client/runtime/library").DefaultArgs>;
    updateConfig(userId: string, data: any): import(".prisma/client").Prisma.Prisma__RiskConfigClient<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        maxPositionRatioPct: number;
        maxTotalPositionRatioPct: number;
        maxLeverage: number;
        minLiqDistancePct: number;
        maxDailyLossUsdt: number;
        maxDailyTrades: number;
        consecutiveLossStop: number;
        volatilityPausePct: number;
        volatilityPauseMinutes: number;
        userId: string;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    getBlockLogs(userId: string, page?: number, limit?: number): Promise<{
        items: {
            symbol: string;
            id: string;
            createdAt: Date;
            userId: string;
            reason: string;
            strategyId: string | null;
            detail: import("@prisma/client/runtime/library").JsonValue | null;
        }[];
        total: number;
        page: number;
        limit: number;
    }>;
    logBlock(userId: string, strategyId: string | null, symbol: string, reason: string, detail?: any): import(".prisma/client").Prisma.Prisma__RiskBlockLogClient<{
        symbol: string;
        id: string;
        createdAt: Date;
        userId: string;
        reason: string;
        strategyId: string | null;
        detail: import("@prisma/client/runtime/library").JsonValue | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    resetDailyStats(userId: string): import(".prisma/client").Prisma.Prisma__EngineStateClient<{
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
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    resetConsecLoss(userId: string): import(".prisma/client").Prisma.Prisma__EngineStateClient<{
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
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
}
