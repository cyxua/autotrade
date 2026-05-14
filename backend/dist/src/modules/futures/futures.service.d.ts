import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
export declare class FuturesService {
    private config;
    private prisma;
    private cache;
    private cached;
    private readonly logger;
    private readonly BASE;
    private client;
    constructor(config: ConfigService, prisma: PrismaService);
    getSymbols(): Promise<any>;
    getTickers(): Promise<any>;
    getKlines(symbol: string, interval: string, limit?: number): Promise<any>;
    getPrice(symbol: string): Promise<{
        symbol: any;
        price: any;
    }>;
    private loadKeys;
    private sign;
    private signedGet;
    getBalance(userId: string): Promise<{
        asset: string;
        walletBalance: any;
        availableBalance: any;
        crossWalletBalance: any;
        crossUnPnl: any;
    }>;
    getAccount(userId: string): Promise<{
        totalWalletBalance: any;
        totalMarginBalance: any;
        totalUnrealizedProfit: any;
        availableBalance: any;
        totalPositionInitialMargin: any;
        totalOpenOrderInitialMargin: any;
    }>;
    getPositions(userId: string): Promise<any>;
    getOrders(userId: string, symbol: string, limit?: number): Promise<any>;
    getBotOrders(userId: string, limit?: number): Promise<({
        strategy: {
            name: string;
        };
    } & {
        symbol: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        status: import(".prisma/client").$Enums.OrderStatus;
        leverage: number;
        marginType: import(".prisma/client").$Enums.MarginType;
        side: import(".prisma/client").$Enums.OrderSide;
        positionSide: import(".prisma/client").$Enums.PositionSide;
        quantity: number;
        strategyId: string | null;
        realizedPnl: number | null;
        commission: number | null;
        entryReason: string | null;
        exitReason: string | null;
        binanceOrderId: string | null;
        clientOrderId: string | null;
        orderType: import(".prisma/client").$Enums.OrderType;
        price: number | null;
        stopPrice: number | null;
        avgFillPrice: number | null;
        filledQty: number;
        commissionAsset: string | null;
        positionId: string | null;
        errorMessage: string | null;
        filledAt: Date | null;
    })[]>;
}
