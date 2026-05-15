// ── 수량 포맷 (LOT_SIZE stepSize 반영) ────────────────────────────────
function formatQty(qty: number, step: number): string {
  const precision = step < 1 ? (String(step).split('.')[1]?.length ?? 0) : 0;
  const snapped = Math.floor(qty / step) * step;
  return snapped.toFixed(precision);
}

// ── 가격 포맷 (PRICE_FILTER tickSize 반영) ────────────────────────────
function formatPrice(price: number, tickSize: number): string {
  const precision = tickSize < 1 ? (String(tickSize).split('.')[1]?.length ?? 0) : 0;
  const snapped = Math.floor(price / tickSize) * tickSize;
  return snapped.toFixed(precision);
}

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BinanceService } from '../binance/binance.service';

@Injectable()
export class StrategyEngineService {
  private readonly logger = new Logger(StrategyEngineService.name);
  private timers = new Map<string, NodeJS.Timeout>();

  constructor(
    private prisma: PrismaService,
    private binance: BinanceService,
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

  // ── 엔진 강제 중지 ────────────────────────────────────────────────────
  private async haltEngine(userId: string, reason: string) {
    this.stopEngine(userId);
    try {
      await this.prisma.engineState.updateMany({
        where: { userId },
        data: { status: 'STOPPED' as any, stopReason: reason },
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

  // ── 리스크 가드 ──────────────────────────────────────────────────────
  private async riskGuard(
    userId: string,
    strategy: any,
  ): Promise<{ ok: boolean; reason?: string }> {
    const state = await this.prisma.engineState.findFirst({ where: { userId } });
    if (!state || state.status !== 'RUNNING')
      return { ok: false, reason: 'ENGINE_NOT_RUNNING' };

    if ((strategy.leverage ?? 1) > 20)
      return { ok: false, reason: 'LEVERAGE_EXCEEDED' };

    let positions: any[];
    try {
      positions = await this.binance.getPositionsStrict();
    } catch {
      return { ok: false, reason: 'POSITION_FETCH_FAILED' };
    }

    if (positions.some((p: any) => p.symbol === strategy.symbol && parseFloat(p.positionAmt) !== 0))
      return { ok: false, reason: 'POSITION_EXISTS' };

    const openCount = positions.filter((p: any) => parseFloat(p.positionAmt) !== 0).length;
    if (openCount >= (strategy.maxPositions ?? 1))
      return { ok: false, reason: 'MAX_POSITIONS_EXCEEDED' };

    const dailyPnl    = (state as any).dailyPnl       ?? 0;
    const dailyTrades = (state as any).dailyTrades     ?? 0;
    const consecLoss  = (state as any).consecLossCount ?? 0;

    if (strategy.maxDailyLoss > 0 && dailyPnl < -strategy.maxDailyLoss)
      return { ok: false, reason: 'DAILY_LOSS_EXCEEDED' };
    if (strategy.maxDailyTrades > 0 && dailyTrades >= strategy.maxDailyTrades)
      return { ok: false, reason: 'DAILY_TRADES_EXCEEDED' };
    if (strategy.stopOnConsecLoss > 0 && consecLoss >= strategy.stopOnConsecLoss)
      return { ok: false, reason: 'CONSEC_LOSS_EXCEEDED' };

    try {
      const balances  = await this.binance.getBalance();
      const usdt      = Array.isArray(balances)
        ? balances.find((b: any) => b.asset === 'USDT')
        : balances;
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
      const params = strategy.params as any;
      const tf = strategy.timeframe.replace(/^([a-zA-Z]+)(\d+)$/, '$2$1');
      const klines = await this.binance.getKlines(strategy.symbol, tf, 50);
      if (!klines || klines.length < 20) return;

      const closes = klines.map((k: any) => Number(k.close));

      if (strategy.type === 'RSI_EXTREME') {
        const period     = params?.rsiPeriod ?? 14;
        const overbought = params?.overboughtLevel ?? params?.overbought ?? 70;
        const oversold   = params?.oversoldLevel   ?? params?.oversold   ?? 30;
        const rsi = this.calcRSI(closes, period);
        this.logger.log(`[${strategy.symbol}] RSI: ${rsi.toFixed(2)} (ob:${overbought} os:${oversold})`);

        if (rsi < oversold && strategy.allowLong)
          await this.placeOrder(userId, strategy, 'BUY', 'RSI_OVERSOLD');
        else if (rsi > overbought && strategy.allowShort)
          await this.placeOrder(userId, strategy, 'SELL', 'RSI_OVERBOUGHT');

      } else if (strategy.type === 'MA_CROSS') {
        const short     = params?.shortPeriod ?? 9;
        const long      = params?.longPeriod  ?? 21;
        const emaShort  = this.calcEMA(closes, short);
        const emaLong   = this.calcEMA(closes, long);
        const prevShort = this.calcEMA(closes.slice(0, -1), short);
        const prevLong  = this.calcEMA(closes.slice(0, -1), long);

        if (prevShort <= prevLong && emaShort > emaLong && strategy.allowLong)
          await this.placeOrder(userId, strategy, 'BUY', 'EMA_GOLDEN_CROSS');
        else if (prevShort >= prevLong && emaShort < emaLong && strategy.allowShort)
          await this.placeOrder(userId, strategy, 'SELL', 'EMA_DEAD_CROSS');

      } else if (strategy.type === 'BOLLINGER_BREAKOUT') {
        const period = params?.bbPeriod  ?? params?.period     ?? 20;
        const mult   = params?.bbStdDev  ?? params?.multiplier ?? 2.0;
        if (closes.length < period + 1) return;

        const slice = closes.slice(-period);
        const mean  = slice.reduce((a: number, b: number) => a + b, 0) / period;
        const std   = Math.sqrt(slice.reduce((s: number, v: number) => s + (v - mean) ** 2, 0) / period);
        const upper = mean + mult * std;
        const lower = mean - mult * std;
        const price = closes[closes.length - 1];

        this.logger.log(
          `[${strategy.symbol}] BB upper:${upper.toFixed(4)} lower:${lower.toFixed(4)} price:${price.toFixed(4)}`,
        );

        if (price > upper && strategy.allowLong)
          await this.placeOrder(userId, strategy, 'BUY', 'BB_UPPER_BREAKOUT');
        else if (price < lower && strategy.allowShort)
          await this.placeOrder(userId, strategy, 'SELL', 'BB_LOWER_BREAKOUT');
      }
    } catch (e) {
      this.logger.error(`[${strategy.symbol}] 전략 처리 오류`, e);
    }
  }

  // ── 주문 실행 ─────────────────────────────────────────────────────────
  private async placeOrder(
    userId: string,
    strategy: any,
    side: 'BUY' | 'SELL',
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
        } catch (logErr: any) { this.logger.warn('riskBlockLog 저장 실패', logErr.message); }
        return;
      }

      // getSymbolFilters 실패 시 주문 차단
      let filters: { stepSize: number; minQty: number; minNotional: number; tickSize: number };
      try {
        filters = await this.binance.getSymbolFilters(strategy.symbol);
      } catch (e: any) {
        this.logger.error(`[${strategy.symbol}] 심볼 필터 조회 실패 — 주문 차단: ${e.message}`);
        return;
      }

      const price    = await this.binance.getTickerPrice(strategy.symbol);
      const notional = (strategy.positionSizeUsdt ?? 100) * (strategy.leverage ?? 1);
      const qty      = notional / price;
      const qtyStr   = formatQty(qty, filters.stepSize);
      const qtyNum   = parseFloat(qtyStr);

      if (qtyNum <= 0) { this.logger.error(`[${strategy.symbol}] 수량 0 — 주문 차단`); return; }
      if (qtyNum < filters.minQty) { this.logger.error(`[${strategy.symbol}] 수량 ${qtyNum} < minQty ${filters.minQty} — 주문 차단`); return; }
      if (filters.minNotional > 0 && qtyNum * price < filters.minNotional) {
        this.logger.error(`[${strategy.symbol}] notional < minNotional ${filters.minNotional} — 주문 차단`); return;
      }

      this.logger.log(`[${strategy.symbol}] ${side} 주문 시도 qty:${qtyStr} price:${price} reason:${entryReason}`);

      await this.binance.setLeverage(strategy.symbol, strategy.leverage ?? 1);

      // ★ fix #1: newOrderRespType:'RESULT' — avgPrice/status 포함된 응답 요청
      let orderResult = await this.binance.placeOrder({
        symbol:           strategy.symbol,
        side,
        positionSide:     'BOTH',
        type:             'MARKET',
        quantity:         qtyStr,
        newOrderRespType: 'RESULT',
      });

      const orderId = orderResult?.orderId;
      if (!orderId) { this.logger.error(`[${strategy.symbol}] orderId 없음 — TP/SL 생성 중단`); return; }

      // RESULT에도 avgPrice 없으면 orderId로 재조회
      if (!orderResult?.avgPrice || parseFloat(orderResult.avgPrice) === 0) {
        try {
          this.logger.warn(`[${strategy.symbol}] avgPrice 없음 — orderId ${orderId} 재조회`);
          orderResult = await this.binance.getOrderDetail(strategy.symbol, orderId);
        } catch (e: any) {
          this.logger.warn(`[${strategy.symbol}] 주문 재조회 실패: ${e.message}`);
        }
      }

      const orderStatus  = orderResult?.status as string;
      const executedQty  = parseFloat(orderResult?.executedQty ?? '0');
      const avgFillPrice = parseFloat(orderResult?.avgPrice    ?? '0');
      const isFilled     = orderStatus === 'FILLED' || orderStatus === 'PARTIALLY_FILLED';

      this.logger.log(
        `[${strategy.symbol}] ${side} 완료 orderId:${orderId} status:${orderStatus} executedQty:${executedQty} avgPrice:${avgFillPrice}`,
      );

      try {
        await this.prisma.order.create({
          data: {
            userId,
            strategyId:     strategy.id,
            binanceOrderId: String(orderId),
            symbol:         strategy.symbol,
            side:           side as any,
            positionSide:   'BOTH' as any,
            orderType:      'MARKET' as any,
            status:         (isFilled ? orderStatus : (orderStatus ?? 'ERROR')) as any,
            quantity:       executedQty > 0 ? executedQty : qtyNum,
            avgFillPrice:   avgFillPrice > 0 ? avgFillPrice : price,
            leverage:       strategy.leverage ?? 1,
            marginType:     (strategy.marginType ?? 'ISOLATED') as any,
            entryReason,
          },
        });
      } catch (dbErr: any) {
        this.logger.error(`[${strategy.symbol}] DB 주문 저장 실패 (거래는 정상)`, dbErr.message);
      }

      if (!isFilled) {
        this.logger.warn(`[${strategy.symbol}] 주문 상태 ${orderStatus} — TP/SL 생성 생략`);
        return;
      }

      try {
        await this.prisma.engineState.updateMany({ where: { userId }, data: { dailyTrades: { increment: 1 } } });
      } catch (e: any) { this.logger.error('dailyTrades 증가 실패', e.message); }

      await this.placeTpSl(userId, strategy, side, qtyStr, avgFillPrice, filters.tickSize);

    } catch (e) {
      this.logger.error(`[${strategy.symbol}] 주문 실패`, e);
    }
  }

  // ── TP/SL ─────────────────────────────────────────────────────────────
  private async placeTpSl(
    userId: string,
    strategy: any,
    side: string,
    qtyStr: string,
    avgFillPrice: number,
    tickSize: number,
  ) {
    let fillPrice = avgFillPrice > 0 ? avgFillPrice : 0;

    // 체결가 없으면 포지션 조회로 확인
    if (fillPrice <= 0) {
      try {
        const positions = await this.binance.getPositionsStrict();
        const pos = positions.find(
          (p: any) => p.symbol === strategy.symbol && parseFloat(p.positionAmt) !== 0,
        );
        if (pos) {
          fillPrice = parseFloat(pos.entryPrice);
          this.logger.warn(`[${strategy.symbol}] avgPrice 없음 — entryPrice ${fillPrice} 사용`);
        }
      } catch (e: any) {
        this.logger.error(`[${strategy.symbol}] entryPrice 조회 실패 — 엔진 중지`);
        await this.haltEngine(userId, 'ENTRY_PRICE_CHECK_FAILED');
        return;
      }
    }

    if (fillPrice <= 0) {
      this.logger.error(`[${strategy.symbol}] 체결가 확인 불가 — 엔진 중지`);
      await this.haltEngine(userId, 'ENTRY_PRICE_CHECK_FAILED');
      return;
    }

    const dir = side === 'BUY' ? 1 : -1;

    // ── TP ────────────────────────────────────────────────────────────
    if ((strategy.takeProfitPct ?? 0) > 0) {
      try {
        const tp = formatPrice(fillPrice * (1 + dir * strategy.takeProfitPct / 100), tickSize);
        // ★ fix #4: timeInForce 제거 — TAKE_PROFIT_MARKET + closePosition에 불필요
        await this.binance.placeOrder({
          symbol:        strategy.symbol,
          side:          side === 'BUY' ? 'SELL' : 'BUY',
          positionSide:  'BOTH',
          type:          'TAKE_PROFIT_MARKET',
          stopPrice:     tp,
          closePosition: 'true',
        });
        this.logger.log(`[${strategy.symbol}] TP 설정: ${tp}`);
      } catch (e: any) {
        this.logger.error(`[${strategy.symbol}] TP 설정 실패`, e.message);
        // ★ fix #3: TP 실패 riskBlockLog 기록
        try {
          await this.prisma.riskBlockLog.create({
            data: { userId, strategyId: strategy.id ?? null, symbol: strategy.symbol, reason: 'TP_ORDER_FAILED', detail: e.message },
          });
        } catch {}
        // TP 실패 시 엔진 중지 여부 (선택): 필요 시 아래 주석 해제
        // await this.haltEngine(userId, 'TP_ORDER_FAILED');
      }
    }

    // ── SL ────────────────────────────────────────────────────────────
    if ((strategy.stopLossPct ?? 0) > 0) {
      try {
        const sl = formatPrice(fillPrice * (1 - dir * strategy.stopLossPct / 100), tickSize);
        // ★ fix #4: timeInForce 제거 — STOP_MARKET + closePosition에 불필요
        await this.binance.placeOrder({
          symbol:        strategy.symbol,
          side:          side === 'BUY' ? 'SELL' : 'BUY',
          positionSide:  'BOTH',
          type:          'STOP_MARKET',
          stopPrice:     sl,
          closePosition: 'true',
        });
        this.logger.log(`[${strategy.symbol}] SL 설정: ${sl}`);
      } catch (e: any) {
        this.logger.error(`[${strategy.symbol}] SL 설정 실패 — 엔진 강제 중지`, e.message);
        try {
          await this.prisma.riskBlockLog.create({
            data: { userId, strategyId: strategy.id ?? null, symbol: strategy.symbol, reason: 'SL_ORDER_FAILED', detail: e.message },
          });
        } catch {}
        await this.haltEngine(userId, 'SL_ORDER_FAILED');
      }
    }
  }

  private calcRSI(closes: number[], period: number): number {
    if (closes.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = closes.length - period; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff > 0) gains += diff; else losses -= diff;
    }
    const rs = gains / (losses || 0.0001);
    return 100 - 100 / (1 + rs);
  }

  private calcEMA(closes: number[], period: number): number {
    if (closes.length < period) return closes[closes.length - 1];
    const k = 2 / (period + 1);
    let ema = closes.slice(0, period).reduce((a, b) => a + b) / period;
    for (let i = period; i < closes.length; i++) {
      ema = closes[i] * k + ema * (1 - k);
    }
    return ema;
  }
}
