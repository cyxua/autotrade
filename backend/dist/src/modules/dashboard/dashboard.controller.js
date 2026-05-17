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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const prisma_service_1 = require("../../prisma/prisma.service");
const binance_service_1 = require("../binance/binance.service");
const CRITICAL_REASONS = new Set([
    'ENTRY_ORDER_UNPROTECTED', 'SL_ORDER_FAILED',
    'ENTRY_ORDER_STATUS_UNKNOWN', 'POSITION_STILL_OPEN', 'CLOSE_VERIFY_FAILED',
]);
function isValidSlAlgo(o, positionAmt) {
    const orderType = o.orderType ?? o.type;
    if (orderType !== 'STOP_MARKET')
        return false;
    const cp = String(o.closePosition);
    if (cp !== 'true' && cp !== 'TRUE')
        return false;
    const validStatus = ['NEW', 'ACCEPTED', 'WORKING'];
    if (!validStatus.includes(o.algoStatus))
        return false;
    if (positionAmt > 0 && o.side !== 'SELL')
        return false;
    if (positionAmt < 0 && o.side !== 'BUY')
        return false;
    return true;
}
let DashboardController = class DashboardController {
    prisma;
    binance;
    constructor(prisma, binance) {
        this.prisma = prisma;
        this.binance = binance;
    }
    async summary(u) {
        const [engineState, strategies, positions, apiConfig] = await Promise.all([
            this.prisma.engineState.findUnique({ where: { userId: u.id } }),
            this.prisma.strategy.findMany({ where: { userId: u.id }, select: { id: true, enabled: true } }),
            this.prisma.position.findMany({ where: { userId: u.id, status: 'OPEN' } }),
            this.prisma.apiConfig.findUnique({ where: { userId: u.id }, select: { tradingMode: true } }),
        ]);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayOrders = await this.prisma.order.findMany({
            where: { userId: u.id, status: 'FILLED', filledAt: { gte: today } },
        });
        const wins = todayOrders.filter(o => (o.realizedPnl ?? 0) > 0).length;
        return {
            success: true,
            data: {
                engine: {
                    status: engineState?.status ?? 'STOPPED',
                    tradingMode: apiConfig?.tradingMode ?? 'TESTNET',
                    dailyPnl: engineState?.dailyPnl ?? 0,
                    dailyTrades: engineState?.dailyTrades ?? 0,
                    consecLossCount: engineState?.consecLossCount ?? 0,
                },
                positions: {
                    count: positions.length,
                    totalUnrealizedPnl: positions.reduce((s, p) => s + (p.unrealizedPnl ?? 0), 0),
                },
                strategies: {
                    total: strategies.length,
                    enabled: strategies.filter(s => s.enabled).length,
                },
                todayStats: {
                    realizedPnl: todayOrders.reduce((s, o) => s + (o.realizedPnl ?? 0), 0),
                    trades: todayOrders.length,
                    winRate: todayOrders.length > 0 ? wins / todayOrders.length : 0,
                },
            },
        };
    }
    async tradingHealth(u) {
        const fetchErrors = [];
        const engineState = await this.prisma.engineState.findUnique({ where: { userId: u.id } });
        const activeStrategies = await this.prisma.strategy.findMany({
            where: { userId: u.id, enabled: true }, select: { symbol: true },
        });
        const strategySymbols = [...new Set(activeStrategies.map(s => s.symbol))];
        const [recentBotOrders, recentRiskBlocks] = await Promise.all([
            this.prisma.order.findMany({
                where: { userId: u.id },
                orderBy: { createdAt: 'desc' },
                take: 20,
                select: {
                    id: true, symbol: true, side: true, orderType: true,
                    status: true, quantity: true, avgFillPrice: true,
                    stopPrice: true, filledAt: true, exitReason: true, entryReason: true,
                    binanceOrderId: true, createdAt: true,
                },
            }),
            this.prisma.riskBlockLog.findMany({
                where: { userId: u.id },
                orderBy: { createdAt: 'desc' },
                take: 20,
                select: { id: true, symbol: true, reason: true, detail: true, createdAt: true },
            }),
        ]);
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const criticalBlocks = await this.prisma.riskBlockLog.findMany({
            where: {
                userId: u.id,
                reason: { in: [...CRITICAL_REASONS] },
                createdAt: { gte: oneHourAgo },
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
            select: { id: true, symbol: true, reason: true, detail: true, createdAt: true },
        });
        let apiLoaded = false;
        try {
            await this.binance.loadApiConfig(u.id);
            apiLoaded = true;
        }
        catch (e) {
            fetchErrors.push(`API_CONFIG_LOAD_FAILED: ${e.message}`);
        }
        let currentPositions = [];
        let positionSymbols = [];
        if (apiLoaded) {
            try {
                const raw = await this.binance.getPositionsStrict();
                currentPositions = raw
                    .filter((p) => parseFloat(p.positionAmt) !== 0)
                    .map((p) => ({
                    symbol: p.symbol,
                    positionAmt: p.positionAmt,
                    entryPrice: p.entryPrice,
                    markPrice: p.markPrice,
                    unrealizedProfit: p.unRealizedProfit ?? p.unrealizedProfit ?? '0',
                    liquidationPrice: p.liquidationPrice,
                    leverage: p.leverage,
                    marginType: p.marginType,
                }));
                positionSymbols = currentPositions.map(p => p.symbol);
            }
            catch (e) {
                fetchErrors.push(`POSITION_FETCH: ${e.message}`);
            }
        }
        const botOrderSymbols = recentBotOrders.map(o => o.symbol).filter(Boolean);
        const riskBlockSymbols = recentRiskBlocks.map(b => b.symbol).filter(Boolean);
        const allSymbols = [...new Set([
                ...positionSymbols, ...strategySymbols,
                ...botOrderSymbols, ...riskBlockSymbols,
            ])];
        let openOrders = [];
        if (apiLoaded) {
            try {
                const raw = await this.binance.getOpenOrders();
                openOrders = raw.map((o) => ({
                    symbol: o.symbol,
                    orderId: o.orderId,
                    type: o.type,
                    side: o.side,
                    price: o.price,
                    quantity: o.origQty,
                    status: o.status,
                }));
            }
            catch (e) {
                fetchErrors.push(`OPEN_ORDERS_FETCH: ${e.message}`);
            }
        }
        let openAlgoOrders = [];
        if (apiLoaded) {
            try {
                if (allSymbols.length > 0) {
                    const results = await Promise.all(allSymbols.map(sym => this.binance.getOpenAlgoOrders(sym).catch(() => [])));
                    openAlgoOrders = results.flat().map((o) => ({
                        symbol: o.symbol,
                        algoId: o.algoId,
                        clientAlgoId: o.clientAlgoId,
                        type: o.orderType ?? o.type,
                        side: o.side,
                        triggerPrice: o.triggerPrice ?? o.stopPrice,
                        algoStatus: o.algoStatus,
                        closePosition: o.closePosition,
                    }));
                }
                else {
                    const raw = await this.binance.getOpenAlgoOrders();
                    openAlgoOrders = raw.map((o) => ({
                        symbol: o.symbol,
                        algoId: o.algoId,
                        clientAlgoId: o.clientAlgoId,
                        type: o.orderType ?? o.type,
                        side: o.side,
                        triggerPrice: o.triggerPrice ?? o.stopPrice,
                        algoStatus: o.algoStatus,
                        closePosition: o.closePosition,
                    }));
                }
            }
            catch (e) {
                fetchErrors.push(`ALGO_ORDERS_FETCH: ${e.message}`);
            }
        }
        const unprotectedPositions = currentPositions.filter(pos => {
            const posAmt = parseFloat(pos.positionAmt);
            return !openAlgoOrders.some(o => o.symbol === pos.symbol && isValidSlAlgo(o, posAmt));
        });
        const hasOpenPosition = currentPositions.length > 0;
        const hasOpenAlgoOrders = openAlgoOrders.length > 0;
        const hasUnprotectedPosition = unprotectedPositions.length > 0;
        const hasCriticalRiskBlock = criticalBlocks.length > 0;
        const isSafeToStartAutoTrade = !hasOpenPosition &&
            openOrders.length === 0 &&
            !hasOpenAlgoOrders &&
            !hasCriticalRiskBlock &&
            fetchErrors.length === 0;
        return {
            success: true,
            data: {
                engineState: {
                    status: engineState?.status ?? 'STOPPED',
                    dailyTrades: engineState?.dailyTrades ?? 0,
                    dailyPnl: engineState?.dailyPnl ?? 0,
                    consecLossCount: engineState?.consecLossCount ?? 0,
                    stopReason: engineState?.stopReason ?? null,
                },
                currentPositions,
                openOrders,
                openAlgoOrders,
                recentBotOrders,
                recentRiskBlocks,
                healthFlags: {
                    hasOpenPosition,
                    hasOpenAlgoOrders,
                    hasUnprotectedPosition,
                    unprotectedPositions: unprotectedPositions.map(p => p.symbol),
                    hasCriticalRiskBlock,
                    criticalBlockReasons: criticalBlocks.slice(0, 5).map(b => ({
                        reason: b.reason,
                        symbol: b.symbol,
                        createdAt: b.createdAt,
                    })),
                    criticalWindowMinutes: 60,
                    scannedSymbols: allSymbols.length,
                    isSafeToStartAutoTrade,
                    fetchErrors,
                },
            },
        };
    }
};
exports.DashboardController = DashboardController;
__decorate([
    (0, common_1.Get)('summary'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DashboardController.prototype, "summary", null);
__decorate([
    (0, common_1.Get)('trading-health'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DashboardController.prototype, "tradingHealth", null);
exports.DashboardController = DashboardController = __decorate([
    (0, common_1.Controller)('dashboard'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        binance_service_1.BinanceService])
], DashboardController);
//# sourceMappingURL=dashboard.controller.js.map