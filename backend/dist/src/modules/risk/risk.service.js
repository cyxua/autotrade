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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiskService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let RiskService = class RiskService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    getConfig(userId) { return this.prisma.riskConfig.findUnique({ where: { userId } }); }
    updateConfig(userId, data) {
        return this.prisma.riskConfig.upsert({ where: { userId }, update: data, create: { userId, ...data } });
    }
    async getBlockLogs(userId, page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const [items, total] = await Promise.all([
            this.prisma.riskBlockLog.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, skip, take: limit }),
            this.prisma.riskBlockLog.count({ where: { userId } }),
        ]);
        return { items, total, page, limit };
    }
    logBlock(userId, strategyId, symbol, reason, detail) {
        return this.prisma.riskBlockLog.create({ data: { userId, strategyId, symbol, reason, detail } });
    }
    resetDailyStats(userId) {
        return this.prisma.engineState.update({ where: { userId }, data: { dailyPnl: 0, dailyTrades: 0, dailyLossDate: new Date() } });
    }
    resetConsecLoss(userId) {
        return this.prisma.engineState.update({ where: { userId }, data: { consecLossCount: 0 } });
    }
};
exports.RiskService = RiskService;
exports.RiskService = RiskService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], RiskService);
//# sourceMappingURL=risk.service.js.map