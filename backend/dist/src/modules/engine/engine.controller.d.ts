import { EngineService } from './engine.service';
export declare class EngineController {
    private engine;
    constructor(engine: EngineService);
    getStatus(u: any): Promise<{
        success: boolean;
        data: {
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
                lastPnlSyncAt: Date | null;
            };
            activeStrategies: number;
        };
    }>;
    start(u: any): Promise<{
        success: boolean;
        data: {
            status: string;
            startedAt: Date;
        };
    }>;
    stop(u: any): Promise<{
        success: boolean;
        data: {
            status: string;
        };
    }>;
    emergencyStop(u: any, body: any): Promise<{
        success: boolean;
        data: {
            status: string;
            closePositionsRequested: boolean;
            positionsFound: number;
            closeAttempts: number;
            closeSuccess: number;
            canceledNormalOrders: number;
            canceledAlgoOrders: number;
            cancelErrors: {
                symbol: string;
                error: string;
            }[];
            closeErrors: {
                symbol: string;
                reason: string;
                message?: string;
                posAmt?: string;
                qty?: string;
            }[];
            positionFetchError: string;
        };
    }>;
    resetEmergency(u: any): Promise<{
        success: boolean;
        data: {
            status: string;
        };
    }>;
    closePosition(u: any, body: any): Promise<{
        success: boolean;
        data: {
            status: string;
            symbol?: undefined;
            quantity?: undefined;
            remaining?: undefined;
            message?: undefined;
        } | {
            status: string;
            symbol: string;
            quantity: string;
            remaining: string;
            message: string;
        };
    }>;
}
