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
    return (Math.floor(qty / step) * step).toFixed(precision);
}
function formatPrice(price, tickSize) {
    const precision = tickSize < 1 ? (String(tickSize).split('.')[1]?.length ?? 0) : 0;
    return (Math.floor(price / tickSize) * tickSize).toFixed(precision);
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const binance_service_1 = require("../binance/binance.service");
const indicator_service_1 = require("./indicator.service");
const strategy_rule_evaluator_1 = require("./strategy-rule-evaluator");
let StrategyEngineService = StrategyEngineService_1 = class StrategyEngineService {
    prisma;
    binance;
    indicator;
    evaluator;
    logger = new common_1.Logger(StrategyEngineService_1.name);
    timers = new Map();
    lastPnlSyncAt = new Map();
    constructor(prisma, binance, indicator, evaluator) {
        this.prisma = prisma;
        this.binance = binance;
        this.indicator = indicator;
        this.evaluator = evaluator;
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
    async haltEngine(userId, reason) {
        this.stopEngine(userId);
        try {
            await this.prisma.engineState.updateMany({
                where: { userId },
                data: { status: 'STOPPED', stopReason: reason },
            });
            this.logger.error(`[${userId}] 엔진 강제 중지: ${reason}`);
        }
        catch (e) {
            this.logger.error('엔진 중지 DB 업데이트 실패', e.message);
        }
    }
    async logRiskBlock(userId, strategyId, symbol, reason, detail) {
        try {
            await this.prisma.riskBlockLog.create({ data: { userId, strategyId, symbol, reason, detail } });
        }
        catch { }
        this.logger.warn(`[${symbol}] 리스크 차단: ${reason}`);
    }
    async scanStrategies(userId) {
        try {
            const state = await this.prisma.engineState.findFirst({ where: { userId } });
            if (!state || state.status !== 'RUNNING')
                return;
            const strategies = await this.prisma.strategy.findMany({ where: { userId, enabled: true } });
            for (const strategy of strategies) {
                await this.processStrategy(userId, strategy);
            }
            await this.syncPnlStats(userId);
        }
        catch (e) {
            this.logger.error('스캔 오류', e);
        }
    }
    async syncPnlStats(userId) {
        try {
            const lastSync = this.lastPnlSyncAt.get(userId) ?? (Date.now() - 3600_000);
            const now = Date.now();
            const incomes = await this.binance.getIncome('', 'REALIZED_PNL', lastSync + 1, 1000);
            if (incomes.length === 0) {
                this.lastPnlSyncAt.set(userId, now);
                return;
            }
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const todayPnl = incomes
                .filter(i => i.time >= todayStart.getTime())
                .reduce((s, i) => s + parseFloat(i.income), 0);
            const state = await this.prisma.engineState.findFirst({ where: { userId } });
            let consecLoss = state?.consecLossCount ?? 0;
            for (const income of incomes) {
                const pnl = parseFloat(income.income);
                if (pnl < 0)
                    consecLoss++;
                else if (pnl > 0)
                    consecLoss = 0;
            }
            await this.prisma.engineState.updateMany({
                where: { userId },
                data: { dailyPnl: { increment: todayPnl }, consecLossCount: consecLoss },
            });
            const strategies = await this.prisma.strategy.findMany({ where: { userId } });
            for (const strat of strategies) {
                const stratIncomes = incomes.filter((i) => i.symbol === strat.symbol);
                if (stratIncomes.length === 0)
                    continue;
                const pnlSum = stratIncomes.reduce((s, i) => s + parseFloat(i.income), 0);
                const winCount = stratIncomes.filter((i) => parseFloat(i.income) > 0).length;
                await this.prisma.strategy.update({
                    where: { id: strat.id },
                    data: {
                        totalPnl: { increment: pnlSum },
                        totalTrades: { increment: stratIncomes.length },
                        winTrades: { increment: winCount },
                        lastSignalAt: new Date(),
                    },
                });
            }
            this.lastPnlSyncAt.set(userId, now);
            this.logger.log(`[${userId}] PnL 동기화 완료: ${incomes.length}건, 오늘 PnL: ${todayPnl.toFixed(4)}`);
        }
        catch (e) {
            this.logger.warn(`[syncPnlStats] 오류 (무시): ${e.message}`);
        }
    }
    async riskGuard(userId, strategy) {
        const state = await this.prisma.engineState.findFirst({ where: { userId } });
        if (!state || state.status !== 'RUNNING')
            return { ok: false, reason: 'ENGINE_NOT_RUNNING' };
        if ((strategy.leverage ?? 1) > 20) {
            await this.logRiskBlock(userId, strategy.id, strategy.symbol, 'LEVERAGE_EXCEEDED');
            return { ok: false, reason: 'LEVERAGE_EXCEEDED' };
        }
        if ((state.dailyPnl ?? 0) <= -(strategy.maxDailyLoss ?? 50)) {
            await this.logRiskBlock(userId, strategy.id, strategy.symbol, 'DAILY_LOSS_EXCEEDED', { dailyPnl: state.dailyPnl, maxDailyLoss: strategy.maxDailyLoss });
            return { ok: false, reason: 'DAILY_LOSS_EXCEEDED' };
        }
        if ((state.consecLossCount ?? 0) >= (strategy.stopOnConsecLoss ?? 3)) {
            await this.logRiskBlock(userId, strategy.id, strategy.symbol, 'CONSEC_LOSS_EXCEEDED', { consecLossCount: state.consecLossCount });
            return { ok: false, reason: 'CONSEC_LOSS_EXCEEDED' };
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayOrders = await this.prisma.order.count({
            where: { userId, strategyId: strategy.id, createdAt: { gte: today } },
        });
        if (todayOrders >= (strategy.maxDailyTrades ?? 10)) {
            await this.logRiskBlock(userId, strategy.id, strategy.symbol, 'DAILY_TRADES_EXCEEDED');
            return { ok: false, reason: 'DAILY_TRADES_EXCEEDED' };
        }
        let binancePositions;
        try {
            binancePositions = await this.binance.getPositionsStrict();
        }
        catch (e) {
            await this.logRiskBlock(userId, strategy.id, strategy.symbol, 'POSITION_FETCH_FAILED', e.message);
            return { ok: false, reason: 'POSITION_FETCH_FAILED' };
        }
        const samePosOpen = binancePositions.find(p => p.symbol === strategy.symbol && parseFloat(p.positionAmt) !== 0);
        if (samePosOpen) {
            await this.logRiskBlock(userId, strategy.id, strategy.symbol, 'POSITION_ALREADY_OPEN');
            return { ok: false, reason: 'POSITION_ALREADY_OPEN' };
        }
        const totalOpen = binancePositions.filter(p => parseFloat(p.positionAmt) !== 0).length;
        if (totalOpen >= (strategy.maxPositions ?? 1)) {
            await this.logRiskBlock(userId, strategy.id, strategy.symbol, 'MAX_POSITIONS_REACHED', { totalOpen, maxPositions: strategy.maxPositions });
            return { ok: false, reason: 'MAX_POSITIONS_REACHED' };
        }
        let balanceList;
        try {
            balanceList = await this.binance.getBalance();
        }
        catch (e) {
            await this.logRiskBlock(userId, strategy.id, strategy.symbol, 'BALANCE_FETCH_FAILED', e.message);
            return { ok: false, reason: 'BALANCE_FETCH_FAILED' };
        }
        const usdtBal = balanceList.find((b) => b.asset === 'USDT');
        const available = parseFloat(usdtBal?.availableBalance ?? '0');
        if (available < strategy.positionSizeUsdt) {
            await this.logRiskBlock(userId, strategy.id, strategy.symbol, 'INSUFFICIENT_BALANCE', { available, required: strategy.positionSizeUsdt });
            return { ok: false, reason: 'INSUFFICIENT_BALANCE' };
        }
        let filters;
        try {
            filters = await this.binance.getSymbolFilters(strategy.symbol);
        }
        catch (e) {
            await this.logRiskBlock(userId, strategy.id, strategy.symbol, 'SYMBOL_FILTER_FAILED', e.message);
            return { ok: false, reason: 'SYMBOL_FILTER_FAILED' };
        }
        const notional = strategy.positionSizeUsdt * strategy.leverage;
        if (notional < filters.minNotional) {
            await this.logRiskBlock(userId, strategy.id, strategy.symbol, 'MIN_NOTIONAL_NOT_MET', { notional, minNotional: filters.minNotional });
            return { ok: false, reason: 'MIN_NOTIONAL_NOT_MET' };
        }
        return { ok: true };
    }
    async processStrategy(userId, strategy) {
        try {
            const params = (strategy.params ?? {});
            if ((params.exitRules ?? []).length > 0)
                this.logger.warn(`[${strategy.symbol}] exitRules 설정됨 — 현재 엔진에서 미평가`);
            const tfMap = { m1: '1m', m5: '5m', m15: '15m', h1: '1h', h4: '4h' };
            let klines = await this.binance.getKlines(strategy.symbol, tfMap[strategy.timeframe] ?? '15m', 250);
            if (params.useClosedCandleOnly !== false) {
                const now = Date.now();
                klines = klines.filter(k => k.closeTime < now);
            }
            if (klines.length < 50) {
                this.logger.warn(`[${strategy.symbol}] 캔들 수 부족 (${klines.length}), 스킵`);
                return;
            }
            const evalMode = params.evalMode ?? 'ALL';
            const minScore = params.minScore ?? 60;
            const blockRules = params.blockRules ?? [];
            if (blockRules.length > 0 && this.evaluator.evaluate(blockRules, klines, 'ANY').signal) {
                this.logger.log(`[${strategy.symbol}] 차단 조건 발동 — 스킵`);
                return;
            }
            let longSignal = false;
            let shortSignal = false;
            if (strategy.allowLong) {
                const longRules = params.longEntryRules ?? [];
                for (const r of longRules) {
                    const err = (0, strategy_rule_evaluator_1.validateRule)(r);
                    if (err) {
                        this.logger.warn(`[${strategy.symbol}] 롱 rule 오류: ${err}`);
                        return;
                    }
                }
                longSignal = this.evaluator.evaluate(longRules, klines, evalMode, minScore).signal;
            }
            if (strategy.allowShort) {
                const shortRules = params.shortEntryRules ?? [];
                for (const r of shortRules) {
                    const err = (0, strategy_rule_evaluator_1.validateRule)(r);
                    if (err) {
                        this.logger.warn(`[${strategy.symbol}] 숏 rule 오류: ${err}`);
                        return;
                    }
                }
                shortSignal = this.evaluator.evaluate(shortRules, klines, evalMode, minScore).signal;
            }
            if (longSignal && shortSignal) {
                await this.logRiskBlock(userId, strategy.id, strategy.symbol, 'CONFLICTING_SIGNALS');
                return;
            }
            const directions = [];
            if (longSignal)
                directions.push('LONG');
            if (shortSignal)
                directions.push('SHORT');
            for (const direction of directions) {
                const guard = await this.riskGuard(userId, strategy);
                if (!guard.ok)
                    continue;
                await this.enterPosition(userId, strategy, direction, klines);
            }
        }
        catch (e) {
            this.logger.error(`[${strategy.symbol}] processStrategy 오류: ${e.message}`);
        }
    }
    async enterPosition(userId, strategy, direction, _klines) {
        const symbol = strategy.symbol;
        try {
            const filters = await this.binance.getSymbolFilters(symbol);
            const price = await this.binance.getTickerPrice(symbol);
            await this.binance.setLeverage(symbol, strategy.leverage);
            await this.binance.setMarginType(symbol, strategy.marginType);
            const rawQty = (strategy.positionSizeUsdt * strategy.leverage) / price;
            const qty = formatQty(rawQty, filters.stepSize);
            if (parseFloat(qty) < filters.minQty) {
                this.logger.warn(`[${symbol}] 최소 수량 미달: ${qty} < ${filters.minQty}`);
                return;
            }
            const actualNotional = parseFloat(qty) * price;
            if (actualNotional < filters.minNotional) {
                await this.logRiskBlock(userId, strategy.id ?? null, symbol, 'MIN_NOTIONAL_AFTER_ROUNDING', { qty, price, actualNotional, minNotional: filters.minNotional });
                return;
            }
            const side = direction === 'LONG' ? 'BUY' : 'SELL';
            const orderRes = await this.binance.placeOrder({
                symbol, side, positionSide: 'BOTH', type: 'MARKET',
                quantity: qty, newOrderRespType: 'RESULT',
            });
            const orderId = orderRes.orderId;
            let confirmed = orderRes;
            if (orderId && !['FILLED', 'PARTIALLY_FILLED'].includes(confirmed.status)) {
                for (let i = 0; i < 3; i++) {
                    await sleep(400);
                    try {
                        confirmed = await this.binance.getOrderDetail(symbol, orderId);
                        if (['FILLED', 'PARTIALLY_FILLED'].includes(confirmed.status))
                            break;
                    }
                    catch (e) {
                        this.logger.warn(`[${symbol}] getOrderDetail 실패 (${i + 1}/3): ${e.message}`);
                    }
                }
            }
            let fillPrice = parseFloat(confirmed.avgPrice ?? confirmed.price ?? String(price));
            let filledQty = parseFloat(confirmed.executedQty ?? qty);
            let orderStatus = confirmed.status ?? 'UNKNOWN';
            if (!['FILLED', 'PARTIALLY_FILLED'].includes(orderStatus)) {
                try {
                    const positions = await this.binance.getPositionsStrict();
                    const openPos = positions.find((p) => p.symbol === symbol && parseFloat(p.positionAmt) !== 0);
                    if (openPos) {
                        fillPrice = parseFloat(openPos.entryPrice);
                        filledQty = Math.abs(parseFloat(openPos.positionAmt));
                        orderStatus = 'FILLED';
                        this.logger.warn(`[${symbol}] 주문 상태 불명확 → 포지션 기준 FILLED 처리`);
                    }
                    else {
                        await this.logRiskBlock(userId, strategy.id ?? null, symbol, 'ENTRY_ORDER_STATUS_UNKNOWN', { orderId, confirmedStatus: orderStatus });
                        await this.haltEngine(userId, 'ENTRY_ORDER_STATUS_UNKNOWN');
                        return;
                    }
                }
                catch (e) {
                    await this.logRiskBlock(userId, strategy.id ?? null, symbol, 'ENTRY_ORDER_STATUS_UNKNOWN', { orderId, error: e.message });
                    await this.haltEngine(userId, 'ENTRY_ORDER_STATUS_UNKNOWN');
                    return;
                }
            }
            await this.prisma.order.create({
                data: {
                    userId,
                    strategyId: strategy.id ?? null,
                    binanceOrderId: String(orderId ?? ''),
                    symbol,
                    side: side,
                    positionSide: 'BOTH',
                    orderType: 'MARKET',
                    status: orderStatus,
                    quantity: parseFloat(qty),
                    avgFillPrice: fillPrice,
                    filledQty: ['FILLED', 'PARTIALLY_FILLED'].includes(orderStatus) ? filledQty : 0,
                    filledAt: ['FILLED', 'PARTIALLY_FILLED'].includes(orderStatus) ? new Date() : null,
                    leverage: strategy.leverage,
                    marginType: strategy.marginType,
                    entryReason: direction,
                },
            });
            this.logger.log(`[${symbol}] ${direction} 진입 — qty: ${qty}, price: ${fillPrice}`);
            if (['FILLED', 'PARTIALLY_FILLED'].includes(orderStatus)) {
                await this.prisma.engineState.updateMany({
                    where: { userId },
                    data: { dailyTrades: { increment: 1 } },
                }).catch(() => { });
            }
            const closeSide = side === 'BUY' ? 'SELL' : 'BUY';
            const dir = direction === 'LONG' ? 1 : -1;
            let tpOk = strategy.takeProfitPct <= 0;
            let slOk = strategy.stopLossPct <= 0;
            if (strategy.takeProfitPct > 0) {
                const tp = formatPrice(fillPrice * (1 + dir * strategy.takeProfitPct / 100), filters.tickSize);
                try {
                    const tpRes = await this.binance.placeOrder({
                        symbol, side: closeSide, positionSide: 'BOTH',
                        type: 'TAKE_PROFIT_MARKET', stopPrice: tp, closePosition: 'true',
                    });
                    await this.prisma.order.create({
                        data: {
                            userId, strategyId: strategy.id ?? null,
                            binanceOrderId: String(tpRes.orderId ?? ''),
                            symbol, side: closeSide, positionSide: 'BOTH',
                            orderType: 'TAKE_PROFIT_MARKET',
                            status: (tpRes.status ?? 'NEW'),
                            quantity: parseFloat(qty),
                            stopPrice: parseFloat(tp),
                            leverage: strategy.leverage,
                            marginType: strategy.marginType,
                            exitReason: 'TAKE_PROFIT',
                        },
                    }).catch(() => { });
                    this.logger.log(`[${symbol}] TP: ${tp}`);
                    tpOk = true;
                }
                catch (e) {
                    await this.logRiskBlock(userId, strategy.id ?? null, symbol, 'TP_ORDER_FAILED', { tp, fillPrice, direction, error: e.message });
                }
            }
            if (strategy.stopLossPct > 0) {
                const sl = formatPrice(fillPrice * (1 - dir * strategy.stopLossPct / 100), filters.tickSize);
                try {
                    const slRes = await this.binance.placeOrder({
                        symbol, side: closeSide, positionSide: 'BOTH',
                        type: 'STOP_MARKET', stopPrice: sl, closePosition: 'true',
                    });
                    await this.prisma.order.create({
                        data: {
                            userId, strategyId: strategy.id ?? null,
                            binanceOrderId: String(slRes.orderId ?? ''),
                            symbol, side: closeSide, positionSide: 'BOTH',
                            orderType: 'STOP_MARKET',
                            status: (slRes.status ?? 'NEW'),
                            quantity: parseFloat(qty),
                            stopPrice: parseFloat(sl),
                            leverage: strategy.leverage,
                            marginType: strategy.marginType,
                            exitReason: 'STOP_LOSS',
                        },
                    }).catch(() => { });
                    this.logger.log(`[${symbol}] SL: ${sl}`);
                    slOk = true;
                }
                catch (e) {
                    this.logger.error(`[${symbol}] SL 실패: ${e.message}`);
                }
            }
            if (!slOk) {
                await this.logRiskBlock(userId, strategy.id ?? null, symbol, 'ENTRY_ORDER_UNPROTECTED', { fillPrice, direction, tpOk });
                await this.haltEngine(userId, 'ENTRY_ORDER_UNPROTECTED');
            }
        }
        catch (e) {
            this.logger.error(`[${symbol}] enterPosition 오류: ${e.message}`);
        }
    }
};
exports.StrategyEngineService = StrategyEngineService;
exports.StrategyEngineService = StrategyEngineService = StrategyEngineService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        binance_service_1.BinanceService,
        indicator_service_1.IndicatorService,
        strategy_rule_evaluator_1.StrategyRuleEvaluator])
], StrategyEngineService);
//# sourceMappingURL=strategy-engine.service.js.map