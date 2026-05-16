"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IndicatorService = void 0;
const common_1 = require("@nestjs/common");
let IndicatorService = class IndicatorService {
    calcEMA(closes, period) {
        if (closes.length === 0)
            return 0;
        if (closes.length < period)
            return closes[closes.length - 1] ?? 0;
        const k = 2 / (period + 1);
        let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
        for (let i = period; i < closes.length; i++) {
            ema = closes[i] * k + ema * (1 - k);
        }
        return ema;
    }
    calcSMA(values, period) {
        if (values.length === 0)
            return 0;
        const slice = values.slice(-Math.min(period, values.length));
        return slice.reduce((a, b) => a + b, 0) / slice.length;
    }
    calcRSI(closes, period) {
        if (closes.length < period + 1)
            return 50;
        let gains = 0, losses = 0;
        for (let i = closes.length - period; i < closes.length; i++) {
            const diff = closes[i] - closes[i - 1];
            if (diff > 0)
                gains += diff;
            else
                losses -= diff;
        }
        const rs = gains / (losses || 0.0001);
        return 100 - 100 / (1 + rs);
    }
    calcBB(closes, period, stdDev) {
        if (closes.length < period) {
            const last = closes[closes.length - 1] ?? 0;
            return { upper: last, middle: last, lower: last };
        }
        const slice = closes.slice(-period);
        const middle = slice.reduce((a, b) => a + b, 0) / period;
        const std = Math.sqrt(slice.reduce((s, v) => s + (v - middle) ** 2, 0) / period);
        return { upper: middle + stdDev * std, middle, lower: middle - stdDev * std };
    }
    calcATR(highs, lows, closes, period) {
        if (highs.length < period + 1)
            return 0;
        const trs = [];
        for (let i = highs.length - period; i < highs.length; i++) {
            const prevClose = closes[i - 1];
            trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - prevClose), Math.abs(lows[i] - prevClose)));
        }
        return trs.reduce((a, b) => a + b, 0) / trs.length;
    }
    closes(klines) { return klines.map(k => k.close); }
    highs(klines) { return klines.map(k => k.high); }
    lows(klines) { return klines.map(k => k.low); }
    volumes(klines) { return klines.map(k => k.volume); }
    tradeCounts(klines) { return klines.map(k => k.tradeCount ?? 0); }
};
exports.IndicatorService = IndicatorService;
exports.IndicatorService = IndicatorService = __decorate([
    (0, common_1.Injectable)()
], IndicatorService);
//# sourceMappingURL=indicator.service.js.map