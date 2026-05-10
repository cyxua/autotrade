import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { BinanceService } from './binance.service';
import { SaveApiConfigDto, ChangeModeDto } from './dto/api-config.dto';
export declare class ApiSettingsService {
    private prisma;
    private binance;
    private config;
    constructor(prisma: PrismaService, binance: BinanceService, config: ConfigService);
    getConfig(userId: string): Promise<{
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
    }>;
    saveConfig(userId: string, dto: SaveApiConfigDto): Promise<{
        apiKey: string;
        tradingMode: "TESTNET" | "LIVE";
    }>;
    testConnection(userId: string): Promise<{
        connected: boolean;
        canTrade: boolean;
        accountType: string;
        permissions: string[];
    }>;
    changeMode(userId: string, dto: ChangeModeDto): Promise<{
        tradingMode: "TESTNET" | "LIVE";
    }>;
}
