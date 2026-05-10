import { StrategyService } from './strategy.service';
import { CreateStrategyDto } from './dto/strategy.dto';
export declare class StrategyController {
    private svc;
    constructor(svc: StrategyService);
    list(u: any, enabled?: string): Promise<{
        success: boolean;
        data: {
            symbol: string;
            params: import("@prisma/client/runtime/library").JsonValue;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            maxDailyTrades: number;
            userId: string;
            enabled: boolean;
            leverage: number;
            marginType: import(".prisma/client").$Enums.MarginType;
            type: import(".prisma/client").$Enums.StrategyType;
            timeframe: import(".prisma/client").$Enums.Timeframe;
            positionSizeUsdt: number;
            allowLong: boolean;
            allowShort: boolean;
            takeProfitPct: number;
            stopLossPct: number;
            trailingStopPct: number;
            maxPositions: number;
            maxDailyLoss: number;
            stopOnConsecLoss: number;
            totalTrades: number;
            winTrades: number;
            totalPnl: number;
            lastSignalAt: Date | null;
        }[];
    }>;
    create(u: any, dto: CreateStrategyDto): Promise<{
        success: boolean;
        data: {
            symbol: string;
            params: import("@prisma/client/runtime/library").JsonValue;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            maxDailyTrades: number;
            userId: string;
            enabled: boolean;
            leverage: number;
            marginType: import(".prisma/client").$Enums.MarginType;
            type: import(".prisma/client").$Enums.StrategyType;
            timeframe: import(".prisma/client").$Enums.Timeframe;
            positionSizeUsdt: number;
            allowLong: boolean;
            allowShort: boolean;
            takeProfitPct: number;
            stopLossPct: number;
            trailingStopPct: number;
            maxPositions: number;
            maxDailyLoss: number;
            stopOnConsecLoss: number;
            totalTrades: number;
            winTrades: number;
            totalPnl: number;
            lastSignalAt: Date | null;
        };
    }>;
    get(u: any, id: string): Promise<{
        success: boolean;
        data: {
            symbol: string;
            params: import("@prisma/client/runtime/library").JsonValue;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            maxDailyTrades: number;
            userId: string;
            enabled: boolean;
            leverage: number;
            marginType: import(".prisma/client").$Enums.MarginType;
            type: import(".prisma/client").$Enums.StrategyType;
            timeframe: import(".prisma/client").$Enums.Timeframe;
            positionSizeUsdt: number;
            allowLong: boolean;
            allowShort: boolean;
            takeProfitPct: number;
            stopLossPct: number;
            trailingStopPct: number;
            maxPositions: number;
            maxDailyLoss: number;
            stopOnConsecLoss: number;
            totalTrades: number;
            winTrades: number;
            totalPnl: number;
            lastSignalAt: Date | null;
        };
    }>;
    update(u: any, id: string, dto: CreateStrategyDto): Promise<{
        success: boolean;
        data: {
            symbol: string;
            params: import("@prisma/client/runtime/library").JsonValue;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            maxDailyTrades: number;
            userId: string;
            enabled: boolean;
            leverage: number;
            marginType: import(".prisma/client").$Enums.MarginType;
            type: import(".prisma/client").$Enums.StrategyType;
            timeframe: import(".prisma/client").$Enums.Timeframe;
            positionSizeUsdt: number;
            allowLong: boolean;
            allowShort: boolean;
            takeProfitPct: number;
            stopLossPct: number;
            trailingStopPct: number;
            maxPositions: number;
            maxDailyLoss: number;
            stopOnConsecLoss: number;
            totalTrades: number;
            winTrades: number;
            totalPnl: number;
            lastSignalAt: Date | null;
        };
    }>;
    delete(u: any, id: string): Promise<{
        success: boolean;
    }>;
    toggle(u: any, id: string): Promise<{
        success: boolean;
        data: {
            enabled: boolean;
        };
    }>;
}
