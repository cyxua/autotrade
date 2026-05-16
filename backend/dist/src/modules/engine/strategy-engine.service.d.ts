import { PrismaService } from '../../prisma/prisma.service';
import { BinanceService } from '../binance/binance.service';
import { IndicatorService } from './indicator.service';
import { StrategyRuleEvaluator } from './strategy-rule-evaluator';
export declare class StrategyEngineService {
    private prisma;
    private binance;
    private indicator;
    private evaluator;
    private readonly logger;
    private timers;
    constructor(prisma: PrismaService, binance: BinanceService, indicator: IndicatorService, evaluator: StrategyRuleEvaluator);
    startEngine(userId: string): Promise<void>;
    stopEngine(userId: string): void;
    private haltEngine;
    private scanStrategies;
    private riskGuard;
    private processStrategy;
    private enterPosition;
}
