export type EvalMode = 'ALL' | 'ANY' | 'SCORE';

export type RuleType =
  | 'RSI_RANGE' | 'EMA_CROSS'
  | 'PRICE_ABOVE_MA' | 'PRICE_BELOW_MA'
  | 'VOLUME_SPIKE' | 'BB_BREAKOUT' | 'ATR_FILTER';

export interface ParamMeta {
  label: string;
  type: 'number' | 'select';
  options?: { value: string; label: string }[];
  default: number | string;
  min?: number; max?: number; step?: number;
}

export interface RuleSchema { label: string; params: Record<string, ParamMeta>; }

export const RULE_SCHEMA: Record<RuleType, RuleSchema> = {
  RSI_RANGE:     { label: 'RSI 범위',         params: { period:     { label: '기간',      type: 'number', default: 14,  min: 2,   max: 100         }, minValue:    { label: '최솟값', type: 'number', default: 0,   min: 0,   max: 100         }, maxValue:    { label: '최댓값', type: 'number', default: 45,  min: 0,   max: 100         } } },
  EMA_CROSS:     { label: 'EMA 크로스',        params: { fastPeriod: { label: '단기 기간', type: 'number', default: 9,   min: 2,   max: 200         }, slowPeriod:  { label: '장기 기간', type: 'number', default: 21, min: 2,   max: 200         } } },
  PRICE_ABOVE_MA:{ label: '가격 > MA',         params: { period:     { label: '기간',      type: 'number', default: 20,  min: 2,   max: 200         }, maType:      { label: 'MA 종류', type: 'select', default: 'EMA', options: [{value:'EMA',label:'EMA'},{value:'SMA',label:'SMA'}] } } },
  PRICE_BELOW_MA:{ label: '가격 < MA',         params: { period:     { label: '기간',      type: 'number', default: 20,  min: 2,   max: 200         }, maType:      { label: 'MA 종류', type: 'select', default: 'EMA', options: [{value:'EMA',label:'EMA'},{value:'SMA',label:'SMA'}] } } },
  VOLUME_SPIKE:  { label: '거래량 급증',        params: { multiplier: { label: '배수',      type: 'number', default: 2.0, min: 1.0, max: 10.0, step: 0.1 }, period:      { label: '평균 기간', type: 'number', default: 20, min: 2,   max: 100         } } },
  BB_BREAKOUT:   { label: '볼린저밴드 돌파',    params: { period:     { label: '기간',      type: 'number', default: 20,  min: 2,   max: 100         }, stdDev:      { label: '표준편차', type: 'number', default: 2.0, min: 0.5, max: 5.0,  step: 0.1 }, direction:   { label: '방향',    type: 'select', default: 'upper', options: [{value:'upper',label:'상단 돌파'},{value:'lower',label:'하단 돌파'}] } } },
  ATR_FILTER:    { label: 'ATR 필터',          params: { period:     { label: '기간',      type: 'number', default: 14,  min: 2,   max: 100         }, minAtr:      { label: '최소 ATR', type: 'number', default: 0.5, min: 0,   max: 100,  step: 0.1 } } },
};

export interface StrategyRule {
  id: string;
  type: RuleType;
  params: Record<string, number | string>;
  weight: number;
  enabled: boolean;
}

export interface StrategyParams {
  evalMode: EvalMode;
  minScore: number;
  longEntryRules:  StrategyRule[];
  shortEntryRules: StrategyRule[];
  exitRules:       StrategyRule[];
  blockRules:      StrategyRule[];
}

export function makeDefaultRule(type: RuleType): StrategyRule {
  const schema = RULE_SCHEMA[type];
  const params: Record<string, number | string> = {};
  for (const [k, m] of Object.entries(schema.params)) params[k] = m.default;
  return { id: `rule-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, type, params, weight: 1, enabled: true };
}

export const DEFAULT_PARAMS: StrategyParams = {
  evalMode: 'ALL', minScore: 60,
  longEntryRules: [], shortEntryRules: [], exitRules: [], blockRules: [],
};
