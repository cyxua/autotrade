import { Module } from '@nestjs/common';
import { EngineService } from './engine.service';
import { StrategyEngineService } from './strategy-engine.service';
import { IndicatorService } from './indicator.service';
import { StrategyRuleEvaluator } from './strategy-rule-evaluator';
import { EngineController } from './engine.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { BinanceModule } from '../binance/binance.module';
import { TradingHealthModule } from './trading-health.module';

@Module({
  imports: [PrismaModule, BinanceModule, TradingHealthModule],
  controllers: [EngineController],
  providers: [
    EngineService,
    StrategyEngineService,
    IndicatorService,
    StrategyRuleEvaluator,
  ],
  // TradingHealthService는 TradingHealthModule에서 제공됨
  exports: [EngineService, StrategyEngineService, TradingHealthModule],
})
export class EngineModule {}
