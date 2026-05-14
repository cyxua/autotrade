import { Module } from '@nestjs/common';
import { EngineService } from './engine.service';
import { EngineController } from './engine.controller';
import { BinanceModule } from '../binance/binance.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { StrategyEngineService } from './strategy-engine.service';

@Module({
  imports: [BinanceModule, PrismaModule],
  providers: [EngineService, StrategyEngineService],
  controllers: [EngineController],
  exports: [EngineService, StrategyEngineService],
})
export class EngineModule {}
