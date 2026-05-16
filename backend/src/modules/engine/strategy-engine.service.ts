function formatQty(qty: number, step: number): string {
  const precision = step < 1 ? (String(step).split('.')[1]?.length ?? 0) : 0;
  return (Math.floor(qty / step) * step).toFixed(precision);
}
function formatPrice(price: number, tickSize: number): string {
  const precision = tickSize < 1 ? (String(tickSize).split('.')[1]?.length ?? 0) : 0;
  return (Math.floor(price / tickSize) * tickSize).toFixed(precision);
}

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BinanceService } from '../binance/binance.service';
import { IndicatorService, Kline } from './indicator.service';
import { StrategyRuleEvaluator, StrategyRule, EvalMode, validateRule } from './strategy-rule-evaluator';

interface StrategyParams {
  evalMode?:           EvalMode;
  minScore?:           number;
  longEntryRules?:     StrategyRule[];
  shortEntryRules?:    StrategyRule[];
  exitRules?:          StrategyRule[];
  blockRules?:         StrategyRule[];
  useClosedCandleOnly?: boolean;
}

@Injectable()
export class StrategyEngineService {
  private readonly logger = new Logger(StrategyEngineService.name);
  private timers = new Map<string, NodeJS.Timeout>();

  constructor(
    private prisma:    PrismaService,
    private binance:   BinanceService,
    private indicator: IndicatorService,
    private evaluator: StrategyRuleEvaluator,
  ) {}

  async startEngine(userId: string) {
    this.stopEngine(userId);
    const timer = setInterval(() => this.scanStrategies(userId), 60000);
    this.timers.set(userId, timer);
    this.logger.log(`[${userId}] 전략 엔진 스캔 시작`);
    await this.scanStrategies(userId);
  }

  stopEngine(userId: string) {
    const t = this.timers.get(userId);
    if (t) { clearInterval(t); this.timers.delete(userId); }
  }

  private async haltEngine(userId: string, reason: string) {
    this.stopEngine(userId);
    try {
      await this.prisma.engineState.updateMany({
        where: { userId },
        data:  { status: 'STOPPED' as any, stopReason: reason },
      });
      this.logger.error(`[${userId}] 엔진 강제 중지: ${reason}`);
    } catch (e: any) {
      this.logger.error('엔진 중지 DB 업데이트 실패', e.message);
    }
  }

  private async scanStrategies(userId: string) {
    try {
      const state = await this.prisma.engineState.findFirst({ where: { userId } });
      if (!state || state.status !== 'RUNNING') return;
      const strategies = await this.prisma.strategy.findMany({ where: { userId, enabled: true } });
      for (const strategy of strategies) {
        await this.processStrategy(userId, strategy);
      }
    } catch (e) {
      this.logger.error('스캔 오류', e);
    }
  }

  private async riskGuard(userId: string, strategy: any): Promise<{ ok: boolean; reason?: string }> {
    const state = await this.prisma.engineState.findFirst({ where: { userId } });
    if (!state || state.status !== 'RUNNING') return { ok: false, reason: 'ENGINE_NOT_RUNNING' };
    if ((strategy.leverage ?? 1) > 20) return { ok: false, reason: 'LEVERAGE_EXCEEDED' };

    const openPositions = await this.prisma.position.count({
      where: { userId, symbol: strategy.symbol, status: 'OPEN' },
    });
    if (openPositions >= (strategy.maxPositions ?? 1)) return { ok: false, reason: 'MAX_POSITIONS_REACHED' };

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayOrders = await this.prisma.order.count({
      where: { userId, strategyId: strategy.id, createdAt: { gte: today } },
    });
    if (todayOrders >= (strategy.maxDailyTrades ?? 10)) return { ok: false, reason: 'DAILY_TRADES_EXCEEDED' };

    return { ok: true };
  }

  private async processStrategy(userId: string, strategy: any) {
    try {
      const params = (strategy.params ?? {}) as StrategyParams;

      // exitRules는 현재 미평가 — 경고 로그
      if ((params.exitRules ?? []).length > 0) {
        this.logger.warn(`[${strategy.symbol}] exitRules가 설정되어 있으나 현재 엔진에서 평가되지 않습니다.`);
      }

      const tfMap: Record<string, string> = { m1:'1m', m5:'5m', m15:'15m', h1:'1h', h4:'4h' };
      const interval = tfMap[strategy.timeframe] ?? '15m';

      let klines: Kline[] = await this.binance.getKlines(strategy.symbol, interval, 250);

      // useClosedCandleOnly: 종료된 캔들만 사용 (기본 true)
      const useClosedOnly = params.useClosedCandleOnly !== false;
      if (useClosedOnly) {
        const now = Date.now();
        klines = klines.filter(k => k.closeTime < now);
      }

      // 최소 캔들 수 검증 (50개 미만이면 스킵)
      if (klines.length < 50) {
        this.logger.warn(`[${strategy.symbol}] 캔들 수 부족 (${klines.length}), 스킵`);
        return;
      }

      const evalMode = params.evalMode ?? 'ALL';
      const minScore = params.minScore ?? 60;

      // blockRules 평가
      const blockRules = params.blockRules ?? [];
      if (blockRules.length > 0) {
        const blockResult = this.evaluator.evaluate(blockRules, klines, 'ANY');
        if (blockResult.signal) {
          this.logger.log(`[${strategy.symbol}] 차단 조건 발동 — 스킵`);
          return;
        }
      }

      // 진입 방향 판단
      const directions: Array<'LONG' | 'SHORT'> = [];
      if (strategy.allowLong) {
        const longRules = params.longEntryRules ?? [];
        // rule validation
        for (const r of longRules) {
          const err = validateRule(r);
          if (err) { this.logger.warn(`[${strategy.symbol}] 롱 rule 오류: ${err}`); return; }
        }
        const longResult = this.evaluator.evaluate(longRules, klines, evalMode, minScore);
        if (longResult.signal) directions.push('LONG');
      }
      if (strategy.allowShort) {
        const shortRules = params.shortEntryRules ?? [];
        for (const r of shortRules) {
          const err = validateRule(r);
          if (err) { this.logger.warn(`[${strategy.symbol}] 숏 rule 오류: ${err}`); return; }
        }
        const shortResult = this.evaluator.evaluate(shortRules, klines, evalMode, minScore);
        if (shortResult.signal) directions.push('SHORT');
      }

      for (const direction of directions) {
        const guard = await this.riskGuard(userId, strategy);
        if (!guard.ok) {
          this.logger.log(`[${strategy.symbol}] 리스크 차단: ${guard.reason}`);
          continue;
        }
        await this.enterPosition(userId, strategy, direction, klines);
      }
    } catch (e: any) {
      this.logger.error(`[${strategy.symbol}] processStrategy 오류: ${e.message}`);
    }
  }

