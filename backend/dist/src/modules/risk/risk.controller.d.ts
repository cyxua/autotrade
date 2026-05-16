import { RiskService } from './risk.service';
export declare class RiskController {
    private svc;
    constructor(svc: RiskService);
    get(u: any): Promise<{
        success: boolean;
        data: {
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
        };
    }>;
    update(u: any, body: any): Promise<{
        success: boolean;
        data: {
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
        };
    }>;
    logs(u: any, p?: string, l?: string): Promise<{
        success: boolean;
        data: {
            items: {
                symbol: string;
                id: string;
                createdAt: Date;
                userId: string;
                strategyId: string | null;
                reason: string;
                detail: import("@prisma/client/runtime/library").JsonValue | null;
            }[];
            total: number;
            page: number;
            limit: number;
        };
    }>;
    resetDaily(u: any): Promise<{
        success: boolean;
        data: {
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
    }>;
    resetConsec(u: any): Promise<{
        success: boolean;
        data: {
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
    }>;
}
