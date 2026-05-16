function formatQty(qty: number, step: number): string {
  const precision = step < 1 ? (String(step).split('.')[1]?.length ?? 0) : 0;
  return (Math.floor(qty / step) * step).toFixed(precision);
}
function formatPrice(price: number, tickSize: number): string {
  const precision = tickSize < 1 ? (String(tickSize).split('.')[1]?.length ?? 0) : 0;
  return (Math.floor(price / tickSize) * tickSize).toFixed(precision);
}
function sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)); }

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BinanceService } from '../binance/binance.service';
import { IndicatorService, Kline } from './indicator.service';
import { StrategyRuleEvaluator, StrategyRule, EvalMode, validateRule } from './strategy-rule-evaluator';

interface StrategyParams {
  evalMode?:            EvalMode;
  minScore?:            number;
  longEntryRules?:      StrategyRule[];
  shortEntryRules?:     StrategyRule[];
  exitRules?:           StrategyRule[];
  blockRules?:          StrategyRule[];
  useClosedCandleOnly?: boolean;
}

@Injectable()
export class StrategyEngineService {
  private readonly logger = new Logger(StrategyEngineService.name);
  private timers = new Map<string, NodeJS.Timeout>();
  // PnL 동기화: 마지막 처리 시각 (userId → timestamp ms)
  private lastPnlSyncAt = new Map<string, number>();

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

  private async logRiskBlock(
    userId: string, strategyId: string | null, symbol: string, reason: string, detail?: any,
  ) {
    try {
      await this.prisma.riskBlockLog.create({ data: { userId, strategyId, symbol, reason, detail } });
    } catch {}
    this.logger.warn(`[${symbol}] 리스크 차단: ${reason}`);
  }

  private async scanStrategies(userId: string) {
    try {
      const state = await this.prisma.engineState.findFirst({ where: { userId } });
      if (!state || state.status !== 'RUNNING') return;
      const strategies = await this.prisma.strategy.findMany({ where: { userId, enabled: true } });
      for (const strategy of strategies) {
        await this.processStrategy(userId, strategy);
      }
      // 스캔 후 PnL 동기화
      await this.syncPnlStats(userId);
    } catch (e) {
      this.logger.error('스캔 오류', e);
    }
  }

  // ── 항목 4: PnL 동기화 ────────────────────────────────────────────
  private async syncPnlStats(userId: string) {
    try {
      const lastSync = this.lastPnlSyncAt.get(userId) ?? (Date.now() - 3600_000);
      const now      = Date.now();

      // Binance income API — REALIZED_PNL (마지막 동기화 이후)
      const incomes: any[] = await this.binance.getIncome('', 'REALIZED_PNL', lastSync + 1, 1000);
      if (incomes.length === 0) { this.lastPnlSyncAt.set(userId, now); return; }

      // dailyPnl: 오늘치 합산
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayPnl   = incomes
        .filter(i => i.time >= todayStart.getTime())
        .reduce((s: number, i: any) => s + parseFloat(i.income), 0);

      // consecLossCount: 최근 거래 순서대로 연속 손실 계산
      const state = await this.prisma.engineState.findFirst({ where: { userId } });
      let consecLoss = state?.consecLossCount ?? 0;
      for (const income of incomes) {
        const pnl = parseFloat(income.income);
        if (pnl < 0)      consecLoss++;
        else if (pnl > 0) consecLoss = 0;
      }

      await this.prisma.engineState.updateMany({
        where: { userId },
        data:  { dailyPnl: { increment: todayPnl }, consecLossCount: consecLoss },
      });

      // 전략별 통계 업데이트 (symbol 매칭)
      const strategies = await this.prisma.strategy.findMany({ where: { userId } });
      for (const strat of strategies) {
        const stratIncomes = incomes.filter((i: any) => i.symbol === strat.symbol);
        if (stratIncomes.length === 0) continue;
        const pnlSum   = stratIncomes.reduce((s: number, i: any) => s + parseFloat(i.income), 0);
        const winCount = stratIncomes.filter((i: any) => parseFloat(i.income) > 0).length;
        await this.prisma.strategy.update({
          where: { id: strat.id },
          data:  {
            totalPnl:    { increment: pnlSum },
            totalTrades: { increment: stratIncomes.length },
            winTrades:   { increment: winCount },
            lastSignalAt: new Date(),
          },
        });
      }

      this.lastPnlSyncAt.set(userId, now);
      this.logger.log(`[${userId}] PnL 동기화 완료: ${incomes.length}건, 오늘 PnL: ${todayPnl.toFixed(4)}`);
    } catch (e: any) {
      this.logger.warn(`[syncPnlStats] 오류 (무시): ${e.message}`);
    }
  }

