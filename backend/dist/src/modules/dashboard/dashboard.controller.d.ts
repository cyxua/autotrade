import { PrismaService } from '../../prisma/prisma.service';
import { BinanceService } from '../binance/binance.service';
export declare class DashboardController {
    private prisma;
    private binance;
    constructor(prisma: PrismaService, binance: BinanceService);
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
    tradingHealth(u: any): Promise<{
        success: boolean;
        data: {
            engineState: {
                status: import(".prisma/client").$Enums.EngineStatus;
                dailyTrades: number;
                dailyPnl: number;
                consecLossCount: number;
                stopReason: string;
            };
            currentPositions: any[];
            openOrders: any[];
            openAlgoOrders: any[];
            recentBotOrders: {
                symbol: string;
                id: string;
                createdAt: Date;
                status: import(".prisma/client").$Enums.OrderStatus;
                side: import(".prisma/client").$Enums.OrderSide;
                quantity: number;
                binanceOrderId: string;
                orderType: import(".prisma/client").$Enums.OrderType;
                stopPrice: number;
                avgFillPrice: number;
                entryReason: string;
                exitReason: string;
                filledAt: Date;
            }[];
            recentRiskBlocks: {
                symbol: string;
                id: string;
                createdAt: Date;
                reason: string;
                detail: import("@prisma/client/runtime/library").JsonValue;
            }[];
            healthFlags: {
                hasOpenPosition: boolean;
                hasOpenAlgoOrders: boolean;
                hasUnprotectedPosition: boolean;
                unprotectedPositions: any[];
                hasCriticalRiskBlock: boolean;
                criticalBlockReasons: {
                    reason: string;
                    symbol: string;
                    createdAt: Date;
                }[];
                criticalWindowMinutes: number;
                isSafeToStartAutoTrade: boolean;
                fetchErrors: string[];
            };
        };
    }>;
}
