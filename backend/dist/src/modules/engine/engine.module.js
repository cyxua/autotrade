"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EngineModule = void 0;
const common_1 = require("@nestjs/common");
const engine_service_1 = require("./engine.service");
const engine_controller_1 = require("./engine.controller");
const binance_module_1 = require("../binance/binance.module");
let EngineModule = class EngineModule {
};
exports.EngineModule = EngineModule;
exports.EngineModule = EngineModule = __decorate([
    (0, common_1.Module)({
        imports: [binance_module_1.BinanceModule],
        providers: [engine_service_1.EngineService],
        controllers: [engine_controller_1.EngineController],
        exports: [engine_service_1.EngineService],
    })
], EngineModule);
//# sourceMappingURL=engine.module.js.map