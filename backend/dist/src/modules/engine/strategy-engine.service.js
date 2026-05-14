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
var StrategyEngineService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StrategyEngineService = void 0;
function formatQty(qty, step) {
    const precision = step < 1 ? String(step).split('.')[1]?.length ?? 0 : 0;
    const snapped = Math.floor(qty / step) * step;
    return snapped.toFixed(precision);
}
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const binance_service_1 = require("../binance/binance.service");
let StrategyEngineService = StrategyEngineService_1 = class StrategyEngineService {
    constructor(prisma, binance) {
        this.prisma = prisma;
        this.binance = binance;
        this.logger = new common_1.Logger(StrategyEngineService_1.name);
        this.timers = new Map();
    }
    async startEngine(userId) {
        this.stopEngine(userId);
        const timer = setInterval(() => this.scanStrategies(userId), 60000);
        this.timers.set(userId, timer);
        this.logger.log(`[${userId}] 전략 엔진 스캔 시작`);
        await this.scanStrategies(userId);
    }
    stopEngine(userId) {
        const t = this.timers.get(userId);
        if (t) {
            clearInterval(t);
            this.timers.delete(userId);
        }
    }
    async scanStrategies(userId) {
        try {
            const state = await this.prisma.engineState.findFirst({ where: { userId } });
            if (!state || state.status !== 'RUNNING')
                return;
            const strategies = await this.prisma.strategy.findMany({
                where: { userId, enabled: true },
            });
            for (const strategy of strategies) {
                await this.processStrategy(userId, strategy);
            }
        }
        catch (e) {
            this.logger.error('스캔 오류', e);
        }
    }
    async processStrategy(userId, strategy) {
        try {
            const params = strategy.params;
            const klines = await this.binance.getKlines(strategy.symbol, strategy.timeframe.replace(/^([a-zA-Z]+)(\d+)$/, '$2$1'), 50);
            if (!klines || klines.length < 20)
                return;
            const closes = klines.map((k) => parseFloat(k[4]));
            if (strategy.type === 'RSI_EXTREME') {
                const period = params?.rsiPeriod ?? 14;
                const overbought = params?.overboughtLevel ?? params?.overbought ?? 70;
                const oversold = params?.oversoldLevel ?? params?.oversold ?? 30;
                const rsi = this.calcRSI(closes, period);
                this.logger.log(`[${strategy.symbol}] RSI: ${rsi.toFixed(2)} (ob:${overbought} os:${oversold})`);
                const positions = await this.binance.getPositions();
                const hasPos = positions.some((p) => p.symbol === strategy.symbol && parseFloat(p.positionAmt) !== 0);
                if (hasPos)
                    return;
                if (rsi < oversold && strategy.allowLong) {
                    await this.placeOrder(userId, strategy, 'BUY', 'LONG');
                }
                else if (rsi > overbought && strategy.allowShort) {
                    await this.placeOrder(userId, strategy, 'SELL', 'SHORT');
                }
            }
            else if (strategy.type === 'MA_CROSS') {
                const short = params?.shortPeriod ?? 9;
                const long = params?.longPeriod ?? 21;
                const emaShort = this.calcEMA(closes, short);
                const emaLong = this.calcEMA(closes, long);
                const prevShort = this.calcEMA(closes.slice(0, -1), short);
                const prevLong = this.calcEMA(closes.slice(0, -1), long);
                const positions = await this.binance.getPositions();
                const hasPos = positions.some((p) => p.symbol === strategy.symbol && parseFloat(p.positionAmt) !== 0);
                if (hasPos)
                    return;
                if (prevShort <= prevLong && emaShort > emaLong && strategy.allowLong) {
                    await this.placeOrder(userId, strategy, 'BUY', 'LONG');
                }
                else if (prevShort >= prevLong && emaShort < emaLong && strategy.allowShort) {
                    await this.placeOrder(userId, strategy, 'SELL', 'SHORT');
                }
            }
        }
        catch (e) {
            this.logger.error(`[${strategy.symbol}] 전략 처리 오류`, e);
        }
    }
    async placeOrder(userId, strategy, side, positionSide) {
        try {
            const price = await this.binance.getTickerPrice(strategy.symbol);
            const stepSize = await this.binance.getStepSize(strategy.symbol);
            const notional = strategy.positionSizeUsdt * strategy.leverage;
            const qty = (notional / price);
            const qtyStr = formatQty(qty, stepSize);
            this.logger.log(`[${strategy.symbol}] ${side} 주문 시도 qty:${qtyStr} price:${price}`);
            await this.binance.setLeverage(strategy.symbol, strategy.leverage);
            await this.binance.placeOrder({
                symbol: strategy.symbol,
                side,
                positionSide: 'BOTH',
                type: 'MARKET',
                quantity: qtyStr,
            });
            this.logger.log(`[${strategy.symbol}] ${side} 주문 완료`);
        }
        catch (e) {
            this.logger.error(`[${strategy.symbol}] 주문 실패`, e);
        }
    }
    calcRSI(closes, period) {
        if (closes.length < period + 1)
            return 50;
        let gains = 0, losses = 0;
        for (let i = closes.length - period; i < closes.length; i++) {
            const diff = closes[i] - closes[i - 1];
            if (diff > 0)
                gains += diff;
            else
                losses -= diff;
        }
        const rs = gains / (losses || 0.0001);
        return 100 - 100 / (1 + rs);
    }
    calcEMA(closes, period) {
        if (closes.length < period)
            return closes[closes.length - 1];
        const k = 2 / (period + 1);
        let ema = closes.slice(0, period).reduce((a, b) => a + b) / period;
        for (let i = period; i < closes.length; i++) {
            ema = closes[i] * k + ema * (1 - k);
        }
        return ema;
    }
};
exports.StrategyEngineService = StrategyEngineService;
exports.StrategyEngineService = StrategyEngineService = StrategyEngineService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        binance_service_1.BinanceService])
], StrategyEngineService);
//# sourceMappingURL=strategy-engine.service.js.map