  // ── 강화된 riskGuard ─────────────────────────────────────────────
  private async riskGuard(userId: string, strategy: any): Promise<{ ok: boolean; reason?: string }> {
    const state = await this.prisma.engineState.findFirst({ where: { userId } });
    if (!state || state.status !== 'RUNNING') return { ok: false, reason: 'ENGINE_NOT_RUNNING' };

    if ((strategy.leverage ?? 1) > 20) {
      await this.logRiskBlock(userId, strategy.id, strategy.symbol, 'LEVERAGE_EXCEEDED');
      return { ok: false, reason: 'LEVERAGE_EXCEEDED' };
    }
    if ((state.dailyPnl ?? 0) <= -(strategy.maxDailyLoss ?? 50)) {
      await this.logRiskBlock(userId, strategy.id, strategy.symbol, 'DAILY_LOSS_EXCEEDED',
        { dailyPnl: state.dailyPnl, maxDailyLoss: strategy.maxDailyLoss });
      return { ok: false, reason: 'DAILY_LOSS_EXCEEDED' };
    }
    if ((state.consecLossCount ?? 0) >= (strategy.stopOnConsecLoss ?? 3)) {
      await this.logRiskBlock(userId, strategy.id, strategy.symbol, 'CONSEC_LOSS_EXCEEDED',
        { consecLossCount: state.consecLossCount });
      return { ok: false, reason: 'CONSEC_LOSS_EXCEEDED' };
    }

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayOrders = await this.prisma.order.count({
      where: { userId, strategyId: strategy.id, createdAt: { gte: today } },
    });
    if (todayOrders >= (strategy.maxDailyTrades ?? 10)) {
      await this.logRiskBlock(userId, strategy.id, strategy.symbol, 'DAILY_TRADES_EXCEEDED');
      return { ok: false, reason: 'DAILY_TRADES_EXCEEDED' };
    }

    let binancePositions: any[];
    try {
      binancePositions = await this.binance.getPositionsStrict();
    } catch (e: any) {
      await this.logRiskBlock(userId, strategy.id, strategy.symbol, 'POSITION_FETCH_FAILED', e.message);
      return { ok: false, reason: 'POSITION_FETCH_FAILED' };
    }
    const samePosOpen = binancePositions.find(
      p => p.symbol === strategy.symbol && parseFloat(p.positionAmt) !== 0,
    );
    if (samePosOpen) {
      await this.logRiskBlock(userId, strategy.id, strategy.symbol, 'POSITION_ALREADY_OPEN');
      return { ok: false, reason: 'POSITION_ALREADY_OPEN' };
    }
    const totalOpen = binancePositions.filter(p => parseFloat(p.positionAmt) !== 0).length;
    if (totalOpen >= (strategy.maxPositions ?? 1)) {
      await this.logRiskBlock(userId, strategy.id, strategy.symbol, 'MAX_POSITIONS_REACHED',
        { totalOpen, maxPositions: strategy.maxPositions });
      return { ok: false, reason: 'MAX_POSITIONS_REACHED' };
    }

    let balanceList: any[];
    try {
      balanceList = await this.binance.getBalance();
    } catch (e: any) {
      await this.logRiskBlock(userId, strategy.id, strategy.symbol, 'BALANCE_FETCH_FAILED', e.message);
      return { ok: false, reason: 'BALANCE_FETCH_FAILED' };
    }
    const usdtBal   = balanceList.find((b: any) => b.asset === 'USDT');
    const available = parseFloat(usdtBal?.availableBalance ?? '0');
    if (available < strategy.positionSizeUsdt) {
      await this.logRiskBlock(userId, strategy.id, strategy.symbol, 'INSUFFICIENT_BALANCE',
        { available, required: strategy.positionSizeUsdt });
      return { ok: false, reason: 'INSUFFICIENT_BALANCE' };
    }

    let filters: { stepSize: number; minQty: number; minNotional: number; tickSize: number };
    try {
      filters = await this.binance.getSymbolFilters(strategy.symbol);
    } catch (e: any) {
      await this.logRiskBlock(userId, strategy.id, strategy.symbol, 'SYMBOL_FILTER_FAILED', e.message);
      return { ok: false, reason: 'SYMBOL_FILTER_FAILED' };
    }
    const notional = strategy.positionSizeUsdt * strategy.leverage;
    if (notional < filters.minNotional) {
      await this.logRiskBlock(userId, strategy.id, strategy.symbol, 'MIN_NOTIONAL_NOT_MET',
        { notional, minNotional: filters.minNotional });
      return { ok: false, reason: 'MIN_NOTIONAL_NOT_MET' };
    }

    return { ok: true };
  }

