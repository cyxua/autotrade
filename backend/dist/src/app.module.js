"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const schedule_1 = require("@nestjs/schedule");
const configuration_1 = __importDefault(require("./config/configuration"));
const prisma_module_1 = require("./prisma/prisma.module");
const auth_module_1 = require("./modules/auth/auth.module");
const user_module_1 = require("./modules/user/user.module");
const binance_module_1 = require("./modules/binance/binance.module");
const strategy_module_1 = require("./modules/strategy/strategy.module");
const engine_module_1 = require("./modules/engine/engine.module");
const risk_module_1 = require("./modules/risk/risk.module");
const notification_module_1 = require("./modules/notification/notification.module");
const dashboard_module_1 = require("./modules/dashboard/dashboard.module");
const order_module_1 = require("./modules/order/order.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true, load: [configuration_1.default], envFilePath: '.env' }),
            schedule_1.ScheduleModule.forRoot(),
            prisma_module_1.PrismaModule,
            auth_module_1.AuthModule,
            user_module_1.UserModule,
            binance_module_1.BinanceModule,
            strategy_module_1.StrategyModule,
            engine_module_1.EngineModule,
            risk_module_1.RiskModule,
            notification_module_1.NotificationModule,
            dashboard_module_1.DashboardModule,
            order_module_1.OrderModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map