  private async enterPosition(userId: string, strategy: any, direction: 'LONG' | 'SHORT', klines: Kline[]) {
    const symbol = strategy.symbol;
    try {
      const filters = await this.binance.getSymbolFilters(symbol);
      const price   = await this.binance.getTickerPrice(symbol);

      await this.binance.setLeverage(symbol, strategy.leverage);
      await this.binance.setMarginType(symbol, strategy.marginType);

      const notional = strategy.positionSizeUsdt * strategy.leverage;
      const rawQty   = notional / price;
      const qty      = formatQty(rawQty, filters.stepSize);

      if (parseFloat(qty) < filters.minQty) {
        this.logger.warn(`[${symbol}] 최소 수량 미달: ${qty} < ${filters.minQty}`);
        return;
      }

      const side = direction === 'LONG' ? 'BUY' : 'SELL';
      const orderRes = await this.binance.placeOrder({
        symbol, side, positionSide: 'BOTH', type: 'MARKET', quantity: qty,
      });

      const fillPrice  = parseFloat(orderRes.avgPrice ?? orderRes.price ?? String(price));
      const filledQty  = parseFloat(orderRes.executedQty ?? qty);
      const orderStatus: string = orderRes.status ?? 'FILLED';

      // DB 저장 — filledAt/filledQty 포함
      const dbOrder = await this.prisma.order.create({
        data: {
          userId,
          strategyId:    strategy.id ?? null,
          binanceOrderId:String(orderRes.orderId ?? ''),
          symbol,
          side:          side as any,
          positionSide:  'BOTH' as any,
          orderType:     'MARKET' as any,
          status:        orderStatus as any,
          quantity:      parseFloat(qty),
          avgFillPrice:  fillPrice,
          filledQty:     ['FILLED', 'PARTIALLY_FILLED'].includes(orderStatus) ? filledQty : 0,
          filledAt:      ['FILLED', 'PARTIALLY_FILLED'].includes(orderStatus) ? new Date() : null,
          leverage:      strategy.leverage,
          marginType:    strategy.marginType as any,
          entryReason:   direction,
        },
      });

      this.logger.log(`[${symbol}] ${direction} 진입 — qty: ${qty}, price: ${fillPrice}`);

      // TP / SL 주문
      if (strategy.takeProfitPct > 0) {
        const dir = direction === 'LONG' ? 1 : -1;
        const tp  = formatPrice(fillPrice * (1 + dir * strategy.takeProfitPct / 100), filters.tickSize);
        try {
          await this.binance.placeOrder({
            symbol, side: side === 'BUY' ? 'SELL' : 'BUY',
            positionSide: 'BOTH', type: 'TAKE_PROFIT_MARKET',
            stopPrice: tp, closePosition: 'true',
          });
          this.logger.log(`[${symbol}] TP: ${tp}`);
        } catch (e: any) {
          this.logger.error(`[${symbol}] TP 실패: ${e.message}`);
        }
      }

      if (strategy.stopLossPct > 0) {
        const dir = direction === 'LONG' ? 1 : -1;
        const sl  = formatPrice(fillPrice * (1 - dir * strategy.stopLossPct / 100), filters.tickSize);
        try {
          await this.binance.placeOrder({
            symbol, side: side === 'BUY' ? 'SELL' : 'BUY',
            positionSide: 'BOTH', type: 'STOP_MARKET',
            stopPrice: sl, closePosition: 'true',
          });
          this.logger.log(`[${symbol}] SL: ${sl}`);
        } catch (e: any) {
          this.logger.error(`[${symbol}] SL 실패 — 엔진 중지`, e.message);
          try {
            await this.prisma.riskBlockLog.create({
              data: { userId, strategyId: strategy.id ?? null, symbol, reason: 'SL_ORDER_FAILED', detail: e.message },
            });
          } catch {}
          await this.haltEngine(userId, 'SL_ORDER_FAILED');
        }
      }
    } catch (e: any) {
      this.logger.error(`[${symbol}] enterPosition 오류: ${e.message}`);
    }
  }
}
