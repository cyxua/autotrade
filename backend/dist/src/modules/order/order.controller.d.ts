import { PrismaService } from '../../prisma/prisma.service';
export declare class OrderController {
    private prisma;
    constructor(prisma: PrismaService);
    list(u: any, page?: string, limit?: string, symbol?: string, status?: string): Promise<{
        success: boolean;
        data: {
            items: ({
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
                strategyId: string | null;
                side: import(".prisma/client").$Enums.OrderSide;
                positionSide: import(".prisma/client").$Enums.PositionSide;
                quantity: number;
                binanceOrderId: string | null;
                clientOrderId: string | null;
                orderType: import(".prisma/client").$Enums.OrderType;
                price: number | null;
                stopPrice: number | null;
                avgFillPrice: number | null;
                filledQty: number;
                realizedPnl: number | null;
                commission: number | null;
                commissionAsset: string | null;
                entryReason: string | null;
                exitReason: string | null;
                errorMessage: string | null;
                filledAt: Date | null;
                positionId: string | null;
            })[];
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
}