  private async processStrategy(userId: string, strategy: any) {
    try {
      const params = (strategy.params ?? {}) as StrategyParams;
      if ((params.exitRules ?? []).length > 0)
        this.logger.warn(`[${strategy.symbol}] exitRules 설정됨 — 현재 엔진에서 미평가`);

      const tfMap: Record<string, string> = { m1:'1m', m5:'5m', m15:'15m', h1:'1h', h4:'4h' };
      let klines: Kline[] = await this.binance.getKlines(strategy.symbol, tfMap[strategy.timeframe] ?? '15m', 250);

      if (params.useClosedCandleOnly !== false) {
        const now = Date.now();
        klines = klines.filter(k => k.closeTime < now);
      }
      if (klines.length < 50) {
        this.logger.warn(`[${strategy.symbol}] 캔들 수 부족 (${klines.length}), 스킵`);
        return;
      }

      const evalMode   = params.evalMode ?? 'ALL';
      const minScore   = params.minScore ?? 60;
      const blockRules = params.blockRules ?? [];
      if (blockRules.length > 0 && this.evaluator.evaluate(blockRules, klines, 'ANY').signal) {
        this.logger.log(`[${strategy.symbol}] 차단 조건 발동 — 스킵`);
        return;
      }

      let longSignal  = false;
      let shortSignal = false;

      if (strategy.allowLong) {
        const longRules = params.longEntryRules ?? [];
        for (const r of longRules) {
          const err = validateRule(r);
          if (err) { this.logger.warn(`[${strategy.symbol}] 롱 rule 오류: ${err}`); return; }
        }
        longSignal = this.evaluator.evaluate(longRules, klines, evalMode, minScore).signal;
      }
      if (strategy.allowShort) {
        const shortRules = params.shortEntryRules ?? [];
        for (const r of shortRules) {
          const err = validateRule(r);
          if (err) { this.logger.warn(`[${strategy.symbol}] 숏 rule 오류: ${err}`); return; }
        }
        shortSignal = this.evaluator.evaluate(shortRules, klines, evalMode, minScore).signal;
      }

      if (longSignal && shortSignal) {
        await this.logRiskBlock(userId, strategy.id, strategy.symbol, 'CONFLICTING_SIGNALS');
        return;
      }

      const directions: Array<'LONG' | 'SHORT'> = [];
      if (longSignal)  directions.push('LONG');
      if (shortSignal) directions.push('SHORT');

      for (const direction of directions) {
        const guard = await this.riskGuard(userId, strategy);
        if (!guard.ok) continue;
        await this.enterPosition(userId, strategy, direction, klines);
      }
    } catch (e: any) {
      this.logger.error(`[${strategy.symbol}] processStrategy 오류: ${e.message}`);
    }
  }

