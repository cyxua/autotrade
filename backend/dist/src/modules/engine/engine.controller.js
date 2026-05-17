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
exports.EngineController = void 0;
const common_1 = require("@nestjs/common");
const engine_service_1 = require("./engine.service");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
let EngineController = class EngineController {
    engine;
    constructor(engine) {
        this.engine = engine;
    }
    async getStatus(u) { return { success: true, data: await this.engine.getStatus(u.id) }; }
    async start(u) { return { success: true, data: await this.engine.start(u.id) }; }
    async stop(u) { return { success: true, data: await this.engine.stop(u.id) }; }
    async emergencyStop(u, body) {
        return { success: true, data: await this.engine.emergencyStop(u.id, body.closePositions ?? true) };
    }
    async resetEmergency(u) {
        return { success: true, data: await this.engine.resetEmergencyStop(u.id) };
    }
    async closePosition(u, body) {
        return { success: true, data: await this.engine.closePosition(u.id, body.symbol) };
    }
};
exports.EngineController = EngineController;
__decorate([
    (0, common_1.Get)('status'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], EngineController.prototype, "getStatus", null);
__decorate([
    (0, common_1.Post)('start'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], EngineController.prototype, "start", null);
__decorate([
    (0, common_1.Post)('stop'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], EngineController.prototype, "stop", null);
__decorate([
    (0, common_1.Post)('emergency-stop'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], EngineController.prototype, "emergencyStop", null);
__decorate([
    (0, common_1.Post)('reset-emergency'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], EngineController.prototype, "resetEmergency", null);
__decorate([
    (0, common_1.Post)('close-position'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], EngineController.prototype, "closePosition", null);
exports.EngineController = EngineController = __decorate([
    (0, common_1.Controller)('engine'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [engine_service_1.EngineService])
], EngineController);
//# sourceMappingURL=engine.controller.js.map