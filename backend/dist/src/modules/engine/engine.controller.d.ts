import { EngineService } from './engine.service';
export declare class EngineController {
    private engine;
    constructor(engine: EngineService);
    getStatus(u: any): Promise<{
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
            canceledOrders: number;
            closedPositions: number;
        };
    }>;
}