  private async enterPosition(userId: string, strategy: any, direction: 'LONG' | 'SHORT', _klines: Kline[]) {
    const symbol = strategy.symbol;
    try {
      const filters = await this.binance.getSymbolFilters(symbol);
      const price   = await this.binance.getTickerPrice(symbol);

      await this.binance.setLeverage(symbol, strategy.leverage);
      await this.binance.setMarginType(symbol, strategy.marginType);

      const rawQty = (strategy.positionSizeUsdt * strategy.leverage) / price;
      const qty    = formatQty(rawQty, filters.stepSize);

      if (parseFloat(qty) < filters.minQty) {
        this.logger.warn(`[${symbol}] 최소 수량 미달: ${qty} < ${filters.minQty}`);
        return;
      }

      // ── 항목 7: snappedQty 기준 minNotional 재검사 ──────────────
      const actualNotional = parseFloat(qty) * price;
      if (actualNotional < filters.minNotional) {
        await this.logRiskBlock(userId, strategy.id ?? null, symbol, 'MIN_NOTIONAL_AFTER_ROUNDING',
          { qty, price, actualNotional, minNotional: filters.minNotional });
        return;
      }

      const side = direction === 'LONG' ? 'BUY' : 'SELL';

      // ── MARKET 주문 (newOrderRespType: RESULT) ───────────────────
      const orderRes = await this.binance.placeOrder({
        symbol, side, positionSide: 'BOTH', type: 'MARKET',
        quantity: qty, newOrderRespType: 'RESULT',
      });

      // ── 체결 확인: 최대 3회 재조회 ──────────────────────────────
      const orderId  = orderRes.orderId;
      let confirmed  = orderRes;
      if (orderId && !['FILLED', 'PARTIALLY_FILLED'].includes(confirmed.status)) {
        for (let i = 0; i < 3; i++) {
          await sleep(400);
          try {
            confirmed = await this.binance.getOrderDetail(symbol, orderId);
            if (['FILLED', 'PARTIALLY_FILLED'].includes(confirmed.status)) break;
          } catch (e: any) {
            this.logger.warn(`[${symbol}] getOrderDetail 실패 (${i + 1}/3): ${e.message}`);
          }
        }
      }

      // ── 여전히 불명확 → 실제 포지션으로 확인 ───────────────────
      let fillPrice   = parseFloat(confirmed.avgPrice ?? confirmed.price ?? String(price));
      let filledQty   = parseFloat(confirmed.executedQty ?? qty);
      let orderStatus = confirmed.status ?? 'UNKNOWN';

      if (!['FILLED', 'PARTIALLY_FILLED'].includes(orderStatus)) {
        try {
          const positions = await this.binance.getPositionsStrict();
          const openPos   = positions.find((p: any) => p.symbol === symbol && parseFloat(p.positionAmt) !== 0);
          if (openPos) {
            fillPrice   = parseFloat(openPos.entryPrice);
            filledQty   = Math.abs(parseFloat(openPos.positionAmt));
            orderStatus = 'FILLED';
            this.logger.warn(`[${symbol}] 주문 상태 불명확 → 포지션 기준 FILLED 처리`);
          } else {
            // ── 항목 2: 불명확 시 엔진 중지 ──────────────────────
            await this.logRiskBlock(userId, strategy.id ?? null, symbol, 'ENTRY_ORDER_STATUS_UNKNOWN',
              { orderId, confirmedStatus: orderStatus });
            await this.haltEngine(userId, 'ENTRY_ORDER_STATUS_UNKNOWN');
            return;
          }
        } catch (e: any) {
          // 포지션 조회도 실패 → 엔진 중지
          await this.logRiskBlock(userId, strategy.id ?? null, symbol, 'ENTRY_ORDER_STATUS_UNKNOWN',
            { orderId, error: e.message });
          await this.haltEngine(userId, 'ENTRY_ORDER_STATUS_UNKNOWN');
          return;
        }
      }

      // ── 진입 주문 DB 저장 ────────────────────────────────────────
      await this.prisma.order.create({
        data: {
          userId,
          strategyId:     strategy.id ?? null,
          binanceOrderId: String(orderId ?? ''),
          symbol,
          side:           side as any,
          positionSide:   'BOTH' as any,
          orderType:      'MARKET' as any,
          status:         orderStatus as any,
          quantity:       parseFloat(qty),
          avgFillPrice:   fillPrice,
          filledQty:      ['FILLED', 'PARTIALLY_FILLED'].includes(orderStatus) ? filledQty : 0,
          filledAt:       ['FILLED', 'PARTIALLY_FILLED'].includes(orderStatus) ? new Date() : null,
          leverage:       strategy.leverage,
          marginType:     strategy.marginType as any,
          entryReason:    direction,
        },
      });
      this.logger.log(`[${symbol}] ${direction} 진입 — qty: ${qty}, price: ${fillPrice}`);

      // dailyTrades 증가
      if (['FILLED', 'PARTIALLY_FILLED'].includes(orderStatus)) {
        await this.prisma.engineState.updateMany({
          where: { userId },
          data:  { dailyTrades: { increment: 1 } },
        }).catch(() => {});
      }

      // ── TP/SL 주문 + DB 저장 ────────────────────────────────────
      const closeSide = side === 'BUY' ? 'SELL' : 'BUY';
      const dir       = direction === 'LONG' ? 1 : -1;

      let tpOk = strategy.takeProfitPct <= 0;
      let slOk = strategy.stopLossPct  <= 0;

      // ── 항목 3: TP DB 저장 ───────────────────────────────────────
      if (strategy.takeProfitPct > 0) {
        const tp = formatPrice(fillPrice * (1 + dir * strategy.takeProfitPct / 100), filters.tickSize);
        try {
          const tpRes = await this.binance.placeOrder({
            symbol, side: closeSide, positionSide: 'BOTH',
            type: 'TAKE_PROFIT_MARKET', stopPrice: tp, closePosition: 'true',
          });
          await this.prisma.order.create({
            data: {
              userId, strategyId: strategy.id ?? null,
              binanceOrderId: String(tpRes.orderId ?? ''),
              symbol, side: closeSide as any, positionSide: 'BOTH' as any,
              orderType: 'TAKE_PROFIT_MARKET' as any,
              status:    (tpRes.status ?? 'NEW') as any,
              quantity:  parseFloat(qty),
              stopPrice: parseFloat(tp),
              leverage:  strategy.leverage,
              marginType: strategy.marginType as any,
              exitReason: 'TAKE_PROFIT',
            },
          }).catch(() => {});
          this.logger.log(`[${symbol}] TP: ${tp}`);
          tpOk = true;
        } catch (e: any) {
          // ── 항목 1: TP 실패 riskBlockLog 저장 ────────────────────
          await this.logRiskBlock(userId, strategy.id ?? null, symbol, 'TP_ORDER_FAILED',
            { tp, fillPrice, direction, error: e.message });
        }
      }

      // ── 항목 3: SL DB 저장 ───────────────────────────────────────
      if (strategy.stopLossPct > 0) {
        const sl = formatPrice(fillPrice * (1 - dir * strategy.stopLossPct / 100), filters.tickSize);
        try {
          const slRes = await this.binance.placeOrder({
            symbol, side: closeSide, positionSide: 'BOTH',
            type: 'STOP_MARKET', stopPrice: sl, closePosition: 'true',
          });
          await this.prisma.order.create({
            data: {
              userId, strategyId: strategy.id ?? null,
              binanceOrderId: String(slRes.orderId ?? ''),
              symbol, side: closeSide as any, positionSide: 'BOTH' as any,
              orderType: 'STOP_MARKET' as any,
              status:    (slRes.status ?? 'NEW') as any,
              quantity:  parseFloat(qty),
              stopPrice: parseFloat(sl),
              leverage:  strategy.leverage,
              marginType: strategy.marginType as any,
              exitReason: 'STOP_LOSS',
            },
          }).catch(() => {});
          this.logger.log(`[${symbol}] SL: ${sl}`);
          slOk = true;
        } catch (e: any) {
          this.logger.error(`[${symbol}] SL 실패: ${e.message}`);
        }
      }

      // SL 실패 → ENTRY_ORDER_UNPROTECTED → 엔진 중지
      if (!slOk) {
        await this.logRiskBlock(userId, strategy.id ?? null, symbol, 'ENTRY_ORDER_UNPROTECTED',
          { fillPrice, direction, tpOk });
        await this.haltEngine(userId, 'ENTRY_ORDER_UNPROTECTED');
      }

    } catch (e: any) {
      this.logger.error(`[${symbol}] enterPosition 오류: ${e.message}`);
    }
  }
}
