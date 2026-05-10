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
exports.RiskController = void 0;
const common_1 = require("@nestjs/common");
const risk_service_1 = require("./risk.service");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
let RiskController = class RiskController {
    constructor(svc) {
        this.svc = svc;
    }
    async get(u) { return { success: true, data: await this.svc.getConfig(u.id) }; }
    async update(u, body) { return { success: true, data: await this.svc.updateConfig(u.id, body) }; }
    async logs(u, p = '1', l = '20') {
        return { success: true, data: await this.svc.getBlockLogs(u.id, +p, +l) };
    }
    async resetDaily(u) { return { success: true, data: await this.svc.resetDailyStats(u.id) }; }
    async resetConsec(u) { return { success: true, data: await this.svc.resetConsecLoss(u.id) }; }
};
exports.RiskController = RiskController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], RiskController.prototype, "get", null);
__decorate([
    (0, common_1.Put)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], RiskController.prototype, "update", null);
__decorate([
    (0, common_1.Get)('block-logs'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], RiskController.prototype, "logs", null);
__decorate([
    (0, common_1.Post)('reset-daily'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], RiskController.prototype, "resetDaily", null);
__decorate([
    (0, common_1.Post)('reset-consec-loss'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], RiskController.prototype, "resetConsec", null);
exports.RiskController = RiskController = __decorate([
    (0, common_1.Controller)('settings/risk'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [risk_service_1.RiskService])
], RiskController);
//# sourceMappingURL=risk.controller.js.map