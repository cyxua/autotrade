function formatQty(qty: number, step: number): string {
  const precision = step < 1 ? (String(step).split('.')[1]?.length ?? 0) : 0;
  return (Math.floor(qty / step) * step).toFixed(precision);
}
function formatPrice(price: number, tickSize: number): string {
  const precision = tickSize < 1 ? (String(tickSize).split('.')[1]?.length ?? 0) : 0;
  return (Math.floor(price / tickSize) * tickSize).toFixed(precision);
}
function sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)); }

interface EnterPositionResult {
  entered:   boolean;
  protected: boolean;
  reason?:   string;
}
function toOrderId(id: any): string | null { return id != null ? String(id) : null; }

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

  // ── 항목 2: PnL 동기화 — DB 기반 중복 방지 ──────────────────────
  private async syncPnlStats(userId: string) {
    try {
      const state = await this.prisma.engineState.findFirst({ where: { userId } });
      if (!state) return;

      // lastPnlSyncAt: DB에서 읽어 서버 재시작에도 안전
      const lastSyncMs = (state as any).lastPnlSyncAt
        ? new Date((state as any).lastPnlSyncAt).getTime()
        : (Date.now() - 3600_000);
      const now = Date.now();

      // Binance income API — lastSync 이후 항목만 조회
      const incomes: any[] = await this.binance.getIncome('', 'REALIZED_PNL', lastSyncMs + 1, 1000);
      if (incomes.length === 0) {
        await (this.prisma.engineState as any).update({
          where: { userId }, data: { lastPnlSyncAt: new Date(now) },
        }).catch(() => {});
        return;
      }

      // dailyPnl: 오늘치만 SET (중복 방지 — increment 대신 오늘 전체 재계산)
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const allTodayIncomes: any[] = await this.binance.getIncome(
        '', 'REALIZED_PNL', todayStart.getTime(), 1000,
      );
      const todayPnl = allTodayIncomes.reduce((s: number, i: any) => s + parseFloat(i.income), 0);

      // consecLossCount: 신규 항목을 시간순 처리
      let consecLoss = state.consecLossCount ?? 0;
      const sorted   = [...incomes].sort((a, b) => a.time - b.time);
      for (const income of sorted) {
        const pnl = parseFloat(income.income);
        if (pnl < 0)      consecLoss++;
        else if (pnl > 0) consecLoss = 0;
      }

      // engineState 업데이트 (dailyPnl은 SET)
      await (this.prisma.engineState as any).update({
        where: { userId },
        data:  { dailyPnl: todayPnl, consecLossCount: consecLoss, lastPnlSyncAt: new Date(now) },
      });

      // ── 전략별 통계: 보수적 처리 — symbol 매칭 + 신규 항목만 ────
      // 전략이 여러 개일 때 symbol 충돌 가능성이 있어 단일 전략 심볼만 업데이트
      const strategies = await this.prisma.strategy.findMany({ where: { userId } });
      const symbolCount = strategies.reduce((m: Map<string, number>, s) => {
        m.set(s.symbol, (m.get(s.symbol) ?? 0) + 1);
        return m;
      }, new Map<string, number>());

      for (const strat of strategies) {
        // 동일 심볼을 쓰는 전략이 2개 이상이면 매칭 불확실 — 스킵
        if ((symbolCount.get(strat.symbol) ?? 0) > 1) continue;

        const stratIncomes = incomes.filter((i: any) => i.symbol === strat.symbol);
        if (stratIncomes.length === 0) continue;

        const pnlSum  = stratIncomes.reduce((s: number, i: any) => s + parseFloat(i.income), 0);
        const winCnt  = stratIncomes.filter((i: any) => parseFloat(i.income) > 0).length;

        await this.prisma.strategy.update({
          where: { id: strat.id },
          data:  {
            totalPnl:    { increment: pnlSum },
            totalTrades: { increment: stratIncomes.length },
            winTrades:   { increment: winCnt },
            lastSignalAt: new Date(),
          },
        });
      }

      this.logger.log(`[${userId}] PnL 동기화: ${incomes.length}건, 오늘PnL: ${todayPnl.toFixed(4)}, consecLoss: ${consecLoss}`);
    } catch (e: any) {
      this.logger.warn(`[syncPnlStats] 오류 (무시): ${e.message}`);
    }
  }

  // ── riskGuard ────────────────────────────────────────────────────
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

    // engineState.dailyTrades 기준 — MARKET 진입 주문만 카운트 (TP/SL 제외)
    const currentDailyTrades = state.dailyTrades ?? 0;
    const maxDailyTrades     = strategy.maxDailyTrades ?? 10;
    if (currentDailyTrades >= maxDailyTrades) {
      await this.logRiskBlock(userId, strategy.id, strategy.symbol, 'DAILY_TRADES_EXCEEDED',
        { dailyTrades: currentDailyTrades, maxDailyTrades });
      return { ok: false, reason: 'DAILY_TRADES_EXCEEDED' };
    }

    let binancePositions: any[];
    try {
      binancePositions = await this.binance.getPositionsStrict();
    } catch (e: any) {
      await this.logRiskBlock(userId, strategy.id, strategy.symbol, 'POSITION_FETCH_FAILED', e.message);
      return { ok: false, reason: 'POSITION_FETCH_FAILED' };
    }
    if (binancePositions.find(p => p.symbol === strategy.symbol && parseFloat(p.positionAmt) !== 0)) {
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

      // ── TEST_FORCE_ENTRY_ONCE 모드 감지 ─────────────────────────
      const allRules = [
        ...(params.longEntryRules ?? []),
        ...(params.shortEntryRules ?? []),
      ];
      const isTestEntry = allRules.some(r => r.type === 'TEST_FORCE_ENTRY_ONCE');
      const testEntryUsed = !!(params as any).testEntryUsed;

      if (isTestEntry && testEntryUsed) {
        this.logger.log(`[${strategy.symbol}] 테스트 진입 이미 완료 — 전략 자동 비활성화`);
        await this.prisma.strategy.update({ where: { id: strategy.id }, data: { enabled: false } });
        return;
      }

      if (isTestEntry && !testEntryUsed) {
        // Trading Health Check: 최근 1시간 내 치명 리스크 로그 확인
        const oneHourAgo = new Date(Date.now() - 3600_000);
        const criticalLog = await this.prisma.riskBlockLog.findFirst({
          where: {
            userId,
            reason:    { in: ['ENTRY_ORDER_UNPROTECTED','SL_ORDER_FAILED','ENTRY_ORDER_STATUS_UNKNOWN','POSITION_STILL_OPEN','CLOSE_VERIFY_FAILED'] },
            createdAt: { gte: oneHourAgo },
          },
        });
        if (criticalLog) {
          await this.logRiskBlock(userId, strategy.id, strategy.symbol, 'TEST_ENTRY_BLOCKED',
            { reason: 'hasCriticalRiskBlock', criticalReason: criticalLog.reason, at: criticalLog.createdAt });
          this.logger.warn(`[${strategy.symbol}] 테스트 진입 차단 — 치명 리스크 로그: ${criticalLog.reason}`);
          return;
        }
        // Binance open algo orders 체크 (SL 없는 포지션 보호)
        let openAlgoCount = 0;
        let algoFetchErr: string | null = null;
        try {
          const algoOrders = await this.binance.getOpenAlgoOrders(strategy.symbol);
          openAlgoCount = algoOrders.length;
        } catch (e: any) {
          algoFetchErr = e.message;
        }

        const healthDetail = {
          hasCriticalRiskBlock: false,
          hasOpenAlgoOrders:    openAlgoCount > 0,
          algoOrderCount:       openAlgoCount,
          algoFetchError:       algoFetchErr,
        };

        if (algoFetchErr) {
          await this.logRiskBlock(userId, strategy.id, strategy.symbol, 'TEST_ENTRY_BLOCKED',
            { reason: 'ALGO_FETCH_FAILED', ...healthDetail });
          this.logger.warn(`[${strategy.symbol}] 테스트 진입 차단 — Algo 주문 조회 실패`);
          return;
        }

        this.logger.log(`[${strategy.symbol}] TEST_FORCE_ENTRY_ONCE — 진입 시도 (algoOrders: ${openAlgoCount})`);
      }

      const tfMap: Record<string, string> = { m1:'1m', m5:'5m', m15:'15m', h1:'1h', h4:'4h' };
      let klines: Kline[] = await this.binance.getKlines(strategy.symbol, tfMap[strategy.timeframe] ?? '15m', 250);

      if (params.useClosedCandleOnly !== false)
        klines = klines.filter(k => k.closeTime < Date.now());
      if (klines.length < 50) {
        this.logger.warn(`[${strategy.symbol}] 캔들 수 부족 (${klines.length}), 스킵`);
        return;
      }

      const evalMode = params.evalMode ?? 'ALL';
      const minScore = params.minScore ?? 60;
      if ((params.blockRules ?? []).length > 0 &&
          this.evaluator.evaluate(params.blockRules!, klines, 'ANY').signal) {
        this.logger.log(`[${strategy.symbol}] 차단 조건 발동`);
        return;
      }

      let longSignal  = false;
      let shortSignal = false;

      if (strategy.allowLong) {
        const rules = params.longEntryRules ?? [];
        for (const r of rules) { const e = validateRule(r); if (e) { this.logger.warn(`롱 rule: ${e}`); return; } }
        longSignal = this.evaluator.evaluate(rules, klines, evalMode, minScore).signal;
      }
      if (strategy.allowShort) {
        const rules = params.shortEntryRules ?? [];
        for (const r of rules) { const e = validateRule(r); if (e) { this.logger.warn(`숏 rule: ${e}`); return; } }
        shortSignal = this.evaluator.evaluate(rules, klines, evalMode, minScore).signal;
      }

      if (longSignal && shortSignal) {
        await this.logRiskBlock(userId, strategy.id, strategy.symbol, 'CONFLICTING_SIGNALS');
        return;
      }

      const directions: Array<'LONG' | 'SHORT'> = [];
      if (longSignal)  directions.push('LONG');
      if (shortSignal) directions.push('SHORT');

      for (const dir of directions) {
        const guard = await this.riskGuard(userId, strategy);
        if (!guard.ok) continue;
        const entryResult = await this.enterPosition(userId, strategy, dir, klines);

        // TEST_FORCE_ENTRY_ONCE: entered===true일 때만 비활성화
        if (isTestEntry) {
          if (entryResult.entered) {
            await this.prisma.strategy.update({
              where: { id: strategy.id },
              data: {
                enabled: false,
                params: { ...(params as object), testEntryUsed: true } as any,
              },
            }).catch(e => this.logger.warn(`테스트 전략 비활성화 실패: ${e.message}`));
            this.logger.log(`[${strategy.symbol}] 테스트 진입 완료 — 전략 자동 비활성화 (protected: ${entryResult.protected})`);
          } else {
            await this.logRiskBlock(userId, strategy.id, strategy.symbol, 'TEST_ENTRY_FAILED',
              { reason: entryResult.reason ?? 'UNKNOWN', direction: dir });
            this.logger.warn(`[${strategy.symbol}] 테스트 진입 실패 — testEntryUsed 변경 없음 (reason: ${entryResult.reason})`);
          }
          break;  // 1회만 시도
        }
      }
    } catch (e: any) {
      this.logger.error(`[${strategy.symbol}] processStrategy 오류: ${e.message}`);
    }
  }

  private async enterPosition(userId: string, strategy: any, direction: 'LONG' | 'SHORT', _klines: Kline[]): Promise<EnterPositionResult> {
    const symbol = strategy.symbol;
    try {
      const filters = await this.binance.getSymbolFilters(symbol);
      const price   = await this.binance.getTickerPrice(symbol);

      await this.binance.setLeverage(symbol, strategy.leverage);
      await this.binance.setMarginType(symbol, strategy.marginType);

      const qty = formatQty((strategy.positionSizeUsdt * strategy.leverage) / price, filters.stepSize);

      if (parseFloat(qty) < filters.minQty) {
        this.logger.warn(`[${symbol}] 최소 수량 미달`);
        return { entered: false, protected: false, reason: 'MIN_QTY_NOT_MET' };
      }
      // snappedQty 기준 minNotional 재검사
      const actualNotional = parseFloat(qty) * price;
      if (actualNotional < filters.minNotional) {
        await this.logRiskBlock(userId, strategy.id ?? null, symbol, 'MIN_NOTIONAL_AFTER_ROUNDING',
          { qty, price, actualNotional, minNotional: filters.minNotional });
        return { entered: false, protected: false, reason: 'MIN_NOTIONAL_AFTER_ROUNDING' };
      }

      const side     = direction === 'LONG' ? 'BUY' : 'SELL';
      const orderRes = await this.binance.placeOrder({
        symbol, side, positionSide: 'BOTH', type: 'MARKET',
        quantity: qty, newOrderRespType: 'RESULT',
      });

      // 체결 확인 — 3회 재조회
      const orderId = orderRes.orderId;
      let confirmed = orderRes;
      if (orderId && !['FILLED', 'PARTIALLY_FILLED'].includes(confirmed.status)) {
        for (let i = 0; i < 3; i++) {
          await sleep(400);
          try {
            confirmed = await this.binance.getOrderDetail(symbol, orderId);
            if (['FILLED', 'PARTIALLY_FILLED'].includes(confirmed.status)) break;
          } catch {}
        }
      }

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
            this.logger.warn(`[${symbol}] 포지션 기준 FILLED 처리`);
          } else {
            await this.logRiskBlock(userId, strategy.id ?? null, symbol, 'ENTRY_ORDER_STATUS_UNKNOWN', { orderId });
            await this.haltEngine(userId, 'ENTRY_ORDER_STATUS_UNKNOWN');
            return { entered: false, protected: false, reason: 'ENTRY_ORDER_STATUS_UNKNOWN' };
          }
        } catch (e: any) {
          await this.logRiskBlock(userId, strategy.id ?? null, symbol, 'ENTRY_ORDER_STATUS_UNKNOWN', { orderId, error: e.message });
          await this.haltEngine(userId, 'ENTRY_ORDER_STATUS_UNKNOWN');
          return { entered: false, protected: false, reason: 'ENTRY_ORDER_STATUS_UNKNOWN' };
        }
      }

      // ── 항목 1: binanceOrderId — orderId 없으면 null ──────────────
      await this.prisma.order.create({
        data: {
          userId,
          strategyId:     strategy.id ?? null,
          binanceOrderId: toOrderId(orderId),   // null 가능
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

      if (['FILLED', 'PARTIALLY_FILLED'].includes(orderStatus)) {
        await this.prisma.engineState.updateMany({
          where: { userId }, data: { dailyTrades: { increment: 1 } },
        }).catch(() => {});
      }

      const closeSide = side === 'BUY' ? 'SELL' : 'BUY';
      const pDir      = direction === 'LONG' ? 1 : -1;
      let tpOk        = strategy.takeProfitPct <= 0;
      let slOk        = strategy.stopLossPct  <= 0;

      // TP 주문 — Algo Order API (POST /fapi/v1/algoOrder)
      if (strategy.takeProfitPct > 0) {
        const tp = formatPrice(fillPrice * (1 + pDir * strategy.takeProfitPct / 100), filters.tickSize);
        try {
          const tpRes = await this.binance.placeAlgoOrder({
            algoType:      'CONDITIONAL',
            symbol,
            side:          closeSide,
            positionSide:  'BOTH',
            type:          'TAKE_PROFIT_MARKET',
            triggerPrice:  tp,
            closePosition: 'true',
            workingType:   'MARK_PRICE',
          });

          // algoId 기반 binanceOrderId (symbol prefix로 고유성 보장)
          const rawAlgoId    = tpRes.algoId ? String(tpRes.algoId) : null;
          const rawClientId  = tpRes.clientAlgoId ?? null;
          const binOrderId   = rawAlgoId   ? `${symbol}:${rawAlgoId}`  :
                               rawClientId ? `${symbol}:${rawClientId}` : null;

          // 1회 재조회로 algoStatus 확인
          let confirmedStatus = tpRes.algoStatus ?? 'UNKNOWN';
          const numericAlgoId = tpRes.algoId ? Number(tpRes.algoId) : undefined;
          if (numericAlgoId || rawClientId) {
            try {
              await sleep(300);
              const verified = await this.binance.getAlgoOrder(numericAlgoId, rawClientId ?? undefined);
              confirmedStatus = verified.algoStatus ?? confirmedStatus;
            } catch (ve: any) {
              this.logger.warn(`[${symbol}] TP Algo 재조회 실패: ${ve.message}`);
            }
          }

          const validStatuses = ['NEW', 'ACCEPTED', 'WORKING'];
          if (!validStatuses.includes(confirmedStatus)) {
            throw new Error(`TP algoStatus 비정상: ${confirmedStatus}`);
          }

          await this.prisma.order.create({
            data: {
              userId, strategyId: strategy.id ?? null,
              binanceOrderId: binOrderId,
              symbol, side: closeSide as any, positionSide: 'BOTH' as any,
              orderType: 'TAKE_PROFIT_MARKET' as any,
              status:    'NEW' as any,
              quantity:  parseFloat(qty),
              stopPrice: parseFloat(tp),
              leverage:  strategy.leverage,
              marginType: strategy.marginType as any,
              exitReason: 'TAKE_PROFIT',
            },
          }).catch(() => {});
          this.logger.log(`[${symbol}] TP Algo: ${tp} (algoId: ${rawAlgoId}, status: ${confirmedStatus})`);
          tpOk = true;
        } catch (e: any) {
          await this.logRiskBlock(userId, strategy.id ?? null, symbol, 'TP_ORDER_FAILED',
            { tp, fillPrice, direction, error: e.message });
        }
      }

      // SL 주문 — Algo Order API (POST /fapi/v1/algoOrder)
      // SL 실패 시 엔진 STOPPED 유지 (핵심 보호)
      if (strategy.stopLossPct > 0) {
        const sl = formatPrice(fillPrice * (1 - pDir * strategy.stopLossPct / 100), filters.tickSize);
        try {
          const slRes = await this.binance.placeAlgoOrder({
            algoType:      'CONDITIONAL',
            symbol,
            side:          closeSide,
            positionSide:  'BOTH',
            type:          'STOP_MARKET',
            triggerPrice:  sl,
            closePosition: 'true',
            workingType:   'MARK_PRICE',
          });

          // algoId 기반 binanceOrderId (symbol prefix로 고유성 보장)
          const rawAlgoId    = slRes.algoId ? String(slRes.algoId) : null;
          const rawClientId  = slRes.clientAlgoId ?? null;
          const binOrderId   = rawAlgoId   ? `${symbol}:${rawAlgoId}`  :
                               rawClientId ? `${symbol}:${rawClientId}` : null;

          // 1회 재조회로 algoStatus 확인 (SL은 실패 시 엔진 중지)
          let confirmedStatus = slRes.algoStatus ?? 'UNKNOWN';
          const numericAlgoId = slRes.algoId ? Number(slRes.algoId) : undefined;
          if (numericAlgoId || rawClientId) {
            try {
              await sleep(300);
              const verified = await this.binance.getAlgoOrder(numericAlgoId, rawClientId ?? undefined);
              confirmedStatus = verified.algoStatus ?? confirmedStatus;
            } catch (ve: any) {
              this.logger.warn(`[${symbol}] SL Algo 재조회 실패: ${ve.message}`);
              // 재조회 실패 자체는 SL 무효화하지 않음 (placeAlgoOrder 성공했으므로)
            }
          }

          const validStatuses = ['NEW', 'ACCEPTED', 'WORKING'];
          if (!validStatuses.includes(confirmedStatus)) {
            throw new Error(`SL algoStatus 비정상: ${confirmedStatus}`);
          }

          await this.prisma.order.create({
            data: {
              userId, strategyId: strategy.id ?? null,
              binanceOrderId: binOrderId,
              symbol, side: closeSide as any, positionSide: 'BOTH' as any,
              orderType: 'STOP_MARKET' as any,
              status:    'NEW' as any,
              quantity:  parseFloat(qty),
              stopPrice: parseFloat(sl),
              leverage:  strategy.leverage,
              marginType: strategy.marginType as any,
              exitReason: 'STOP_LOSS',
            },
          }).catch(() => {});
          this.logger.log(`[${symbol}] SL Algo: ${sl} (algoId: ${rawAlgoId}, status: ${confirmedStatus})`);
          slOk = true;
        } catch (e: any) {
          this.logger.error(`[${symbol}] SL Algo 실패: ${e.message}`);
          // slOk = false 유지 → 하단에서 ENTRY_ORDER_UNPROTECTED + 엔진 중지
        }
      }

      if (!slOk) {
        await this.logRiskBlock(userId, strategy.id ?? null, symbol, 'ENTRY_ORDER_UNPROTECTED',
          { fillPrice, direction, tpOk });
        await this.haltEngine(userId, 'ENTRY_ORDER_UNPROTECTED');
        return { entered: true, protected: false, reason: 'SL_ORDER_FAILED' };
      }

      return { entered: true, protected: true };

    } catch (e: any) {
      this.logger.error(`[${symbol}] enterPosition 오류: ${e.message}`);
      return { entered: false, protected: false, reason: `EXCEPTION: ${e.message}` };
    }
  }
}
