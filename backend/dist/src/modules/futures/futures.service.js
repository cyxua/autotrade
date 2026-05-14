"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var FuturesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FuturesService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = __importDefault(require("axios"));
const crypto = __importStar(require("crypto"));
const prisma_service_1 = require("../../prisma/prisma.service");
const crypto_util_1 = require("../../common/utils/crypto.util");
let FuturesService = FuturesService_1 = class FuturesService {
    cached(key, ttl, fn) {
        const hit = this.cache.get(key);
        if (hit && Date.now() - hit.ts < ttl)
            return Promise.resolve(hit.data);
        return fn().then(data => { this.cache.set(key, { data, ts: Date.now() }); return data; });
    }
    constructor(config, prisma) {
        this.config = config;
        this.prisma = prisma;
        this.cache = new Map();
        this.logger = new common_1.Logger(FuturesService_1.name);
        this.BASE = 'https://fapi.binance.com';
        this.client = axios_1.default.create({ baseURL: this.BASE, timeout: 10_000 });
    }
    async getSymbols() {
        const res = await this.client.get('/fapi/v1/exchangeInfo');
        return res.data.symbols
            .filter((s) => s.status === 'TRADING' &&
            s.contractType === 'PERPETUAL' &&
            s.quoteAsset === 'USDT')
            .map((s) => ({
            symbol: s.symbol,
            baseAsset: s.baseAsset,
            quoteAsset: s.quoteAsset,
            contractType: s.contractType,
            status: s.status,
            pricePrecision: s.pricePrecision,
            quantityPrecision: s.quantityPrecision,
        }));
    }
    async getTickers() {
        const res = await this.client.get('/fapi/v1/ticker/24hr');
        return res.data.map((t) => ({
            symbol: t.symbol,
            lastPrice: t.lastPrice,
            priceChangePercent: t.priceChangePercent,
            quoteVolume: t.quoteVolume,
            count: t.count,
            highPrice: t.highPrice,
            lowPrice: t.lowPrice,
        }));
    }
    async getKlines(symbol, interval, limit = 500) {
        const res = await this.client.get('/fapi/v1/klines', {
            params: { symbol, interval, limit },
        });
        return res.data.map((k) => ({
            time: Math.floor(k[0] / 1000),
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5]),
            closeTime: k[6],
        }));
    }
    async getPrice(symbol) {
        const res = await this.client.get('/fapi/v2/ticker/price', {
            params: { symbol },
        });
        return { symbol: res.data.symbol, price: res.data.price };
    }
    async loadKeys(userId) {
        const cfg = await this.prisma.apiConfig.findUnique({ where: { userId } });
        if (!cfg)
            throw new Error('API 키가 설정되지 않았습니다.');
        const encKey = this.config.get('ENCRYPTION_KEY') ?? '';
        const secret = (0, crypto_util_1.decrypt)({ encrypted: cfg.encryptedSecret, iv: cfg.secretIv, tag: cfg.secretTag }, encKey);
        const baseUrl = cfg.tradingMode === 'LIVE'
            ? 'https://fapi.binance.com'
            : 'https://testnet.binancefuture.com';
        return { apiKey: cfg.apiKey, secret, baseUrl };
    }
    sign(queryStr, secret) {
        return crypto.createHmac('sha256', secret).update(queryStr).digest('hex');
    }
    async signedGet(baseUrl, path, apiKey, secret, params = {}) {
        const query = { ...params, timestamp: Date.now() };
        const qs = new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)])).toString();
        const sig = this.sign(qs, secret);
        const url = `${baseUrl}${path}?${qs}&signature=${sig}`;
        const res = await axios_1.default.get(url, {
            headers: { 'X-MBX-APIKEY': apiKey },
            timeout: 10_000,
        });
        return res.data;
    }
    async getBalance(userId) {
        try {
            const { apiKey, secret, baseUrl } = await this.loadKeys(userId);
            const data = await this.signedGet(baseUrl, '/fapi/v3/balance', apiKey, secret);
            const usdt = data.find((b) => b.asset === 'USDT');
            return {
                asset: 'USDT',
                walletBalance: usdt?.balance ?? '0',
                availableBalance: usdt?.availableBalance ?? '0',
                crossWalletBalance: usdt?.crossWalletBalance ?? '0',
                crossUnPnl: usdt?.crossUnPnl ?? '0',
            };
        }
        catch (e) {
            return { asset: 'USDT', walletBalance: '0', availableBalance: '0', crossWalletBalance: '0', crossUnPnl: '0' };
        }
    }
    async getAccount(userId) {
        try {
            const { apiKey, secret, baseUrl } = await this.loadKeys(userId);
            const data = await this.signedGet(baseUrl, '/fapi/v3/account', apiKey, secret);
            return {
                totalWalletBalance: data.totalWalletBalance,
                totalMarginBalance: data.totalMarginBalance,
                totalUnrealizedProfit: data.totalUnrealizedProfit,
                availableBalance: data.availableBalance,
                totalPositionInitialMargin: data.totalPositionInitialMargin,
                totalOpenOrderInitialMargin: data.totalOpenOrderInitialMargin,
            };
        }
        catch (e) {
            return null;
        }
    }
    async getPositions(userId) {
        try {
            const { apiKey, secret, baseUrl } = await this.loadKeys(userId);
            const data = await this.signedGet(baseUrl, '/fapi/v3/positionRisk', apiKey, secret);
            return data
                .filter((p) => parseFloat(p.positionAmt) !== 0)
                .map((p) => ({
                symbol: p.symbol,
                positionAmt: p.positionAmt,
                entryPrice: p.entryPrice,
                markPrice: p.markPrice,
                liquidationPrice: p.liquidationPrice,
                unRealizedProfit: p.unRealizedProfit,
                leverage: p.leverage,
                marginType: p.marginType,
                side: parseFloat(p.positionAmt) > 0 ? 'LONG' : 'SHORT',
                notional: p.notional,
            }));
        }
        catch (e) {
            return [];
        }
    }
    async getOrders(userId, symbol, limit = 20) {
        const { apiKey, secret, baseUrl } = await this.loadKeys(userId);
        const data = await this.signedGet(baseUrl, '/fapi/v1/allOrders', apiKey, secret, { symbol, limit });
        return data
            .sort((a, b) => b.time - a.time)
            .slice(0, limit)
            .map((o) => ({
            orderId: o.orderId,
            symbol: o.symbol,
            side: o.side,
            type: o.type,
            status: o.status,
            price: o.price,
            avgPrice: o.avgPrice,
            origQty: o.origQty,
            executedQty: o.executedQty,
            realizedPnl: o.realizedPnl ?? '0',
            time: o.time,
            updateTime: o.updateTime,
        }));
    }
    async getBotOrders(userId, limit = 20) {
        return this.prisma.order.findMany({
            where: { userId, status: 'FILLED' },
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: { strategy: { select: { name: true } } },
        });
    }
};
exports.FuturesService = FuturesService;
exports.FuturesService = FuturesService = FuturesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService])
], FuturesService);
//# sourceMappingURL=futures.service.js.map