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
exports.FuturesController = void 0;
const common_1 = require("@nestjs/common");
const futures_service_1 = require("./futures.service");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
let FuturesController = class FuturesController {
    svc;
    constructor(svc) {
        this.svc = svc;
    }
    async symbols() {
        return { success: true, data: await this.svc.getSymbols() };
    }
    async tickers() {
        return { success: true, data: await this.svc.getTickers() };
    }
    async klines(symbol, interval = '15m', limit = '500') {
        return { success: true, data: await this.svc.getKlines(symbol, interval, parseInt(limit)) };
    }
    async price(symbol) {
        return { success: true, data: await this.svc.getPrice(symbol) };
    }
    async balance(u) {
        return { success: true, data: await this.svc.getBalance(u.id) };
    }
    async account(u) {
        return { success: true, data: await this.svc.getAccount(u.id) };
    }
    async positions(u) {
        return { success: true, data: await this.svc.getPositions(u.id) };
    }
    async orders(u, symbol, limit = '20') {
        if (!symbol) {
            const botOrders = await this.svc.getBotOrders(u.id, parseInt(limit));
            return { success: true, data: botOrders, source: 'db' };
        }
        try {
            const data = await this.svc.getOrders(u.id, symbol, parseInt(limit));
            return { success: true, data, source: 'binance' };
        }
        catch {
            const botOrders = await this.svc.getBotOrders(u.id, parseInt(limit));
            return { success: true, data: botOrders, source: 'db' };
        }
    }
};
exports.FuturesController = FuturesController;
__decorate([
    (0, common_1.Get)('symbols'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], FuturesController.prototype, "symbols", null);
__decorate([
    (0, common_1.Get)('tickers'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], FuturesController.prototype, "tickers", null);
__decorate([
    (0, common_1.Get)('klines'),
    __param(0, (0, common_1.Query)('symbol')),
    __param(1, (0, common_1.Query)('interval')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], FuturesController.prototype, "klines", null);
__decorate([
    (0, common_1.Get)('price'),
    __param(0, (0, common_1.Query)('symbol')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], FuturesController.prototype, "price", null);
__decorate([
    (0, common_1.Get)('balance'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], FuturesController.prototype, "balance", null);
__decorate([
    (0, common_1.Get)('account'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], FuturesController.prototype, "account", null);
__decorate([
    (0, common_1.Get)('positions'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], FuturesController.prototype, "positions", null);
__decorate([
    (0, common_1.Get)('orders'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('symbol')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], FuturesController.prototype, "orders", null);
exports.FuturesController = FuturesController = __decorate([
    (0, common_1.Controller)('futures'),
    __metadata("design:paramtypes", [futures_service_1.FuturesService])
], FuturesController);
//# sourceMappingURL=futures.controller.js.map