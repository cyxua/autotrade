import { Module } from '@nestjs/common';
import { TradingHealthService } from './trading-health.service';
import { BinanceModule } from '../binance/binance.module';

@Module({
  imports:   [BinanceModule],
  providers: [TradingHealthService],
  exports:   [TradingHealthService],
})
export class TradingHealthModule {}
