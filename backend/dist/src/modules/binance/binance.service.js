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
var BinanceService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BinanceService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = __importDefault(require("axios"));
const crypto = __importStar(require("crypto"));
const prisma_service_1 = require("../../prisma/prisma.service");
const crypto_util_1 = require("../../common/utils/crypto.util");
let BinanceService = BinanceService_1 = class BinanceService {
    config;
    prisma;
    _posCache = null;
    logger = new common_1.Logger(BinanceService_1.name);
    client;
    mode = 'testnet';
    apiKey = '';
    apiSecret = '';
    BASE_URLS = {
        testnet: 'https://testnet.binancefuture.com',
        live: 'https://fapi.binance.com',
    };
    constructor(config, prisma) {
        this.config = config;
        this.prisma = prisma;
        this.initClient('testnet');
    }
    initClient(mode) {
        this.mode = mode;
        this.client = axios_1.default.create({ baseURL: this.BASE_URLS[mode], timeout: 10_000 });
    }
    async loadApiConfig(userId) {
        const cfg = await this.prisma.apiConfig.findUnique({ where: { userId } });
        if (!cfg)
            throw new common_1.BadRequestException({ code: 'API_NOT_CONFIGURED', message: 'API 키가 설정되지 않았습니다.' });
        const encKey = this.config.get('ENCRYPTION_KEY') ?? '';
        this.apiSecret = (0, crypto_util_1.decrypt)({ encrypted: cfg.encryptedSecret, iv: cfg.secretIv, tag: cfg.secretTag }, encKey);
        this.apiKey = cfg.apiKey;
        this.initClient(cfg.tradingMode === 'LIVE' ? 'live' : 'testnet');
    }
    sign(queryString) {
        return crypto.createHmac('sha256', this.apiSecret).update(queryString).digest('hex');
    }
    async signedRequest(method, path, params = {}) {
        const query = { ...params, timestamp: Date.now() };
        const queryStr = new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)])).toString();
        const signature = this.sign(queryStr);
        const headers = { 'X-MBX-APIKEY': this.apiKey };
        try {
            const url = `${path}?${queryStr}&signature=${signature}`;
            const res = method === 'GET'
                ? await this.client.get(url, { headers })
                : method === 'POST'
                    ? await this.client.post(url, null, { headers })
                    : await this.client.delete(url, { headers });
            return res.data;
        }
        catch (err) {
            const code = err.response?.data?.code;
            const msg = err.response?.data?.msg ?? err.message;
            this.logger.error(`Binance API 오류 [${path}]: code=${code} msg=${msg}`);
            throw new common_1.BadRequestException({ code: 'BINANCE_API_ERROR', message: msg, binanceCode: code });
        }
    }
    async ping() {
        try {
            await this.client.get('/fapi/v1/ping');
            return true;
        }
        catch {
            return false;
        }
    }
    async getAccount() { return this.signedRequest('GET', '/fapi/v2/account'); }
    async getBalance() { return this.signedRequest('GET', '/fapi/v2/balance'); }
    async getPositionsDisplay() {
        if (this._posCache && Date.now() - this._posCache.ts < 30000)
            return this._posCache.data;
        try {
            const data = await this.signedRequest('GET', '/fapi/v2/positionRisk');
            this._posCache = { data, ts: Date.now() };
            return data;
        }
        catch (e) {
            if (this._posCache)
                return this._posCache.data;
            return [];
        }
    }
    async getPositionsStrict() {
        try {
            const data = await this.signedRequest('GET', '/fapi/v2/positionRisk');
            this._posCache = { data, ts: Date.now() };
            return data;
        }
        catch (e) {
            throw new Error(`POSITION_FETCH_FAILED: ${e.message}`);
        }
    }
    async getPositions() { return this.getPositionsDisplay(); }
    async getOpenOrders(symbol) {
        return this.signedRequest('GET', '/fapi/v1/openOrders', symbol ? { symbol } : {});
    }
    async setLeverage(symbol, leverage) {
        return this.signedRequest('POST', '/fapi/v1/leverage', { symbol, leverage });
    }
    async setMarginType(symbol, marginType) {
        try {
            return await this.signedRequest('POST', '/fapi/v1/marginType', { symbol, marginType });
        }
        catch (err) {
            if (err.message?.includes('-4046'))
                return null;
            throw err;
        }
    }
    async placeOrder(params) {
        return this.signedRequest('POST', '/fapi/v1/order', params);
    }
    async cancelAllOrders(symbol) {
        if (symbol)
            return this.signedRequest('DELETE', '/fapi/v1/allOpenOrders', { symbol });
        const positions = await this.getPositions();
        const symbols = positions.filter((p) => parseFloat(p.positionAmt) !== 0).map((p) => p.symbol);
        return Promise.all(symbols.map((s) => this.signedRequest('DELETE', '/fapi/v1/allOpenOrders', { symbol: s }).catch(() => null)));
    }
    async getKlines(symbol, interval, limit = 200, startTime, endTime) {
        const params = { symbol, interval, limit };
        if (startTime)
            params.startTime = startTime;
        if (endTime)
            params.endTime = endTime;
        const res = await this.client.get('/fapi/v1/klines', { params });
        return res.data.map((k) => ({
            openTime: k[0], open: parseFloat(k[1]), high: parseFloat(k[2]),
            low: parseFloat(k[3]), close: parseFloat(k[4]), volume: parseFloat(k[5]), closeTime: k[6], tradeCount: k[8] ?? 0,
        }));
    }
    getMode() { return this.mode; }
    async getSymbolFilters(symbol) {
        let data;
        try {
            data = await this.client.get('/fapi/v1/exchangeInfo');
        }
        catch (e) {
            throw new Error(`SYMBOL_FILTER_CHECK_FAILED: ${e.message}`);
        }
        const sym = data.data.symbols.find((s) => s.symbol === symbol);
        if (!sym)
            throw new Error(`SYMBOL_NOT_FOUND: ${symbol}`);
        const filters = sym.filters ?? [];
        const lot = filters.find((f) => f.filterType === 'LOT_SIZE');
        const notional = filters.find((f) => f.filterType === 'MIN_NOTIONAL');
        const price = filters.find((f) => f.filterType === 'PRICE_FILTER');
        if (!lot)
            throw new Error(`LOT_SIZE_FILTER_NOT_FOUND: ${symbol}`);
        if (!price)
            throw new Error(`PRICE_FILTER_NOT_FOUND: ${symbol}`);
        if (!notional)
            throw new Error(`MIN_NOTIONAL_FILTER_NOT_FOUND: ${symbol}`);
        return {
            stepSize: parseFloat(lot.stepSize),
            minQty: parseFloat(lot.minQty),
            minNotional: parseFloat(notional.notional),
            tickSize: parseFloat(price.tickSize),
        };
    }
    async getOrderDetail(symbol, orderId) {
        return this.signedRequest('GET', '/fapi/v1/order', { symbol, orderId });
    }
    async getStepSize(symbol) {
        return (await this.getSymbolFilters(symbol)).stepSize;
    }
    async cancelAllOrdersStrict(symbols) {
        let targets = symbols ?? [];
        if (targets.length === 0) {
            const positions = await this.getPositionsStrict();
            targets = positions
                .filter((p) => parseFloat(p.positionAmt) !== 0)
                .map((p) => p.symbol);
        }
        const canceled = [];
        const cancelErrors = [];
        for (const sym of targets) {
            try {
                await this.signedRequest('DELETE', '/fapi/v1/allOpenOrders', { symbol: sym });
                canceled.push(sym);
            }
            catch (e) {
                cancelErrors.push({ symbol: sym, error: e.message });
                this.logger.error(`[${sym}] 주문 취소 실패: ${e.message}`);
            }
        }
        return { canceled, cancelErrors };
    }
    async getIncome(symbol, incomeType, startTime, limit = 1000) {
        const params = { incomeType, limit };
        if (symbol)
            params.symbol = symbol;
        if (startTime)
            params.startTime = startTime;
        return this.signedRequest('GET', '/fapi/v1/income', params);
    }
    async getTickerPrice(symbol) {
        const res = await this.client.get('/fapi/v1/ticker/price', { params: { symbol } });
        return parseFloat(res.data.price);
    }
};
exports.BinanceService = BinanceService;
exports.BinanceService = BinanceService = BinanceService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService, prisma_service_1.PrismaService])
], BinanceService);
//# sourceMappingURL=binance.service.js.map