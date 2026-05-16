// ── 수량/가격 포맷 ────────────────────────────────────────────────────
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
import { IndicatorService } from './indicator.service';
import { StrategyRuleEvaluator, StrategyRule, EvalMode, validateRule } from './strategy-rule-evaluator';

// ── params 타입 ───────────────────────────────────────────────────────
interface StrategyParams {
  evalMode?:        EvalMode;
  minScore?:        number;
  longEntryRules?:  StrategyRule[];
  shortEntryRules?: StrategyRule[];
  exitRules?:       StrategyRule[];
  blockRules?:      StrategyRule[];
}

@Injectable()
export class StrategyEngineService {
  private readonly logger = new Logger(StrategyEngineService.name);
  private timers = new Map<string, NodeJS.Timeout>();

  constructor(
    private prisma:     PrismaService,
    private binance:    BinanceService,
    private indicator:  IndicatorService,
    private evaluator:  StrategyRuleEvaluator,
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

      // ★ 매 스캔마다 DB에서 fresh 로드 (캐시 없음)
      const strategies = await this.prisma.strategy.findMany({
        where: { userId, enabled: true },
      });
      for (const strategy of strategies) {
        await this.processStrategy(userId, strategy);
      }
    } catch (e) {
      this.logger.error('스캔 오류', e);
    }
  }

  // ── 리스크 가드 ──────────────────────────────────────────────────────
  private async riskGuard(
    userId:   string,
    strategy: any,
  ): Promise<{ ok: boolean; reason?: string }> {
    const state = await this.prisma.engineState.findFirst({ where: { userId } });
    if (!state || state.status !== 'RUNNING')
      return { ok: false, reason: 'ENGINE_NOT_RUNNING' };
    if ((strategy.leverage ?? 1) > 20)
      return { ok: false, reason: 'LEVERAGE_EXCEEDED' };

    let positions: any[];
    try { positions = await this.binance.getPositionsStrict(); }
    catch { return { ok: false, reason: 'POSITION_FETCH_FAILED' }; }

    if (positions.some((p: any) => p.symbol === strategy.symbol && parseFloat(p.positionAmt) !== 0))
      return { ok: false, reason: 'POSITION_EXISTS' };

    const openCount = positions.filter((p: any) => parseFloat(p.positionAmt) !== 0).length;
    if (openCount >= (strategy.maxPositions ?? 1))
      return { ok: false, reason: 'MAX_POSITIONS_EXCEEDED' };

    const dailyPnl    = (state as any).dailyPnl       ?? 0;
    const dailyTrades = (state as any).dailyTrades     ?? 0;
    const consecLoss  = (state as any).consecLossCount ?? 0;

    if (strategy.maxDailyLoss   > 0 && dailyPnl    < -strategy.maxDailyLoss)   return { ok: false, reason: 'DAILY_LOSS_EXCEEDED' };
    if (strategy.maxDailyTrades > 0 && dailyTrades >= strategy.maxDailyTrades)  return { ok: false, reason: 'DAILY_TRADES_EXCEEDED' };
    if (strategy.stopOnConsecLoss > 0 && consecLoss >= strategy.stopOnConsecLoss) return { ok: false, reason: 'CONSEC_LOSS_EXCEEDED' };

    try {
      const balances  = await this.binance.getBalance();
      const usdt      = Array.isArray(balances) ? balances.find((b: any) => b.asset === 'USDT') : balances;
      const available = parseFloat(usdt?.availableBalance ?? usdt?.balance ?? '0');
      if (available < (strategy.positionSizeUsdt ?? 100))
        return { ok: false, reason: 'INSUFFICIENT_BALANCE' };
    } catch {
      return { ok: false, reason: 'BALANCE_CHECK_FAILED' };
    }

    return { ok: true };
  }

  // ── 전략 처리 ─────────────────────────────────────────────────────────
  private async processStrategy(userId: string, strategy: any) {
    try {
      const params = (strategy.params ?? {}) as StrategyParams;

      // ★ 1. params 구조 검증
      const validationError = this.validateStrategyParams(strategy.symbol, params);
      if (validationError) {
        this.logger.warn(`[${strategy.symbol}] 전략 설정 오류 — 진입 차단: ${validationError}`);
        return;
      }

      const tf = strategy.timeframe.replace(/^([a-zA-Z]+)(\d+)$/, '$2$1');
      const klines = await this.binance.getKlines(strategy.symbol, tf, 200);
      if (!klines || klines.length < 30) {
        this.logger.warn(`[${strategy.symbol}] klines 부족 (${klines?.length ?? 0})`);
        return;
      }

      const evalMode = params.evalMode  ?? 'ALL';
      const minScore = params.minScore  ?? 60;

      // ★ 2. blockRules 확인 — 하나라도 해당되면 진입 차단
      if ((params.blockRules ?? []).length > 0) {
        const blockResult = this.evaluator.evaluate(params.blockRules!, klines, 'ANY');
        if (blockResult.signal) {
          this.logger.log(`[${strategy.symbol}] blockRule 발동 — 진입 차단 (score:${blockResult.score})`);
          return;
        }
      }

      // ★ 3. 롱 진입 평가
      const longRules = params.longEntryRules ?? [];
      if (longRules.length > 0 && strategy.allowLong) {
        const result = this.evaluator.evaluate(longRules, klines, evalMode, minScore);
        this.logger.log(
          `[${strategy.symbol}] LONG 평가 signal:${result.signal} score:${result.score} ` +
          `(${result.details.map(d => `${d.type}:${d.passed ? '✓' : '✗'}`).join(' ')})`,
        );
        if (result.signal) {
          await this.placeOrder(userId, strategy, 'BUY', 'LONG_ENTRY');
          return; // 진입 후 숏 평가 생략
        }
      }

      // ★ 4. 숏 진입 평가
      const shortRules = params.shortEntryRules ?? [];
      if (shortRules.length > 0 && strategy.allowShort) {
        const result = this.evaluator.evaluate(shortRules, klines, evalMode, minScore);
        this.logger.log(
          `[${strategy.symbol}] SHORT 평가 signal:${result.signal} score:${result.score} ` +
          `(${result.details.map(d => `${d.type}:${d.passed ? '✓' : '✗'}`).join(' ')})`,
        );
        if (result.signal) {
          await this.placeOrder(userId, strategy, 'SELL', 'SHORT_ENTRY');
        }
      }

    } catch (e) {
      this.logger.error(`[${strategy.symbol}] 전략 처리 오류`, e);
    }
  }

  // ── params 검증 ───────────────────────────────────────────────────────
  private validateStrategyParams(symbol: string, params: StrategyParams): string | null {
    const allRules = [
      ...(params.longEntryRules  ?? []),
      ...(params.shortEntryRules ?? []),
      ...(params.exitRules       ?? []),
      ...(params.blockRules      ?? []),
    ];
    for (const rule of allRules) {
      const err = validateRule(rule);
      if (err) return err;
    }
    if (params.evalMode === 'SCORE' && (params.minScore === undefined || params.minScore < 0 || params.minScore > 100))
      return 'SCORE 모드에서 minScore는 0~100이어야 합니다';
    return null;
  }

  // ── 주문 실행 ─────────────────────────────────────────────────────────
  private async placeOrder(
    userId:      string,
    strategy:    any,
    side:        'BUY' | 'SELL',
    entryReason: string,
  ) {
    try {
      const guard = await this.riskGuard(userId, strategy);
      if (!guard.ok) {
        this.logger.log(`[${strategy.symbol}] 주문 차단: ${guard.reason}`);
        try {
          await this.prisma.riskBlockLog.create({
            data: { userId, strategyId: strategy.id ?? null, symbol: strategy.symbol, reason: guard.reason ?? 'UNKNOWN', detail: { entryReason } },
          });
        } catch {}
        return;
      }

      let filters: { stepSize: number; minQty: number; minNotional: number; tickSize: number };
      try {
        filters = await this.binance.getSymbolFilters(strategy.symbol);
      } catch (e: any) {
        this.logger.error(`[${strategy.symbol}] 심볼 필터 조회 실패 — 주문 차단: ${e.message}`);
        return;
      }

      const price    = await this.binance.getTickerPrice(strategy.symbol);
      const notional = (strategy.positionSizeUsdt ?? 100) * (strategy.leverage ?? 1);
      const qtyStr   = formatQty(notional / price, filters.stepSize);
      const qtyNum   = parseFloat(qtyStr);

      if (qtyNum <= 0 || qtyNum < filters.minQty) {
        this.logger.error(`[${strategy.symbol}] 수량 검증 실패: qty=${qtyNum} minQty=${filters.minQty}`);
        return;
      }
      if (filters.minNotional > 0 && qtyNum * price < filters.minNotional) {
        this.logger.error(`[${strategy.symbol}] MIN_NOTIONAL 미달: ${(qtyNum * price).toFixed(2)} < ${filters.minNotional}`);
        return;
      }

      this.logger.log(`[${strategy.symbol}] ${side} 주문 시도 qty:${qtyStr} price:${price} reason:${entryReason}`);

      await this.binance.setLeverage(strategy.symbol, strategy.leverage ?? 1);

      let orderResult = await this.binance.placeOrder({
        symbol:           strategy.symbol,
        side,
        positionSide:     'BOTH',
        type:             'MARKET',
        quantity:         qtyStr,
        newOrderRespType: 'RESULT',
      });

      const orderId = orderResult?.orderId;
      if (!orderId) { this.logger.error(`[${strategy.symbol}] orderId 없음`); return; }

      // avgPrice 없으면 재조회
      if (!orderResult?.avgPrice || parseFloat(orderResult.avgPrice) === 0) {
        try { orderResult = await this.binance.getOrderDetail(strategy.symbol, orderId); }
        catch (e: any) { this.logger.warn(`재조회 실패: ${e.message}`); }
      }

      const orderStatus  = orderResult?.status as string;
      const executedQty  = parseFloat(orderResult?.executedQty ?? '0');
      const avgFillPrice = parseFloat(orderResult?.avgPrice    ?? '0');
      const isFilled     = orderStatus === 'FILLED' || orderStatus === 'PARTIALLY_FILLED';

      this.logger.log(`[${strategy.symbol}] ${side} 완료 orderId:${orderId} status:${orderStatus} avgPrice:${avgFillPrice}`);

      // DB 저장
      try {
        await this.prisma.order.create({
          data: {
            userId, strategyId: strategy.id,
            binanceOrderId: String(orderId),
            symbol:        strategy.symbol,
            side:          side as any,
            positionSide:  'BOTH' as any,
            orderType:     'MARKET' as any,
            status:        (isFilled ? orderStatus : (orderStatus ?? 'ERROR')) as any,
            quantity:      executedQty > 0 ? executedQty : qtyNum,
            avgFillPrice:  avgFillPrice > 0 ? avgFillPrice : price,
            leverage:      strategy.leverage ?? 1,
            marginType:    (strategy.marginType ?? 'ISOLATED') as any,
            entryReason,
          },
        });
      } catch (dbErr: any) { this.logger.error('DB 저장 실패', dbErr.message); }

      if (!isFilled) { this.logger.warn(`[${strategy.symbol}] 미체결(${orderStatus}) — TP/SL 생략`); return; }

      try {
        await this.prisma.engineState.updateMany({ where: { userId }, data: { dailyTrades: { increment: 1 } } });
      } catch {}

      await this.placeTpSl(userId, strategy, side, qtyStr, avgFillPrice, filters.tickSize);

    } catch (e) {
      this.logger.error(`[${strategy.symbol}] 주문 실패`, e);
    }
  }

  // ── TP/SL ─────────────────────────────────────────────────────────────
  private async placeTpSl(userId: string, strategy: any, side: string, qtyStr: string, avgFillPrice: number, tickSize: number) {
    let fillPrice = avgFillPrice > 0 ? avgFillPrice : 0;

    if (fillPrice <= 0) {
      try {
        const positions = await this.binance.getPositionsStrict();
        const pos = positions.find((p: any) => p.symbol === strategy.symbol && parseFloat(p.positionAmt) !== 0);
        if (pos) { fillPrice = parseFloat(pos.entryPrice); this.logger.warn(`[${strategy.symbol}] entryPrice 사용: ${fillPrice}`); }
      } catch {
        await this.haltEngine(userId, 'ENTRY_PRICE_CHECK_FAILED'); return;
      }
    }
    if (fillPrice <= 0) { await this.haltEngine(userId, 'ENTRY_PRICE_CHECK_FAILED'); return; }

    const dir = side === 'BUY' ? 1 : -1;

    if ((strategy.takeProfitPct ?? 0) > 0) {
      try {
        const tp = formatPrice(fillPrice * (1 + dir * strategy.takeProfitPct / 100), tickSize);
        await this.binance.placeOrder({ symbol: strategy.symbol, side: side === 'BUY' ? 'SELL' : 'BUY', positionSide: 'BOTH', type: 'TAKE_PROFIT_MARKET', stopPrice: tp, closePosition: 'true' });
        this.logger.log(`[${strategy.symbol}] TP: ${tp}`);
      } catch (e: any) {
        this.logger.error(`[${strategy.symbol}] TP 실패`, e.message);
        try { await this.prisma.riskBlockLog.create({ data: { userId, strategyId: strategy.id ?? null, symbol: strategy.symbol, reason: 'TP_ORDER_FAILED', detail: e.message } }); } catch {}
      }
    }

    if ((strategy.stopLossPct ?? 0) > 0) {
      try {
        const sl = formatPrice(fillPrice * (1 - dir * strategy.stopLossPct / 100), tickSize);
        await this.binance.placeOrder({ symbol: strategy.symbol, side: side === 'BUY' ? 'SELL' : 'BUY', positionSide: 'BOTH', type: 'STOP_MARKET', stopPrice: sl, closePosition: 'true' });
        this.logger.log(`[${strategy.symbol}] SL: ${sl}`);
      } catch (e: any) {
        this.logger.error(`[${strategy.symbol}] SL 실패 — 엔진 중지`, e.message);
        try { await this.prisma.riskBlockLog.create({ data: { userId, strategyId: strategy.id ?? null, symbol: strategy.symbol, reason: 'SL_ORDER_FAILED', detail: e.message } }); } catch {}
        await this.haltEngine(userId, 'SL_ORDER_FAILED');
      }
    }
  }
}
