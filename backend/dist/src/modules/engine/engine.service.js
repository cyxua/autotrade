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
let EngineService = EngineService_1 = class EngineService {
    constructor(prisma, binance) {
        this.prisma = prisma;
        this.binance = binance;
        this.logger = new common_1.Logger(EngineService_1.name);
    }
    async getStatus(userId) { return this.prisma.engineState.findUnique({ where: { userId } }); }
    async start(userId) {
        const state = await this.prisma.engineState.findUnique({ where: { userId } });
        if (state?.status === 'RUNNING')
            throw new common_1.BadRequestException({ code: 'ALREADY_RUNNING', message: '이미 실행 중입니다.' });
        const apiCfg = await this.prisma.apiConfig.findUnique({ where: { userId } });
        if (!apiCfg)
            throw new common_1.BadRequestException({ code: 'API_NOT_CONFIGURED', message: 'API 키를 먼저 설정하세요.' });
        const active = await this.prisma.strategy.count({ where: { userId, enabled: true } });
        if (active === 0)
            throw new common_1.BadRequestException({ code: 'NO_ACTIVE_STRATEGY', message: '활성화된 전략이 없습니다.' });
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
        return { status: 'RUNNING', startedAt: now };
    }
    async stop(userId, reason = 'MANUAL') {
        await this.prisma.engineState.update({ where: { userId }, data: { status: 'STOPPED', stoppedAt: new Date(), stopReason: reason } });
        this.logger.log(`[${userId}] 자동매매 엔진 중지`);
        return { status: 'STOPPED' };
    }
    async emergencyStop(userId, closePositions = false) {
        this.logger.warn(`[${userId}] 🚨 긴급 정지 실행`);
        await this.prisma.engineState.update({ where: { userId }, data: { status: 'EMERGENCY_STOPPED', stoppedAt: new Date(), stopReason: 'EMERGENCY' } });
        await this.binance.loadApiConfig(userId);
        let canceledOrders = 0;
        try {
            await this.binance.cancelAllOrders();
            canceledOrders = 1;
        }
        catch (e) {
            this.logger.error('주문 취소 실패', e);
        }
        let closedPositions = 0;
        if (closePositions) {
            try {
                const positions = await this.binance.getPositions();
                const open = positions.filter((p) => parseFloat(p.positionAmt) !== 0);
                for (const p of open) {
                    const side = parseFloat(p.positionAmt) > 0 ? 'LONG' : 'SHORT';
                    const orderSide = side === 'LONG' ? 'SELL' : 'BUY';
                    await this.binance.placeOrder({ symbol: p.symbol, side: orderSide, positionSide: side, type: 'MARKET', quantity: Math.abs(parseFloat(p.positionAmt)).toString(), reduceOnly: true });
                    closedPositions++;
                }
            }
            catch (e) {
                this.logger.error('포지션 청산 실패', e);
            }
        }
        return { status: 'EMERGENCY_STOPPED', canceledOrders, closedPositions };
    }
};
exports.EngineService = EngineService;
exports.EngineService = EngineService = EngineService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, binance_service_1.BinanceService])
], EngineService);
//# sourceMappingURL=engine.service.js.map