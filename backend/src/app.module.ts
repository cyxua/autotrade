import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { BinanceModule } from './modules/binance/binance.module';
import { StrategyModule } from './modules/strategy/strategy.module';
import { EngineModule } from './modules/engine/engine.module';
import { RiskModule } from './modules/risk/risk.module';
import { NotificationModule } from './modules/notification/notification.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { OrderModule } from './modules/order/order.module';
import { FuturesModule } from './modules/futures/futures.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration], envFilePath: '.env' }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UserModule,
    BinanceModule,
    StrategyModule,
    EngineModule,
    RiskModule,
    NotificationModule,
    DashboardModule,
    OrderModule,
    FuturesModule,
  ],
})
export class AppModule {}
