function formatQty(qty: number, step: number): string {
  const precision = step < 1 ? String(step).split('.')[1]?.length ?? 0 : 0;
  const snapped = Math.floor(qty / step) * step;
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

  private async scanStrategies(userId: string) {
    try {
      const state = await this.prisma.engineState.findFirst({ where: { userId } });
      if (!state || state.status !== 'RUNNING') return;

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
    userId: string,
    strategy: any,
  ): Promise<{ ok: boolean; reason?: string }> {
    // 1. 엔진 상태 확인
    const state = await this.prisma.engineState.findFirst({ where: { userId } });
    if (!state || state.status !== 'RUNNING')
      return { ok: false, reason: 'ENGINE_NOT_RUNNING' };

    // 2. 레버리지 제한
    if ((strategy.leverage ?? 1) > 20)
      return { ok: false, reason: 'LEVERAGE_EXCEEDED' };

    // 3. 동일 심볼 포지션 중복 차단
    const positions = await this.binance.getPositions();
    const hasPos = positions.some(
      (p: any) => p.symbol === strategy.symbol && parseFloat(p.positionAmt) !== 0,
    );
    if (hasPos) return { ok: false, reason: 'POSITION_EXISTS' };

    // 4. 최대 동시 포지션 초과
    const openCount = positions.filter(
      (p: any) => parseFloat(p.positionAmt) !== 0,
    ).length;
    if (openCount >= (strategy.maxPositions ?? 1))
      return { ok: false, reason: 'MAX_POSITIONS_EXCEEDED' };

    // 5. 일일 리스크 — engineState에서 읽기 (★ 수정: riskState → engineState)
    const dailyPnl = (state as any).dailyPnl ?? 0;
    const dailyTrades = (state as any).dailyTrades ?? 0;
    const consecLoss = (state as any).consecLossCount ?? 0;

    if (strategy.maxDailyLoss > 0 && dailyPnl < -strategy.maxDailyLoss)
      return { ok: false, reason: 'DAILY_LOSS_EXCEEDED' };
    if (strategy.maxDailyTrades > 0 && dailyTrades >= strategy.maxDailyTrades)
      return { ok: false, reason: 'DAILY_TRADES_EXCEEDED' };
    if (strategy.stopOnConsecLoss > 0 && consecLoss >= strategy.stopOnConsecLoss)
      return { ok: false, reason: 'CONSEC_LOSS_EXCEEDED' };

    // 6. 잔고 확인 — ★ 수정: getBalance()는 배열 반환, USDT 직접 찾기
    try {
      const balances = await this.binance.getBalance();
      const usdt = Array.isArray(balances)
        ? balances.find((b: any) => b.asset === 'USDT')
        : balances;
      const available = parseFloat(usdt?.availableBalance ?? usdt?.balance ?? '0');
      const required = strategy.positionSizeUsdt ?? 100;
      if (available < required)
        return { ok: false, reason: 'INSUFFICIENT_BALANCE' };
    } catch {
      // 잔고 조회 실패 시 통과 (rate limit 등)
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

      // ★ 수정: k[4] → k.close (binance.service가 객체로 매핑)
      const closes = klines.map((k: any) => Number(k.close));

      // RSI_EXTREME ──────────────────────────────────────────────────────
      if (strategy.type === 'RSI_EXTREME') {
        const period = params?.rsiPeriod ?? 14;
        const overbought = params?.overboughtLevel ?? params?.overbought ?? 70;
        const oversold = params?.oversoldLevel ?? params?.oversold ?? 30;
        const rsi = this.calcRSI(closes, period);
        this.logger.log(`[${strategy.symbol}] RSI: ${rsi.toFixed(2)} (ob:${overbought} os:${oversold})`);

        if (rsi < oversold && strategy.allowLong) {
          await this.placeOrder(userId, strategy, 'BUY', 'LONG');
        } else if (rsi > overbought && strategy.allowShort) {
          await this.placeOrder(userId, strategy, 'SELL', 'SHORT');
        }
      }

      // MA_CROSS ─────────────────────────────────────────────────────────
      else if (strategy.type === 'MA_CROSS') {
        const short = params?.shortPeriod ?? 9;
        const long = params?.longPeriod ?? 21;
        const emaShort = this.calcEMA(closes, short);
        const emaLong = this.calcEMA(closes, long);
        const prevShort = this.calcEMA(closes.slice(0, -1), short);
        const prevLong = this.calcEMA(closes.slice(0, -1), long);

        if (prevShort <= prevLong && emaShort > emaLong && strategy.allowLong) {
          await this.placeOrder(userId, strategy, 'BUY', 'LONG');
        } else if (prevShort >= prevLong && emaShort < emaLong && strategy.allowShort) {
          await this.placeOrder(userId, strategy, 'SELL', 'SHORT');
        }
      }

      // BOLLINGER_BREAKOUT ───────────────────────────────────────────────
      else if (strategy.type === 'BOLLINGER_BREAKOUT') {
        const period = params?.period ?? 20;
        const mult = params?.multiplier ?? 2.0;
        if (closes.length < period + 1) return;

        const slice = closes.slice(-period);
        const mean = slice.reduce((a: number, b: number) => a + b, 0) / period;
        const std = Math.sqrt(
          slice.reduce((s: number, v: number) => s + (v - mean) ** 2, 0) / period,
        );
        const upper = mean + mult * std;
        const lower = mean - mult * std;
        const price = closes[closes.length - 1];

        this.logger.log(
          `[${strategy.symbol}] BB upper:${upper.toFixed(4)} lower:${lower.toFixed(4)} price:${price.toFixed(4)}`,
        );

        if (price > upper && strategy.allowShort) {
          await this.placeOrder(userId, strategy, 'SELL', 'SHORT');
        } else if (price < lower && strategy.allowLong) {
          await this.placeOrder(userId, strategy, 'BUY', 'LONG');
        }
      }
    } catch (e) {
      this.logger.error(`[${strategy.symbol}] 전략 처리 오류`, e);
    }
  }

  // ── 주문 실행 ─────────────────────────────────────────────────────────
  private async placeOrder(
    userId: string,
    strategy: any,
    side: string,
    positionSide: string,
  ) {
    try {
      // 리스크 검사
      const guard = await this.riskGuard(userId, strategy);
      if (!guard.ok) {
        this.logger.log(`[${strategy.symbol}] 주문 차단: ${guard.reason}`);
        return;
      }

      const price = await this.binance.getTickerPrice(strategy.symbol);
      const stepSize = await this.binance.getStepSize(strategy.symbol);
      const notional = (strategy.positionSizeUsdt ?? 100) * (strategy.leverage ?? 1);
      const qty = notional / price;
      const qtyStr = formatQty(qty, stepSize);

      if (!qtyStr || parseFloat(qtyStr) <= 0) {
        this.logger.error(`[${strategy.symbol}] 수량 계산 오류: qty=${qtyStr}`);
        return;
      }

      this.logger.log(`[${strategy.symbol}] ${side} 주문 시도 qty:${qtyStr} price:${price}`);

      await this.binance.setLeverage(strategy.symbol, strategy.leverage ?? 1);
      await this.binance.placeOrder({
        symbol: strategy.symbol,
        side,
        positionSide: 'BOTH',
        type: 'MARKET',
        quantity: qtyStr,
      });

      this.logger.log(`[${strategy.symbol}] ${side} 주문 완료`);

      // TP/SL 주문
      await this.placeTpSl(strategy, side, qtyStr, price);

    } catch (e) {
      this.logger.error(`[${strategy.symbol}] 주문 실패`, e);
    }
  }

  // ── TP/SL ─────────────────────────────────────────────────────────────
  private async placeTpSl(
    strategy: any,
    side: string,
    qtyStr: string,
    entryPrice: number,
  ) {
    const dir = side === 'BUY' ? 1 : -1;

    if ((strategy.takeProfitPct ?? 0) > 0) {
      try {
        const tp = (entryPrice * (1 + dir * strategy.takeProfitPct / 100)).toFixed(2);
        await this.binance.placeOrder({
          symbol: strategy.symbol,
          side: side === 'BUY' ? 'SELL' : 'BUY',
          positionSide: 'BOTH',
          type: 'TAKE_PROFIT_MARKET',
          stopPrice: tp,
          closePosition: 'true',
          timeInForce: 'GTE_GTC',
        });
        this.logger.log(`[${strategy.symbol}] TP 설정: ${tp}`);
      } catch (e: any) {
        this.logger.error(`[${strategy.symbol}] TP 설정 실패 (포지션 유지)`, e.message);
      }
    }

    if ((strategy.stopLossPct ?? 0) > 0) {
      try {
        const sl = (entryPrice * (1 - dir * strategy.stopLossPct / 100)).toFixed(2);
        await this.binance.placeOrder({
          symbol: strategy.symbol,
          side: side === 'BUY' ? 'SELL' : 'BUY',
          positionSide: 'BOTH',
          type: 'STOP_MARKET',
          stopPrice: sl,
          closePosition: 'true',
          timeInForce: 'GTE_GTC',
        });
        this.logger.log(`[${strategy.symbol}] SL 설정: ${sl}`);
      } catch (e: any) {
        this.logger.error(`[${strategy.symbol}] SL 설정 실패 (포지션 유지)`, e.message);
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
