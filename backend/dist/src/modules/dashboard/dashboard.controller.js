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
const trading_health_service_1 = require("../engine/trading-health.service");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const prisma_service_1 = require("../../prisma/prisma.service");
let DashboardController = class DashboardController {
    prisma;
    tradingHealthSvc;
    constructor(prisma, tradingHealthSvc) {
        this.prisma = prisma;
        this.tradingHealthSvc = tradingHealthSvc;
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
        const health = await this.tradingHealthSvc.getTradingHealth(u.id);
        const engineState = await this.prisma.engineState.findUnique({ where: { userId: u.id } });
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const [recentBotOrders, recentRiskBlocks, criticalBlocks] = await Promise.all([
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
            this.prisma.riskBlockLog.findMany({
                where: {
                    userId: u.id,
                    reason: { in: ['ENTRY_ORDER_UNPROTECTED', 'SL_ORDER_FAILED', 'ENTRY_ORDER_STATUS_UNKNOWN', 'POSITION_STILL_OPEN', 'CLOSE_VERIFY_FAILED'] },
                    createdAt: { gte: oneHourAgo },
                },
                orderBy: { createdAt: 'desc' },
                take: 20,
                select: { id: true, symbol: true, reason: true, detail: true, createdAt: true },
            }),
        ]);
        const flags = {
            ...health.flags,
            criticalBlockReasons: criticalBlocks.slice(0, 5).map(b => ({
                reason: b.reason,
                symbol: b.symbol,
                createdAt: b.createdAt,
            })),
        };
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
                currentPositions: health.positions,
                openOrders: health.openOrders,
                openAlgoOrders: health.openAlgoOrders,
                recentBotOrders,
                recentRiskBlocks,
                healthFlags: flags,
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
        trading_health_service_1.TradingHealthService])
], DashboardController);
//# sourceMappingURL=dashboard.controller.js.map