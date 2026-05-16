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
var EngineService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EngineService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const binance_service_1 = require("../binance/binance.service");
const strategy_engine_service_1 = require("./strategy-engine.service");
let EngineService = EngineService_1 = class EngineService {
    prisma;
    binance;
    strategyEngine;
    logger = new common_1.Logger(EngineService_1.name);
    constructor(prisma, binance, strategyEngine) {
        this.prisma = prisma;
        this.binance = binance;
        this.strategyEngine = strategyEngine;
    }
    async getStatus(userId) {
        const state = await this.prisma.engineState.findFirst({ where: { userId } });
        const active = await this.prisma.strategy.count({ where: { userId, enabled: true } });
        return { state, activeStrategies: active };
    }
    async start(userId) {
        await this.binance.loadApiConfig(userId);
        const ok = await this.binance.ping();
        if (!ok)
            throw new common_1.BadRequestException({ code: 'API_CONNECTION_FAILED', message: 'Binance API 연결 실패' });
        const now = new Date();
        await this.prisma.engineState.upsert({
            where: { userId },
            update: { status: 'RUNNING', startedAt: now, stoppedAt: null, stopReason: null },
            create: { userId, status: 'RUNNING', startedAt: now },
        });
        this.logger.log(`[${userId}] 자동매매 엔진 시작`);
        await this.strategyEngine.startEngine(userId);
        return { status: 'RUNNING', startedAt: now };
    }
    async stop(userId, reason = 'MANUAL') {
        await this.prisma.engineState.update({
            where: { userId },
            data: { status: 'STOPPED', stoppedAt: new Date(), stopReason: reason },
        });
        this.strategyEngine.stopEngine(userId);
        this.logger.log(`[${userId}] 자동매매 엔진 중지`);
        return { status: 'STOPPED' };
    }
    async emergencyStop(userId, closePositions = false) {
        this.logger.warn(`[${userId}] 🚨 긴급 정지 실행`);
        await this.prisma.engineState.update({
            where: { userId },
            data: { status: 'EMERGENCY_STOPPED', stoppedAt: new Date(), stopReason: 'EMERGENCY' },
        });
        this.strategyEngine.stopEngine(userId);
        const strategies = await this.prisma.strategy.findMany({
            where: { userId, enabled: true }, select: { symbol: true },
        });
        const strategySymbols = [...new Set(strategies.map(s => s.symbol))];
        let cancelResult = { canceled: [], cancelErrors: [] };
        try {
            let positionSymbols = [];
            try {
                const positions = await this.binance.getPositionsStrict();
                positionSymbols = positions
                    .filter((p) => parseFloat(p.positionAmt) !== 0)
                    .map((p) => p.symbol);
            }
            catch { }
            const allSymbols = [...new Set([...strategySymbols, ...positionSymbols])];
            cancelResult = await this.binance.cancelAllOrdersStrict(allSymbols);
        }
        catch (e) {
            this.logger.error('주문 취소 실패', e.message);
        }
        let closedPositions = 0;
        const closeErrors = [];
        let positionFetchError = null;
        if (closePositions) {
            let positions = [];
            try {
                positions = await this.binance.getPositionsStrict();
            }
            catch (e) {
                positionFetchError = `POSITION_FETCH_FAILED: ${e.message}`;
                this.logger.error('긴급 정지 포지션 조회 실패', e.message);
            }
            for (const p of positions.filter((p) => parseFloat(p.positionAmt) !== 0)) {
                try {
                    let filters;
                    try {
                        filters = await this.binance.getSymbolFilters(p.symbol);
                    }
                    catch (e) {
                        closeErrors.push({ symbol: p.symbol, error: `SYMBOL_FILTER_FAILED: ${e.message}` });
                        this.logger.error(`[${p.symbol}] stepSize 조회 실패 — 긴급 청산 스킵`);
                        continue;
                    }
                    const posAmt = parseFloat(p.positionAmt);
                    const orderSide = posAmt > 0 ? 'SELL' : 'BUY';
                    const precision = filters.stepSize < 1 ? (String(filters.stepSize).split('.')[1]?.length ?? 0) : 0;
                    const snapped = Math.floor(Math.abs(posAmt) / filters.stepSize) * filters.stepSize;
                    const qtyStr = snapped.toFixed(precision);
                    await this.binance.placeOrder({
                        symbol: p.symbol, side: orderSide, positionSide: 'BOTH', type: 'MARKET', quantity: qtyStr,
                    });
                    closedPositions++;
                }
                catch (e) {
                    closeErrors.push({ symbol: p.symbol, error: e.message });
                    this.logger.error(`[${p.symbol}] 긴급 청산 실패`, e.message);
                }
            }
        }
        return {
            status: 'EMERGENCY_STOPPED',
            canceledOrders: cancelResult.canceled.length,
            cancelErrors: cancelResult.cancelErrors,
            closedPositions,
            closeErrors,
            positionFetchError,
        };
    }
    async resetEmergencyStop(userId) {
        await this.prisma.engineState.upsert({
            where: { userId },
            update: { status: 'STOPPED', stopReason: null },
            create: { userId, status: 'STOPPED' },
        });
        return { status: 'RESET' };
    }
    async closePosition(userId, symbol) {
        await this.binance.loadApiConfig(userId);
        const positions = await this.binance.getPositionsStrict();
        const pos = positions.find((p) => p.symbol === symbol && parseFloat(p.positionAmt) !== 0);
        if (!pos)
            return { status: 'NO_POSITION' };
        let filters;
        try {
            filters = await this.binance.getSymbolFilters(symbol);
        }
        catch (e) {
            throw new common_1.BadRequestException({
                code: 'SYMBOL_FILTER_FAILED',
                message: `${symbol} 심볼 필터 조회 실패 — 청산 중단: ${e.message}`,
            });
        }
        const posAmt = parseFloat(pos.positionAmt);
        const side = posAmt > 0 ? 'SELL' : 'BUY';
        const precision = filters.stepSize < 1 ? (String(filters.stepSize).split('.')[1]?.length ?? 0) : 0;
        const snapped = Math.floor(Math.abs(posAmt) / filters.stepSize) * filters.stepSize;
        const qtyStr = snapped.toFixed(precision);
        await this.binance.placeOrder({ symbol, side, positionSide: 'BOTH', type: 'MARKET', quantity: qtyStr });
        return { status: 'CLOSED', symbol, quantity: qtyStr };
    }
};
exports.EngineService = EngineService;
exports.EngineService = EngineService = EngineService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        binance_service_1.BinanceService,
        strategy_engine_service_1.StrategyEngineService])
], EngineService);
//# sourceMappingURL=engine.service.js.map