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
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
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
    async emergencyStop(userId, closePositions = true) {
        this.logger.warn(`[${userId}] 🚨 긴급 정지 실행 (closePositions: ${closePositions})`);
        await this.prisma.engineState.update({
            where: { userId },
            data: { status: 'EMERGENCY_STOPPED', stoppedAt: new Date(), stopReason: 'EMERGENCY' },
        });
        this.strategyEngine.stopEngine(userId);
        const strategies = await this.prisma.strategy.findMany({
            where: { userId, enabled: true }, select: { symbol: true },
        });
        const strategySymbols = [...new Set(strategies.map(s => s.symbol))];
        let livePositions = [];
        let positionFetchError = null;
        let positionSymbols = [];
        try {
            livePositions = await this.binance.getPositionsStrict();
            positionSymbols = livePositions
                .filter((p) => parseFloat(p.positionAmt) !== 0)
                .map((p) => p.symbol);
        }
        catch (e) {
            positionFetchError = `POSITION_FETCH_FAILED: ${e.message}`;
            this.logger.error('긴급 정지 — 포지션 조회 실패', e.message);
        }
        const allSymbols = [...new Set([...strategySymbols, ...positionSymbols])];
        let canceledNormalOrders = 0;
        const cancelErrors = [];
        for (const sym of allSymbols) {
            try {
                await this.binance.cancelAllOrdersStrict([sym]);
                canceledNormalOrders++;
            }
            catch (e) {
                cancelErrors.push({ symbol: sym, error: e.message });
                this.logger.error(`[${sym}] 일반 주문 취소 실패: ${e.message}`);
            }
        }
        let canceledAlgoOrders = 0;
        for (const sym of allSymbols) {
            try {
                await this.binance.cancelAllAlgoOrders(sym);
                canceledAlgoOrders++;
                this.logger.log(`[${sym}] Algo 주문 취소 완료`);
            }
            catch (e) {
                const msg = e.message ?? '';
                this.logger.warn(`[${sym}] Algo 주문 취소 스킵: ${msg}`);
                if (!msg.includes('No algo order') && !msg.includes('-2011')) {
                    cancelErrors.push({ symbol: sym, error: `ALGO: ${msg}` });
                }
            }
        }
        const openPositions = livePositions.filter((p) => parseFloat(p.positionAmt) !== 0);
        const positionsFound = openPositions.length;
        let closeAttempts = 0;
        let closeSuccess = 0;
        const closeErrors = [];
        if (closePositions && openPositions.length > 0) {
            for (const p of openPositions) {
                const sym = p.symbol;
                const posAmt = parseFloat(p.positionAmt);
                let filters;
                try {
                    filters = await this.binance.getSymbolFilters(sym);
                }
                catch (e) {
                    closeErrors.push({ symbol: sym, reason: 'SYMBOL_FILTER_FAILED', message: e.message, posAmt: String(posAmt) });
                    this.logger.error(`[${sym}] stepSize 조회 실패 — 긴급 청산 스킵`);
                    continue;
                }
                const side = posAmt > 0 ? 'SELL' : 'BUY';
                const precision = filters.stepSize < 1 ? (String(filters.stepSize).split('.')[1]?.length ?? 0) : 0;
                const qtyStr = (Math.floor(Math.abs(posAmt) / filters.stepSize) * filters.stepSize).toFixed(precision);
                closeAttempts++;
                try {
                    await this.binance.placeOrder({
                        symbol: sym, side, positionSide: 'BOTH', type: 'MARKET', quantity: qtyStr, reduceOnly: 'true',
                    });
                    this.logger.log(`[${sym}] 청산 주문 전송 — side:${side} qty:${qtyStr}`);
                    await sleep(1500);
                    try {
                        const verify = await this.binance.getPositionsStrict();
                        const stillOpen = verify.find((v) => v.symbol === sym && parseFloat(v.positionAmt) !== 0);
                        if (stillOpen) {
                            closeErrors.push({
                                symbol: sym, reason: 'POSITION_STILL_OPEN',
                                posAmt: String(stillOpen.positionAmt), qty: qtyStr,
                            });
                            this.logger.error(`[${sym}] 청산 후 포지션 잔존: ${stillOpen.positionAmt}`);
                        }
                        else {
                            closeSuccess++;
                            this.logger.log(`[${sym}] 청산 확인 완료`);
                        }
                    }
                    catch (ve) {
                        this.logger.warn(`[${sym}] 청산 후 포지션 재확인 실패: ${ve.message}`);
                        closeSuccess++;
                    }
                }
                catch (e) {
                    const errRes = e.getResponse?.() ?? {};
                    const binCode = Number(errRes.binanceCode ?? 0);
                    if (binCode === -4115 || binCode === -2022) {
                        closeErrors.push({
                            symbol: sym, reason: 'REDUCE_ONLY_REJECTED',
                            message: `code=${binCode}: reduceOnly 미지원. 수동 청산 필요`,
                            posAmt: String(posAmt), qty: qtyStr,
                        });
                        this.logger.error(`[${sym}] reduceOnly 거절 — 수동 청산 필요 (code ${binCode})`);
                    }
                    else {
                        closeErrors.push({
                            symbol: sym, reason: 'CLOSE_POSITION_FAILED',
                            message: e.message, posAmt: String(posAmt), qty: qtyStr,
                        });
                        this.logger.error(`[${sym}] 청산 실패: ${e.message}`);
                    }
                }
            }
        }
        if (closePositions && positionSymbols.length > 0) {
            for (const sym of positionSymbols) {
                try {
                    await this.binance.cancelAllAlgoOrders(sym);
                }
                catch { }
            }
        }
        return {
            status: 'EMERGENCY_STOPPED',
            closePositionsRequested: closePositions,
            positionsFound,
            closeAttempts,
            closeSuccess,
            canceledNormalOrders,
            canceledAlgoOrders,
            cancelErrors,
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
                message: `${symbol} 심볼 필터 조회 실패: ${e.message}`,
            });
        }
        const posAmt = parseFloat(pos.positionAmt);
        const side = posAmt > 0 ? 'SELL' : 'BUY';
        const precision = filters.stepSize < 1 ? (String(filters.stepSize).split('.')[1]?.length ?? 0) : 0;
        const qtyStr = (Math.floor(Math.abs(posAmt) / filters.stepSize) * filters.stepSize).toFixed(precision);
        try {
            await this.binance.placeOrder({
                symbol, side, positionSide: 'BOTH', type: 'MARKET', quantity: qtyStr, reduceOnly: 'true',
            });
        }
        catch (e) {
            const errRes = e.getResponse?.() ?? {};
            const binCode = Number(errRes.binanceCode ?? 0);
            if (binCode === -4115 || binCode === -2022) {
                throw new common_1.BadRequestException({
                    code: 'REDUCE_ONLY_REJECTED',
                    message: `reduceOnly 미지원(code ${binCode}). Binance 앱에서 수동 청산하세요.`,
                });
            }
            throw new common_1.BadRequestException({ code: 'CLOSE_ORDER_FAILED', message: e.message });
        }
        await sleep(1500);
        const verify = await this.binance.getPositionsStrict();
        const stillOpen = verify.find((v) => v.symbol === symbol && parseFloat(v.positionAmt) !== 0);
        if (stillOpen) {
            return {
                status: 'POSITION_STILL_OPEN',
                symbol,
                quantity: qtyStr,
                remaining: stillOpen.positionAmt,
                message: '청산 주문은 전송됐으나 포지션이 남아 있습니다. 잠시 후 재확인하세요.',
            };
        }
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