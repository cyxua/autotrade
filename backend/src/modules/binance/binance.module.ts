import { Module } from '@nestjs/common';
import { BinanceService } from './binance.service';
import { ApiSettingsService } from './api-settings.service';
import { ApiSettingsController } from './api-settings.controller';

@Module({
  providers: [BinanceService, ApiSettingsService],
  controllers: [ApiSettingsController],
  exports: [BinanceService, ApiSettingsService],
})
export class BinanceModule {}
