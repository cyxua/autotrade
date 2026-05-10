"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiSettingsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../../prisma/prisma.service");
const binance_service_1 = require("./binance.service");
const crypto_util_1 = require("../../common/utils/crypto.util");
let ApiSettingsService = class ApiSettingsService {
    constructor(prisma, binance, config) {
        this.prisma = prisma;
        this.binance = binance;
        this.config = config;
    }
    async getConfig(userId) {
        const cfg = await this.prisma.apiConfig.findUnique({ where: { userId } });
        if (!cfg)
            return { configured: false };
        return { configured: true, apiKey: (0, crypto_util_1.maskApiKey)(cfg.apiKey), hasSecret: true, tradingMode: cfg.tradingMode, isConnected: cfg.isConnected, lastCheckedAt: cfg.lastCheckedAt };
    }
    async saveConfig(userId, dto) {
        const encKey = this.config.get('ENCRYPTION_KEY') ?? '';
        if (!encKey || encKey.length !== 64)
            throw new common_1.BadRequestException('서버 암호화 키가 설정되지 않았습니다.');
        const { encrypted, iv, tag } = (0, crypto_util_1.encrypt)(dto.secretKey, encKey);
        await this.prisma.apiConfig.upsert({
            where: { userId },
            update: { apiKey: dto.apiKey, encryptedSecret: encrypted, secretIv: iv, secretTag: tag, tradingMode: dto.tradingMode, isConnected: false },
            create: { userId, apiKey: dto.apiKey, encryptedSecret: encrypted, secretIv: iv, secretTag: tag, tradingMode: dto.tradingMode },
        });
        return { apiKey: (0, crypto_util_1.maskApiKey)(dto.apiKey), tradingMode: dto.tradingMode };
    }
    async testConnection(userId) {
        await this.binance.loadApiConfig(userId);
        const ok = await this.binance.ping();
        let canTrade = false;
        let errorMsg = null;
        if (ok) {
            try {
                const acc = await this.binance.getAccount();
                canTrade = acc.canTrade ?? false;
            }
            catch (err) {
                errorMsg = err.message;
            }
        }
        await this.prisma.apiConfig.update({ where: { userId }, data: { isConnected: ok && canTrade, lastCheckedAt: new Date(), lastErrorMsg: errorMsg } });
        if (!ok)
            throw new common_1.BadRequestException({ code: 'API_CONNECTION_FAILED', message: 'Binance API 연결 실패' });
        return { connected: true, canTrade, accountType: 'USDT-M FUTURES', permissions: ['FUTURES'] };
    }
    async changeMode(userId, dto) {
        if (dto.mode === 'LIVE' && dto.confirm !== 'LIVE') {
            throw new common_1.BadRequestException({ code: 'LIVE_MODE_CONFIRM', message: 'confirm 필드에 "LIVE"를 입력하세요.' });
        }
        await this.prisma.apiConfig.update({ where: { userId }, data: { tradingMode: dto.mode, isConnected: false } });
        return { tradingMode: dto.mode };
    }
};
exports.ApiSettingsService = ApiSettingsService;
exports.ApiSettingsService = ApiSettingsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, binance_service_1.BinanceService, config_1.ConfigService])
], ApiSettingsService);
//# sourceMappingURL=api-settings.service.js.map