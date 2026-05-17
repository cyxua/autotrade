import { IndicatorService, Kline } from './indicator.service';
export type RuleType = 'EMA_CROSS' | 'SMA_CROSS' | 'RSI_RANGE' | 'BOLLINGER_BREAKOUT' | 'HIGH_LOW_BREAKOUT' | 'VOLUME_SPIKE' | 'TRADE_COUNT_SURGE' | 'ATR_RANGE' | 'PRICE_ABOVE_MA' | 'PRICE_BELOW_MA' | 'TEST_FORCE_ENTRY_ONCE';
export type EvalMode = 'ALL' | 'ANY' | 'SCORE';
export interface StrategyRule {
    id: string;
    type: RuleType;
    params: Record<string, any>;
    weight?: number;
    enabled: boolean;
}
export interface RuleDetail {
    ruleId: string;
    type: RuleType;
    passed: boolean;
    value: number;
    weight: number;
}
export interface EvalResult {
    signal: boolean;
    score: number;
    details: RuleDetail[];
}
export declare const RULE_PARAMS_SCHEMA: Record<RuleType, Record<string, {
    type: string;
    default: any;
    min?: number;
    max?: number;
    options?: string[];
}>>;
export declare function validateRule(rule: StrategyRule): string | null;
export declare class StrategyRuleEvaluator {
    private readonly indicator;
    private readonly logger;
    constructor(indicator: IndicatorService);
    evaluate(rules: StrategyRule[], klines: Kline[], evalMode?: EvalMode, minScore?: number): EvalResult;
    private evaluateRule;
}
