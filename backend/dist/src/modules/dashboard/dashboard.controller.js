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
let DashboardController = class DashboardController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
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
        const todayOrders = await this.prisma.order.findMany({ where: { userId: u.id, status: 'FILLED', filledAt: { gte: today } } });
        const wins = todayOrders.filter(o => (o.realizedPnl ?? 0) > 0).length;
        return {
            success: true,
            data: {
                engine: { status: engineState?.status ?? 'STOPPED', tradingMode: apiConfig?.tradingMode ?? 'TESTNET', dailyPnl: engineState?.dailyPnl ?? 0, dailyTrades: engineState?.dailyTrades ?? 0, consecLossCount: engineState?.consecLossCount ?? 0 },
                positions: { count: positions.length, totalUnrealizedPnl: positions.reduce((s, p) => s + (p.unrealizedPnl ?? 0), 0) },
                strategies: { total: strategies.length, enabled: strategies.filter(s => s.enabled).length },
                todayStats: { realizedPnl: todayOrders.reduce((s, o) => s + (o.realizedPnl ?? 0), 0), trades: todayOrders.length, winRate: todayOrders.length > 0 ? wins / todayOrders.length : 0 },
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
exports.DashboardController = DashboardController = __decorate([
    (0, common_1.Controller)('dashboard'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DashboardController);
//# sourceMappingURL=dashboard.controller.js.map