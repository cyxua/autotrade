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
    const precision = step < 1 ? (String(step).split('.')[1]?.length ?? 0) : 0;
    const snapped = Math.floor(qty / step) * step;
    return snapped.toFixed(precision);
}
function formatPrice(price, tickSize) {
    const precision = tickSize < 1 ? (String(tickSize).split('.')[1]?.length ?? 0) : 0;
    const snapped = Math.floor(price / tickSize) * tickSize;
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
    async riskGuard(userId, strategy) {
        const state = await this.prisma.engineState.findFirst({ where: { userId } });
        if (!state || state.status !== 'RUNNING')
            return { ok: false, reason: 'ENGINE_NOT_RUNNING' };
        if ((strategy.leverage ?? 1) > 20)
            return { ok: false, reason: 'LEVERAGE_EXCEEDED' };
        const positions = await this.binance.getPositions();
        const hasPos = positions.some((p) => p.symbol === strategy.symbol && parseFloat(p.positionAmt) !== 0);
        if (hasPos)
            return { ok: false, reason: 'POSITION_EXISTS' };
        const openCount = positions.filter((p) => parseFloat(p.positionAmt) !== 0).length;
        if (openCount >= (strategy.maxPositions ?? 1))
            return { ok: false, reason: 'MAX_POSITIONS_EXCEEDED' };
        const dailyPnl = state.dailyPnl ?? 0;
        const dailyTrades = state.dailyTrades ?? 0;
        const consecLoss = state.consecLossCount ?? 0;
        if (strategy.maxDailyLoss > 0 && dailyPnl < -strategy.maxDailyLoss)
            return { ok: false, reason: 'DAILY_LOSS_EXCEEDED' };
        if (strategy.maxDailyTrades > 0 && dailyTrades >= strategy.maxDailyTrades)
            return { ok: false, reason: 'DAILY_TRADES_EXCEEDED' };
        if (strategy.stopOnConsecLoss > 0 && consecLoss >= strategy.stopOnConsecLoss)
            return { ok: false, reason: 'CONSEC_LOSS_EXCEEDED' };
        try {
            const balances = await this.binance.getBalance();
            const usdt = Array.isArray(balances)
                ? balances.find((b) => b.asset === 'USDT')
                : balances;
            const available = parseFloat(usdt?.availableBalance ?? usdt?.balance ?? '0');
            const required = strategy.positionSizeUsdt ?? 100;
            if (available < required)
                return { ok: false, reason: 'INSUFFICIENT_BALANCE' };
        }
        catch {
            return { ok: false, reason: 'BALANCE_CHECK_FAILED' };
        }
        return { ok: true };
    }
    async processStrategy(userId, strategy) {
        try {
            const params = strategy.params;
            const tf = strategy.timeframe.replace(/^([a-zA-Z]+)(\d+)$/, '$2$1');
            const klines = await this.binance.getKlines(strategy.symbol, tf, 50);
            if (!klines || klines.length < 20)
                return;
            const closes = klines.map((k) => Number(k.close));
            if (strategy.type === 'RSI_EXTREME') {
                const period = params?.rsiPeriod ?? 14;
                const overbought = params?.overboughtLevel ?? params?.overbought ?? 70;
                const oversold = params?.oversoldLevel ?? params?.oversold ?? 30;
                const rsi = this.calcRSI(closes, period);
                this.logger.log(`[${strategy.symbol}] RSI: ${rsi.toFixed(2)} (ob:${overbought} os:${oversold})`);
                if (rsi < oversold && strategy.allowLong)
                    await this.placeOrder(userId, strategy, 'BUY', 'RSI_OVERSOLD');
                else if (rsi > overbought && strategy.allowShort)
                    await this.placeOrder(userId, strategy, 'SELL', 'RSI_OVERBOUGHT');
            }
            else if (strategy.type === 'MA_CROSS') {
                const short = params?.shortPeriod ?? 9;
                const long = params?.longPeriod ?? 21;
                const emaShort = this.calcEMA(closes, short);
                const emaLong = this.calcEMA(closes, long);
                const prevShort = this.calcEMA(closes.slice(0, -1), short);
                const prevLong = this.calcEMA(closes.slice(0, -1), long);
                if (prevShort <= prevLong && emaShort > emaLong && strategy.allowLong)
                    await this.placeOrder(userId, strategy, 'BUY', 'EMA_GOLDEN_CROSS');
                else if (prevShort >= prevLong && emaShort < emaLong && strategy.allowShort)
                    await this.placeOrder(userId, strategy, 'SELL', 'EMA_DEAD_CROSS');
            }
            else if (strategy.type === 'BOLLINGER_BREAKOUT') {
                const period = params?.bbPeriod ?? params?.period ?? 20;
                const mult = params?.bbStdDev ?? params?.multiplier ?? 2.0;
                if (closes.length < period + 1)
                    return;
                const slice = closes.slice(-period);
                const mean = slice.reduce((a, b) => a + b, 0) / period;
                const std = Math.sqrt(slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period);
                const upper = mean + mult * std;
                const lower = mean - mult * std;
                const price = closes[closes.length - 1];
                this.logger.log(`[${strategy.symbol}] BB upper:${upper.toFixed(4)} lower:${lower.toFixed(4)} price:${price.toFixed(4)}`);
                if (price > upper && strategy.allowLong)
                    await this.placeOrder(userId, strategy, 'BUY', 'BB_UPPER_BREAKOUT');
                else if (price < lower && strategy.allowShort)
                    await this.placeOrder(userId, strategy, 'SELL', 'BB_LOWER_BREAKOUT');
            }
        }
        catch (e) {
            this.logger.error(`[${strategy.symbol}] 전략 처리 오류`, e);
        }
    }
    async placeOrder(userId, strategy, side, entryReason) {
        try {
            const guard = await this.riskGuard(userId, strategy);
            if (!guard.ok) {
                this.logger.log(`[${strategy.symbol}] 주문 차단: ${guard.reason}`);
                return;
            }
            const filters = await this.binance.getSymbolFilters(strategy.symbol);
            const price = await this.binance.getTickerPrice(strategy.symbol);
            const notional = (strategy.positionSizeUsdt ?? 100) * (strategy.leverage ?? 1);
            const qty = notional / price;
            const qtyStr = formatQty(qty, filters.stepSize);
            const qtyNum = parseFloat(qtyStr);
            if (qtyNum <= 0) {
                this.logger.error(`[${strategy.symbol}] 수량 0 — 주문 차단`);
                return;
            }
            if (qtyNum < filters.minQty) {
                this.logger.error(`[${strategy.symbol}] 수량 ${qtyNum} < minQty ${filters.minQty} — 주문 차단`);
                return;
            }
            const actualNotional = qtyNum * price;
            if (filters.minNotional > 0 && actualNotional < filters.minNotional) {
                this.logger.error(`[${strategy.symbol}] notional ${actualNotional.toFixed(2)} < minNotional ${filters.minNotional} — 주문 차단`);
                return;
            }
            this.logger.log(`[${strategy.symbol}] ${side} 주문 시도 qty:${qtyStr} price:${price} reason:${entryReason}`);
            await this.binance.setLeverage(strategy.symbol, strategy.leverage ?? 1);
            const orderResult = await this.binance.placeOrder({
                symbol: strategy.symbol,
                side,
                positionSide: 'BOTH',
                type: 'MARKET',
                quantity: qtyStr,
            });
            const orderId = orderResult?.orderId;
            if (!orderId) {
                this.logger.error(`[${strategy.symbol}] 주문 응답에 orderId 없음 — TP/SL 생성 중단`);
                return;
            }
            this.logger.log(`[${strategy.symbol}] ${side} 주문 완료 orderId:${orderId}`);
            try {
                await this.prisma.order.create({
                    data: {
                        userId,
                        strategyId: strategy.id,
                        binanceOrderId: String(orderId),
                        symbol: strategy.symbol,
                        side: side,
                        positionSide: 'BOTH',
                        orderType: 'MARKET',
                        status: 'FILLED',
                        quantity: qtyNum,
                        avgFillPrice: orderResult?.avgPrice ? parseFloat(orderResult.avgPrice) : price,
                        leverage: strategy.leverage ?? 1,
                        marginType: (strategy.marginType ?? 'ISOLATED'),
                        entryReason,
                    },
                });
            }
            catch (dbErr) {
                this.logger.error(`[${strategy.symbol}] DB 주문 저장 실패 (거래는 정상)`, dbErr.message);
            }
            try {
                await this.prisma.engineState.updateMany({
                    where: { userId },
                    data: { dailyTrades: { increment: 1 } },
                });
            }
            catch (e) {
                this.logger.error('dailyTrades 증가 실패', e.message);
            }
            await this.placeTpSl(strategy, side, qtyStr, price, filters.tickSize);
        }
        catch (e) {
            this.logger.error(`[${strategy.symbol}] 주문 실패`, e);
        }
    }
    async placeTpSl(strategy, side, qtyStr, entryPrice, tickSize) {
        const dir = side === 'BUY' ? 1 : -1;
        if ((strategy.takeProfitPct ?? 0) > 0) {
            try {
                const rawTp = entryPrice * (1 + dir * strategy.takeProfitPct / 100);
                const tp = formatPrice(rawTp, tickSize);
                await this.binance.placeOrder({
                    symbol: strategy.symbol,
                    side: side === 'BUY' ? 'SELL' : 'BUY',
                    positionSide: 'BOTH',
                    type: 'TAKE_PROFIT_MARKET',
                    stopPrice: tp,
                    closePosition: 'true',
                    timeInForce: 'GTE_GTC',
                });
                this.logger.log(`[${strategy.symbol}] TP 설정: ${tp}`);
            }
            catch (e) {
                this.logger.error(`[${strategy.symbol}] TP 설정 실패 (포지션 유지)`, e.message);
            }
        }
        if ((strategy.stopLossPct ?? 0) > 0) {
            try {
                const rawSl = entryPrice * (1 - dir * strategy.stopLossPct / 100);
                const sl = formatPrice(rawSl, tickSize);
                await this.binance.placeOrder({
                    symbol: strategy.symbol,
                    side: side === 'BUY' ? 'SELL' : 'BUY',
                    positionSide: 'BOTH',
                    type: 'STOP_MARKET',
                    stopPrice: sl,
                    closePosition: 'true',
                    timeInForce: 'GTE_GTC',
                });
                this.logger.log(`[${strategy.symbol}] SL 설정: ${sl}`);
            }
            catch (e) {
                this.logger.error(`[${strategy.symbol}] SL 설정 실패 (포지션 유지)`, e.message);
            }
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