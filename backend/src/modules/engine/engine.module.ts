import { Module } from '@nestjs/common';
import { EngineService } from './engine.service';
import { StrategyEngineService } from './strategy-engine.service';
import { IndicatorService } from './indicator.service';
import { StrategyRuleEvaluator } from './strategy-rule-evaluator';
import { EngineController } from './engine.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { BinanceModule } from '../binance/binance.module';

@Module({
  imports: [PrismaModule, BinanceModule],
  controllers: [EngineController],
  providers: [
    EngineService,
    StrategyEngineService,
    IndicatorService,
    StrategyRuleEvaluator,
  ],
  exports: [EngineService, StrategyEngineService],
})
export class EngineModule {}
