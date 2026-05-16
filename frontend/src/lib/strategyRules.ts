export type EvalMode = 'ALL' | 'ANY' | 'SCORE';

// 백엔드 RuleType과 완전 일치
export type RuleType =
  | 'EMA_CROSS'
  | 'SMA_CROSS'
  | 'RSI_RANGE'
  | 'BOLLINGER_BREAKOUT'
  | 'HIGH_LOW_BREAKOUT'
  | 'VOLUME_SPIKE'
  | 'TRADE_COUNT_SURGE'
  | 'ATR_RANGE'
  | 'PRICE_ABOVE_MA'
  | 'PRICE_BELOW_MA';

export interface ParamMeta {
  label: string;
  type: 'number' | 'select';
  options?: { value: string; label: string }[];
  default: number | string;
  min?: number; max?: number; step?: number;
}

export interface RuleSchema { label: string; params: Record<string, ParamMeta>; }

export const RULE_SCHEMA: Record<RuleType, RuleSchema> = {
  RSI_RANGE: {
    label: 'RSI 범위',
    params: {
      period:   { label: '기간',   type: 'number', default: 14,  min: 2,   max: 200 },
      minValue: { label: '최솟값', type: 'number', default: 0,   min: 0,   max: 100 },
      maxValue: { label: '최댓값', type: 'number', default: 30,  min: 0,   max: 100 },
    },
  },
  EMA_CROSS: {
    label: 'EMA 크로스',
    params: {
      fastPeriod: { label: '단기 기간', type: 'number', default: 9,  min: 1, max: 500 },
      slowPeriod: { label: '장기 기간', type: 'number', default: 21, min: 1, max: 500 },
      direction:  { label: '방향', type: 'select', default: 'GOLDEN',
        options: [{ value: 'GOLDEN', label: '골든크로스 (롱)' }, { value: 'DEAD', label: '데드크로스 (숏)' }] },
    },
  },
  SMA_CROSS: {
    label: 'SMA 크로스',
    params: {
      fastPeriod: { label: '단기 기간', type: 'number', default: 10, min: 1, max: 500 },
      slowPeriod: { label: '장기 기간', type: 'number', default: 50, min: 1, max: 500 },
      direction:  { label: '방향', type: 'select', default: 'GOLDEN',
        options: [{ value: 'GOLDEN', label: '골든크로스 (롱)' }, { value: 'DEAD', label: '데드크로스 (숏)' }] },
    },
  },
  BOLLINGER_BREAKOUT: {
    label: '볼린저밴드 돌파',
    params: {
      period:    { label: '기간',    type: 'number', default: 20,  min: 5,   max: 500, step: 1 },
      stdDev:    { label: '표준편차', type: 'number', default: 2.0, min: 0.5, max: 5.0, step: 0.1 },
      direction: { label: '방향',    type: 'select', default: 'UPPER',
        options: [{ value: 'UPPER', label: '상단 돌파' }, { value: 'LOWER', label: '하단 돌파' }] },
    },
  },
  HIGH_LOW_BREAKOUT: {
    label: '고점/저점 돌파',
    params: {
      lookback:  { label: '조회 캔들', type: 'number', default: 20, min: 5, max: 500 },
      direction: { label: '방향', type: 'select', default: 'HIGH',
        options: [{ value: 'HIGH', label: '고점 돌파' }, { value: 'LOW', label: '저점 돌파' }] },
    },
  },
  VOLUME_SPIKE: {
    label: '거래량 급증',
    params: {
      period:     { label: '평균 기간', type: 'number', default: 20,  min: 5,   max: 500 },
      multiplier: { label: '배수',      type: 'number', default: 2.0, min: 1.0, max: 20.0, step: 0.1 },
    },
  },
  TRADE_COUNT_SURGE: {
    label: '거래 횟수 급증',
    params: {
      period:     { label: '평균 기간', type: 'number', default: 20,  min: 5,   max: 500 },
      multiplier: { label: '배수',      type: 'number', default: 1.5, min: 1.0, max: 20.0, step: 0.1 },
    },
  },
  ATR_RANGE: {
    label: 'ATR 범위',
    params: {
      period:   { label: '기간',    type: 'number', default: 14,   min: 2, max: 200 },
      minValue: { label: '최소 ATR', type: 'number', default: 0,    min: 0, max: 99999, step: 0.1 },
      maxValue: { label: '최대 ATR', type: 'number', default: 9999, min: 0, max: 99999, step: 1 },
    },
  },
  PRICE_ABOVE_MA: {
    label: '가격 > MA',
    params: {
      period: { label: '기간',    type: 'number', default: 200, min: 1, max: 500 },
      maType: { label: 'MA 종류', type: 'select', default: 'EMA',
        options: [{ value: 'EMA', label: 'EMA' }, { value: 'SMA', label: 'SMA' }] },
    },
  },
  PRICE_BELOW_MA: {
    label: '가격 < MA',
    params: {
      period: { label: '기간',    type: 'number', default: 200, min: 1, max: 500 },
      maType: { label: 'MA 종류', type: 'select', default: 'EMA',
        options: [{ value: 'EMA', label: 'EMA' }, { value: 'SMA', label: 'SMA' }] },
    },
  },
};

export interface StrategyRule {
  id:      string;
  type:    RuleType;
  params:  Record<string, number | string>;
  weight:  number;
  enabled: boolean;
}

export interface StrategyParams {
  evalMode:            EvalMode;
  minScore:            number;
  longEntryRules:      StrategyRule[];
  shortEntryRules:     StrategyRule[];
  exitRules:           StrategyRule[];
  blockRules:          StrategyRule[];
  useClosedCandleOnly?: boolean;
}

export function makeDefaultRule(type: RuleType): StrategyRule {
  const schema = RULE_SCHEMA[type];
  const params: Record<string, number | string> = {};
  for (const [k, m] of Object.entries(schema.params)) params[k] = m.default;
  return {
    id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type, params, weight: 1, enabled: true,
  };
}

export const DEFAULT_PARAMS: StrategyParams = {
  evalMode: 'ALL', minScore: 60,
  longEntryRules: [], shortEntryRules: [], exitRules: [], blockRules: [],
  useClosedCandleOnly: true,
};
