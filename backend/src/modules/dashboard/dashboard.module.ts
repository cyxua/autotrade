import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { BinanceModule } from '../binance/binance.module';

@Module({
  imports: [BinanceModule],
  controllers: [DashboardController],
})
export class DashboardModule {}
