import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
export declare class BinanceService {
    private config;
    private prisma;
    private _posCache;
    private readonly logger;
    private client;
    private mode;
    private apiKey;
    private apiSecret;
    private readonly BASE_URLS;
    constructor(config: ConfigService, prisma: PrismaService);
    private initClient;
    loadApiConfig(userId: string): Promise<void>;
    private sign;
    private signedRequest;
    ping(): Promise<boolean>;
    getAccount(): Promise<any>;
    getBalance(): Promise<any>;
    getPositionsDisplay(): Promise<any>;
    getPositionsStrict(): Promise<any[]>;
    getPositions(): Promise<any>;
    getOpenOrders(symbol?: string): Promise<any>;
    setLeverage(symbol: string, leverage: number): Promise<any>;
    setMarginType(symbol: string, marginType: string): Promise<any>;
    placeOrder(params: Record<string, any>): Promise<any>;
    cancelAllOrders(symbol?: string): Promise<any>;
    getKlines(symbol: string, interval: string, limit?: number, startTime?: number, endTime?: number): Promise<any>;
    getMode(): "testnet" | "live";
    getSymbolFilters(symbol: string): Promise<{
        stepSize: number;
        minQty: number;
        minNotional: number;
        tickSize: number;
    }>;
    getOrderDetail(symbol: string, orderId: number): Promise<any>;
    getStepSize(symbol: string): Promise<number>;
    cancelAllOrdersStrict(symbols?: string[]): Promise<{
        canceled: string[];
        cancelErrors: {
            symbol: string;
            error: string;
        }[];
    }>;
    getIncome(symbol: string, incomeType: string, startTime?: number, limit?: number): Promise<any[]>;
    getTickerPrice(symbol: string): Promise<number>;
}
