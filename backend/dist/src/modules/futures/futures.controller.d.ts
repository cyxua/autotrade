import { FuturesService } from './futures.service';
export declare class FuturesController {
    private svc;
    constructor(svc: FuturesService);
    symbols(): Promise<{
        success: boolean;
        data: any;
    }>;
    tickers(): Promise<{
        success: boolean;
        data: any;
    }>;
    klines(symbol: string, interval?: string, limit?: string): Promise<{
        success: boolean;
        data: any;
    }>;
    price(symbol: string): Promise<{
        success: boolean;
        data: {
            symbol: any;
            price: any;
        };
    }>;
    balance(u: any): Promise<{
        success: boolean;
        data: {
            asset: string;
            walletBalance: any;
            availableBalance: any;
            crossWalletBalance: any;
            crossUnPnl: any;
        };
    }>;
    account(u: any): Promise<{
        success: boolean;
        data: {
            totalWalletBalance: any;
            totalMarginBalance: any;
            totalUnrealizedProfit: any;
            availableBalance: any;
            totalPositionInitialMargin: any;
            totalOpenOrderInitialMargin: any;
        };
    }>;
    positions(u: any): Promise<{
        success: boolean;
        data: any;
    }>;
    orders(u: any, symbol: string, limit?: string): Promise<{
        success: boolean;
        data: any;
        source: string;
    }>;
}
