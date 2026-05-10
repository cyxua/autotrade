import { Module } from '@nestjs/common';
import { EngineService } from './engine.service';
import { EngineController } from './engine.controller';
import { BinanceModule } from '../binance/binance.module';

@Module({
  imports: [BinanceModule],
  providers: [EngineService],
  controllers: [EngineController],
  exports: [EngineService],
})
export class EngineModule {}
