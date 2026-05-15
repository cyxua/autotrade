import { PrismaService } from '../../prisma/prisma.service';
export declare class DashboardController {
    private prisma;
    constructor(prisma: PrismaService);
    summary(u: any): Promise<{
        success: boolean;
        data: {
            engine: {
                status: import(".prisma/client").$Enums.EngineStatus;
                tradingMode: import(".prisma/client").$Enums.TradingMode;
                dailyPnl: number;
                dailyTrades: number;
                consecLossCount: number;
            };
            positions: {
                count: number;
                totalUnrealizedPnl: number;
            };
            strategies: {
                total: number;
                enabled: number;
            };
            todayStats: {
                realizedPnl: number;
                trades: number;
                winRate: number;
            };
        };
    }>;
}
