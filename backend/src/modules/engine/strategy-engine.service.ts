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

  private async logRiskBlock(userId: string, strategyId: string | null, symbol: string, reason: string, detail?: any) {
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
    } catch (e) {
      this.logger.error('스캔 오류', e);
    }
  }

  // ── 강화된 riskGuard ─────────────────────────────────────────────
  private async riskGuard(userId: string, strategy: any): Promise<{ ok: boolean; reason?: string }> {
    const state = await this.prisma.engineState.findFirst({ where: { userId } });
    if (!state || state.status !== 'RUNNING') return { ok: false, reason: 'ENGINE_NOT_RUNNING' };

    // 레버리지 상한
    if ((strategy.leverage ?? 1) > 20) {
      await this.logRiskBlock(userId, strategy.id, strategy.symbol, 'LEVERAGE_EXCEEDED');
      return { ok: false, reason: 'LEVERAGE_EXCEEDED' };
    }

    // 일일 손실 한도
    if ((state.dailyPnl ?? 0) <= -(strategy.maxDailyLoss ?? 50)) {
      await this.logRiskBlock(userId, strategy.id, strategy.symbol, 'DAILY_LOSS_EXCEEDED',
        { dailyPnl: state.dailyPnl, maxDailyLoss: strategy.maxDailyLoss });
      return { ok: false, reason: 'DAILY_LOSS_EXCEEDED' };
    }

    // 연속 손실 한도
    if ((state.consecLossCount ?? 0) >= (strategy.stopOnConsecLoss ?? 3)) {
      await this.logRiskBlock(userId, strategy.id, strategy.symbol, 'CONSEC_LOSS_EXCEEDED',
        { consecLossCount: state.consecLossCount });
      return { ok: false, reason: 'CONSEC_LOSS_EXCEEDED' };
    }

    // 일일 거래 횟수 (DB)
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayOrders = await this.prisma.order.count({
      where: { userId, strategyId: strategy.id, createdAt: { gte: today } },
    });
    if (todayOrders >= (strategy.maxDailyTrades ?? 10)) {
      await this.logRiskBlock(userId, strategy.id, strategy.symbol, 'DAILY_TRADES_EXCEEDED');
      return { ok: false, reason: 'DAILY_TRADES_EXCEEDED' };
    }

    // Binance 실제 포지션 확인
    let binancePositions: any[];
    try {
      binancePositions = await this.binance.getPositionsStrict();
    } catch (e: any) {
      await this.logRiskBlock(userId, strategy.id, strategy.symbol, 'POSITION_FETCH_FAILED', e.message);
      return { ok: false, reason: 'POSITION_FETCH_FAILED' };
    }

    // 동일 심볼 오픈 포지션
    const samePosOpen = binancePositions.find(
      p => p.symbol === strategy.symbol && parseFloat(p.positionAmt) !== 0
    );
    if (samePosOpen) {
      await this.logRiskBlock(userId, strategy.id, strategy.symbol, 'POSITION_ALREADY_OPEN');
      return { ok: false, reason: 'POSITION_ALREADY_OPEN' };
    }

    // 전체 오픈 포지션 수
    const totalOpen = binancePositions.filter(p => parseFloat(p.positionAmt) !== 0).length;
    if (totalOpen >= (strategy.maxPositions ?? 1)) {
      await this.logRiskBlock(userId, strategy.id, strategy.symbol, 'MAX_POSITIONS_REACHED',
        { totalOpen, maxPositions: strategy.maxPositions });
      return { ok: false, reason: 'MAX_POSITIONS_REACHED' };
    }

    // 잔고 확인
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

    // minNotional 확인
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

      // exitRules 미사용 경고
      if ((params.exitRules ?? []).length > 0) {
        this.logger.warn(`[${strategy.symbol}] exitRules 설정됨 — 현재 엔진에서 미평가`);
      }

      const tfMap: Record<string, string> = { m1:'1m', m5:'5m', m15:'15m', h1:'1h', h4:'4h' };
      const interval = tfMap[strategy.timeframe] ?? '15m';
      let klines: Kline[] = await this.binance.getKlines(strategy.symbol, interval, 250);

      // useClosedCandleOnly (기본 true)
      if (params.useClosedCandleOnly !== false) {
        const now = Date.now();
        klines = klines.filter(k => k.closeTime < now);
      }
      if (klines.length < 50) {
        this.logger.warn(`[${strategy.symbol}] 캔들 수 부족 (${klines.length}), 스킵`);
        return;
      }

      const evalMode = params.evalMode ?? 'ALL';
      const minScore = params.minScore ?? 60;

      // blockRules
      const blockRules = params.blockRules ?? [];
      if (blockRules.length > 0) {
        const blockResult = this.evaluator.evaluate(blockRules, klines, 'ANY');
        if (blockResult.signal) {
          this.logger.log(`[${strategy.symbol}] 차단 조건 발동 — 스킵`);
          return;
        }
      }

      // 롱/숏 신호 평가
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

      // 롱/숏 동시 신호 차단
      if (longSignal && shortSignal) {
        await this.logRiskBlock(userId, strategy.id, strategy.symbol, 'CONFLICTING_SIGNALS',
          { longSignal, shortSignal });
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

      // ── MARKET 주문 (newOrderRespType: RESULT) ───────────────────
      const orderRes = await this.binance.placeOrder({
        symbol, side, positionSide: 'BOTH', type: 'MARKET',
        quantity: qty, newOrderRespType: 'RESULT',
      });

      // ── 체결 확인: 최대 3회 재조회 ──────────────────────────────
      const orderId = orderRes.orderId;
      let confirmed = orderRes;

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
      let fillPrice  = parseFloat(confirmed.avgPrice ?? confirmed.price ?? String(price));
      let filledQty  = parseFloat(confirmed.executedQty ?? qty);
      let orderStatus: string = confirmed.status ?? 'UNKNOWN';

      if (!['FILLED', 'PARTIALLY_FILLED'].includes(orderStatus)) {
        try {
          const positions = await this.binance.getPositionsStrict();
          const openPos   = positions.find((p: any) => p.symbol === symbol && parseFloat(p.positionAmt) !== 0);
          if (openPos) {
            fillPrice   = parseFloat(openPos.entryPrice);
            filledQty   = Math.abs(parseFloat(openPos.positionAmt));
            orderStatus = 'FILLED';
            this.logger.warn(`[${symbol}] 주문 상태 불명확 → 포지션 기준으로 FILLED 처리`);
          } else {
            this.logger.error(`[${symbol}] 주문 체결 불명확, 포지션 없음 — 스킵`);
            return;
          }
        } catch (e: any) {
          this.logger.error(`[${symbol}] 포지션 확인 실패: ${e.message}`);
          return;
        }
      }

      // ── DB 저장 ──────────────────────────────────────────────────
      await this.prisma.order.create({
        data: {
          userId,
          strategyId:     strategy.id ?? null,
          binanceOrderId: String(orderId ?? ''),
          symbol, side: side as any, positionSide: 'BOTH' as any,
          orderType:    'MARKET' as any,
          status:       orderStatus as any,
          quantity:     parseFloat(qty),
          avgFillPrice: fillPrice,
          filledQty:    ['FILLED', 'PARTIALLY_FILLED'].includes(orderStatus) ? filledQty : 0,
          filledAt:     ['FILLED', 'PARTIALLY_FILLED'].includes(orderStatus) ? new Date() : null,
          leverage:     strategy.leverage,
          marginType:   strategy.marginType as any,
          entryReason:  direction,
        },
      });

      this.logger.log(`[${symbol}] ${direction} 진입 — qty: ${qty}, price: ${fillPrice}`);

      // ── dailyTrades 증가 ─────────────────────────────────────────
      if (['FILLED', 'PARTIALLY_FILLED'].includes(orderStatus)) {
        await this.prisma.engineState.updateMany({
          where: { userId },
          data:  { dailyTrades: { increment: 1 } },
        }).catch(() => {});
      }

      // ── TP / SL 주문 + 보호 로직 ────────────────────────────────
      let tpOk = strategy.takeProfitPct <= 0;  // TP 불필요 시 ok
      let slOk = strategy.stopLossPct  <= 0;   // SL 불필요 시 ok

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
          tpOk = true;
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
          slOk = true;
        } catch (e: any) {
          this.logger.error(`[${symbol}] SL 실패: ${e.message}`);
        }
      }

      // SL 생성 실패 시 → ENTRY_ORDER_UNPROTECTED → 엔진 중지
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
