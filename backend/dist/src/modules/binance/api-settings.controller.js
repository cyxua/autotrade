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
exports.ApiSettingsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const api_settings_service_1 = require("./api-settings.service");
const api_config_dto_1 = require("./dto/api-config.dto");
let ApiSettingsController = class ApiSettingsController {
    constructor(svc) {
        this.svc = svc;
    }
    async get(u) { return { success: true, data: await this.svc.getConfig(u.id) }; }
    async save(u, dto) { return { success: true, data: await this.svc.saveConfig(u.id, dto) }; }
    async test(u) { return { success: true, data: await this.svc.testConnection(u.id) }; }
    async changeMode(u, dto) { return { success: true, data: await this.svc.changeMode(u.id, dto) }; }
};
exports.ApiSettingsController = ApiSettingsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ApiSettingsController.prototype, "get", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, api_config_dto_1.SaveApiConfigDto]),
    __metadata("design:returntype", Promise)
], ApiSettingsController.prototype, "save", null);
__decorate([
    (0, common_1.Post)('test'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ApiSettingsController.prototype, "test", null);
__decorate([
    (0, common_1.Put)('mode'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, api_config_dto_1.ChangeModeDto]),
    __metadata("design:returntype", Promise)
], ApiSettingsController.prototype, "changeMode", null);
exports.ApiSettingsController = ApiSettingsController = __decorate([
    (0, common_1.Controller)('settings/api'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [api_settings_service_1.ApiSettingsService])
], ApiSettingsController);
//# sourceMappingURL=api-settings.controller.js.map