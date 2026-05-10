"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BinanceModule = void 0;
const common_1 = require("@nestjs/common");
const binance_service_1 = require("./binance.service");
const api_settings_service_1 = require("./api-settings.service");
const api_settings_controller_1 = require("./api-settings.controller");
let BinanceModule = class BinanceModule {
};
exports.BinanceModule = BinanceModule;
exports.BinanceModule = BinanceModule = __decorate([
    (0, common_1.Module)({
        providers: [binance_service_1.BinanceService, api_settings_service_1.ApiSettingsService],
        controllers: [api_settings_controller_1.ApiSettingsController],
        exports: [binance_service_1.BinanceService, api_settings_service_1.ApiSettingsService],
    })
], BinanceModule);
//# sourceMappingURL=binance.module.js.map