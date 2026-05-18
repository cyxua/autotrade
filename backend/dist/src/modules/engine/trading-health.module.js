"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradingHealthModule = void 0;
const common_1 = require("@nestjs/common");
const trading_health_service_1 = require("./trading-health.service");
const binance_module_1 = require("../binance/binance.module");
let TradingHealthModule = class TradingHealthModule {
};
exports.TradingHealthModule = TradingHealthModule;
exports.TradingHealthModule = TradingHealthModule = __decorate([
    (0, common_1.Module)({
        imports: [binance_module_1.BinanceModule],
        providers: [trading_health_service_1.TradingHealthService],
        exports: [trading_health_service_1.TradingHealthService],
    })
], TradingHealthModule);
//# sourceMappingURL=trading-health.module.js.map