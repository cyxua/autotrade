"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var StrategyRuleEvaluator_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StrategyRuleEvaluator = exports.RULE_PARAMS_SCHEMA = void 0;
exports.validateRule = validateRule;
const common_1 = require("@nestjs/common");
const indicator_service_1 = require("./indicator.service");
exports.RULE_PARAMS_SCHEMA = {
    EMA_CROSS: { fastPeriod: { type: 'number', default: 9, min: 1, max: 500 }, slowPeriod: { type: 'number', default: 21, min: 1, max: 500 }, direction: { type: 'select', default: 'GOLDEN', options: ['GOLDEN', 'DEAD'] } },
    SMA_CROSS: { fastPeriod: { type: 'number', default: 10, min: 1, max: 500 }, slowPeriod: { type: 'number', default: 50, min: 1, max: 500 }, direction: { type: 'select', default: 'GOLDEN', options: ['GOLDEN', 'DEAD'] } },
    RSI_RANGE: { period: { type: 'number', default: 14, min: 2, max: 200 }, minValue: { type: 'number', default: 0, min: 0, max: 100 }, maxValue: { type: 'number', default: 30, min: 0, max: 100 } },
    BOLLINGER_BREAKOUT: { period: { type: 'number', default: 20, min: 5, max: 500 }, stdDev: { type: 'number', default: 2.0, min: 0.5, max: 5.0 }, direction: { type: 'select', default: 'UPPER', options: ['UPPER', 'LOWER'] } },
    HIGH_LOW_BREAKOUT: { lookback: { type: 'number', default: 20, min: 5, max: 500 }, direction: { type: 'select', default: 'HIGH', options: ['HIGH', 'LOW'] } },
    VOLUME_SPIKE: { period: { type: 'number', default: 20, min: 5, max: 500 }, multiplier: { type: 'number', default: 2.0, min: 1.0, max: 20.0 } },
    TRADE_COUNT_SURGE: { period: { type: 'number', default: 20, min: 5, max: 500 }, multiplier: { type: 'number', default: 1.5, min: 1.0, max: 20.0 } },
    ATR_RANGE: { period: { type: 'number', default: 14, min: 2, max: 200 }, minValue: { type: 'number', default: 0, min: 0, max: 99999 }, maxValue: { type: 'number', default: 9999, min: 0, max: 99999 } },
    PRICE_ABOVE_MA: { period: { type: 'number', default: 200, min: 1, max: 500 }, maType: { type: 'select', default: 'EMA', options: ['EMA', 'SMA'] } },
    PRICE_BELOW_MA: { period: { type: 'number', default: 200, min: 1, max: 500 }, maType: { type: 'select', default: 'EMA', options: ['EMA', 'SMA'] } },
};
function validateRule(rule) {
    const schema = exports.RULE_PARAMS_SCHEMA[rule.type];
    if (!schema)
        return `알 수 없는 rule type: ${rule.type}`;
    for (const [key, meta] of Object.entries(schema)) {
        if (meta.type === 'select')
            continue;
        const val = rule.params[key];
        if (val === undefined || val === null)
            return `${rule.type}.${key} 값이 필요합니다`;
        if (meta.min !== undefined && val < meta.min)
            return `${rule.type}.${key}는 ${meta.min} 이상이어야 합니다`;
        if (meta.max !== undefined && val > meta.max)
            return `${rule.type}.${key}는 ${meta.max} 이하여야 합니다`;
    }
    return null;
}
let StrategyRuleEvaluator = StrategyRuleEvaluator_1 = class StrategyRuleEvaluator {
    indicator;
    logger = new common_1.Logger(StrategyRuleEvaluator_1.name);
    constructor(indicator) {
        this.indicator = indicator;
    }
    evaluate(rules, klines, evalMode = 'ALL', minScore = 60) {
        const activeRules = rules.filter(r => r.enabled);
        if (activeRules.length === 0)
            return { signal: false, score: 0, details: [] };
        const details = [];
        for (const rule of activeRules) {
            try {
                const { passed, value } = this.evaluateRule(rule, klines);
                details.push({ ruleId: rule.id, type: rule.type, passed, value, weight: rule.weight ?? 1 });
            }
            catch (e) {
                this.logger.warn(`Rule 평가 오류 [${rule.type}]: ${e.message}`);
                details.push({ ruleId: rule.id, type: rule.type, passed: false, value: 0, weight: rule.weight ?? 1 });
            }
        }
        const totalWeight = details.reduce((s, d) => s + d.weight, 0);
        const passedWeight = details.filter(d => d.passed).reduce((s, d) => s + d.weight, 0);
        const score = totalWeight > 0 ? Math.round((passedWeight / totalWeight) * 100) : 0;
        let signal;
        switch (evalMode) {
            case 'ALL':
                signal = details.every(d => d.passed);
                break;
            case 'ANY':
                signal = details.some(d => d.passed);
                break;
            case 'SCORE':
                signal = score >= minScore;
                break;
            default: signal = false;
        }
        return { signal, score, details };
    }
    evaluateRule(rule, klines) {
        const p = rule.params;
        const closes = this.indicator.closes(klines);
        const volumes = this.indicator.volumes(klines);
        const highs = this.indicator.highs(klines);
        const lows = this.indicator.lows(klines);
        const last = closes.at(-1) ?? 0;
        switch (rule.type) {
            case 'RSI_RANGE': {
                const rsi = this.indicator.calcRSI(closes, p.period);
                return { value: rsi, passed: rsi >= p.minValue && rsi <= p.maxValue };
            }
            case 'EMA_CROSS': {
                const fast = this.indicator.calcEMA(closes, p.fastPeriod);
                const slow = this.indicator.calcEMA(closes, p.slowPeriod);
                const prevFast = this.indicator.calcEMA(closes.slice(0, -1), p.fastPeriod);
                const prevSlow = this.indicator.calcEMA(closes.slice(0, -1), p.slowPeriod);
                const passed = p.direction === 'GOLDEN'
                    ? prevFast <= prevSlow && fast > slow
                    : prevFast >= prevSlow && fast < slow;
                return { value: parseFloat((fast - slow).toFixed(6)), passed };
            }
            case 'SMA_CROSS': {
                const fast = this.indicator.calcSMA(closes, p.fastPeriod);
                const slow = this.indicator.calcSMA(closes, p.slowPeriod);
                const prevFast = this.indicator.calcSMA(closes.slice(0, -1), p.fastPeriod);
                const prevSlow = this.indicator.calcSMA(closes.slice(0, -1), p.slowPeriod);
                const passed = p.direction === 'GOLDEN'
                    ? prevFast <= prevSlow && fast > slow
                    : prevFast >= prevSlow && fast < slow;
                return { value: parseFloat((fast - slow).toFixed(6)), passed };
            }
            case 'BOLLINGER_BREAKOUT': {
                const { upper, lower } = this.indicator.calcBB(closes, p.period, p.stdDev);
                const passed = p.direction === 'UPPER' ? last > upper : last < lower;
                return { value: parseFloat((p.direction === 'UPPER' ? last - upper : lower - last).toFixed(6)), passed };
            }
            case 'HIGH_LOW_BREAKOUT': {
                const lookback = Math.min(p.lookback, klines.length - 1);
                const slice = klines.slice(-lookback - 1, -1);
                if (slice.length === 0)
                    return { value: 0, passed: false };
                const extreme = p.direction === 'HIGH'
                    ? Math.max(...slice.map(k => k.high))
                    : Math.min(...slice.map(k => k.low));
                const passed = p.direction === 'HIGH' ? last > extreme : last < extreme;
                return { value: parseFloat((last - extreme).toFixed(6)), passed };
            }
            case 'VOLUME_SPIKE': {
                const recent = volumes.slice(0, -1);
                const avgVol = this.indicator.calcSMA(recent, Math.min(p.period, recent.length));
                const curVol = volumes.at(-1) ?? 0;
                const ratio = avgVol > 0 ? curVol / avgVol : 0;
                return { value: parseFloat(ratio.toFixed(4)), passed: ratio >= p.multiplier };
            }
            case 'TRADE_COUNT_SURGE': {
                const recent = volumes.slice(0, -1);
                const avgVol = this.indicator.calcSMA(recent, Math.min(p.period, recent.length));
                const curVol = volumes.at(-1) ?? 0;
                const ratio = avgVol > 0 ? curVol / avgVol : 0;
                return { value: parseFloat(ratio.toFixed(4)), passed: ratio >= p.multiplier };
            }
            case 'ATR_RANGE': {
                const atr = this.indicator.calcATR(highs, lows, closes, p.period);
                return { value: parseFloat(atr.toFixed(6)), passed: atr >= p.minValue && atr <= p.maxValue };
            }
            case 'PRICE_ABOVE_MA': {
                const ma = p.maType === 'SMA'
                    ? this.indicator.calcSMA(closes, p.period)
                    : this.indicator.calcEMA(closes, p.period);
                return { value: parseFloat((last - ma).toFixed(6)), passed: last > ma };
            }
            case 'PRICE_BELOW_MA': {
                const ma = p.maType === 'SMA'
                    ? this.indicator.calcSMA(closes, p.period)
                    : this.indicator.calcEMA(closes, p.period);
                return { value: parseFloat((ma - last).toFixed(6)), passed: last < ma };
            }
            default:
                return { value: 0, passed: false };
        }
    }
};
exports.StrategyRuleEvaluator = StrategyRuleEvaluator;
exports.StrategyRuleEvaluator = StrategyRuleEvaluator = StrategyRuleEvaluator_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [indicator_service_1.IndicatorService])
], StrategyRuleEvaluator);
//# sourceMappingURL=strategy-rule-evaluator.js.map