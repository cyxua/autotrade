import { ApiSettingsService } from './api-settings.service';
import { SaveApiConfigDto, ChangeModeDto } from './dto/api-config.dto';
export declare class ApiSettingsController {
    private svc;
    constructor(svc: ApiSettingsService);
    get(u: any): Promise<{
        success: boolean;
        data: {
            configured: boolean;
            apiKey?: undefined;
            hasSecret?: undefined;
            tradingMode?: undefined;
            isConnected?: undefined;
            lastCheckedAt?: undefined;
        } | {
            configured: boolean;
            apiKey: string;
            hasSecret: boolean;
            tradingMode: import(".prisma/client").$Enums.TradingMode;
            isConnected: boolean;
            lastCheckedAt: Date;
        };
    }>;
    save(u: any, dto: SaveApiConfigDto): Promise<{
        success: boolean;
        data: {
            apiKey: string;
            tradingMode: "TESTNET" | "LIVE";
        };
    }>;
    test(u: any): Promise<{
        success: boolean;
        data: {
            connected: boolean;
            canTrade: boolean;
            accountType: string;
            permissions: string[];
        };
    }>;
    changeMode(u: any, dto: ChangeModeDto): Promise<{
        success: boolean;
        data: {
            tradingMode: "TESTNET" | "LIVE";
        };
    }>;
}
