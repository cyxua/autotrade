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
exports.StrategyController = void 0;
const common_1 = require("@nestjs/common");
const strategy_service_1 = require("./strategy.service");
const strategy_dto_1 = require("./dto/strategy.dto");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
let StrategyController = class StrategyController {
    constructor(svc) {
        this.svc = svc;
    }
    async list(u, enabled) {
        return { success: true, data: await this.svc.findAll(u.id, enabled === 'true') };
    }
    async create(u, dto) {
        return { success: true, data: await this.svc.create(u.id, dto) };
    }
    async get(u, id) {
        return { success: true, data: await this.svc.findOne(u.id, id) };
    }
    async update(u, id, dto) {
        return { success: true, data: await this.svc.update(u.id, id, dto) };
    }
    async delete(u, id) {
        await this.svc.delete(u.id, id);
        return { success: true };
    }
    async toggle(u, id) {
        return { success: true, data: await this.svc.toggle(u.id, id) };
    }
};
exports.StrategyController = StrategyController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('enabled')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], StrategyController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, strategy_dto_1.CreateStrategyDto]),
    __metadata("design:returntype", Promise)
], StrategyController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], StrategyController.prototype, "get", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, strategy_dto_1.CreateStrategyDto]),
    __metadata("design:returntype", Promise)
], StrategyController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], StrategyController.prototype, "delete", null);
__decorate([
    (0, common_1.Patch)(':id/toggle'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], StrategyController.prototype, "toggle", null);
exports.StrategyController = StrategyController = __decorate([
    (0, common_1.Controller)('strategies'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [strategy_service_1.StrategyService])
], StrategyController);
//# sourceMappingURL=strategy.controller.js.map