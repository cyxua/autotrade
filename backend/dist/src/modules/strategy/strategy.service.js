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
exports.StrategyService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let StrategyService = class StrategyService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    findAll(userId, enabledOnly) {
        return this.prisma.strategy.findMany({
            where: { userId, ...(enabledOnly ? { enabled: true } : {}) },
            orderBy: { createdAt: 'desc' },
        });
    }
    async findOne(userId, id) {
        const s = await this.prisma.strategy.findFirst({ where: { id, userId } });
        if (!s)
            throw new common_1.NotFoundException('전략을 찾을 수 없습니다.');
        return s;
    }
    create(userId, dto) {
        return this.prisma.strategy.create({
            data: { ...dto, userId, params: dto.params ?? {} },
        });
    }
    async update(userId, id, dto) {
        await this.findOne(userId, id);
        return this.prisma.strategy.update({
            where: { id },
            data: { ...dto, params: dto.params ?? {} },
        });
    }
    async delete(userId, id) {
        const s = await this.findOne(userId, id);
        if (s.enabled)
            throw new common_1.ConflictException('활성화된 전략은 삭제할 수 없습니다.');
        return this.prisma.strategy.delete({ where: { id } });
    }
    async toggle(userId, id) {
        const s = await this.findOne(userId, id);
        const updated = await this.prisma.strategy.update({
            where: { id },
            data: { enabled: !s.enabled },
        });
        return { enabled: updated.enabled };
    }
};
exports.StrategyService = StrategyService;
exports.StrategyService = StrategyService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], StrategyService);
//# sourceMappingURL=strategy.service.js.map