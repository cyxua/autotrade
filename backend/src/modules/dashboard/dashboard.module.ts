import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { TradingHealthModule } from '../engine/trading-health.module';

@Module({
  imports:     [TradingHealthModule],
  controllers: [DashboardController],
})
export class DashboardModule {}
