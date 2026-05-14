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
    await this.scanStrategies(userId); // 즉시 첫 스캔
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

  private async processStrategy(userId: string, strategy: any) {
    try {
      const params = strategy.params as any;
      const klines = await this.binance.getKlines(strategy.symbol, strategy.timeframe.replace(/^([a-zA-Z]+)(\d+)$/, '$2$1'), 50);
      if (!klines || klines.length < 20) return;

      const closes = klines.map((k: any) => parseFloat(k[4]));

      if (strategy.type === 'RSI_EXTREME') {
        const period = params?.rsiPeriod ?? 14;
        const overbought = params?.overboughtLevel ?? params?.overbought ?? 70;
        const oversold = params?.oversoldLevel ?? params?.oversold ?? 30;
        const rsi = this.calcRSI(closes, period);
        this.logger.log(`[${strategy.symbol}] RSI: ${rsi.toFixed(2)} (ob:${overbought} os:${oversold})`);

        const positions = await this.binance.getPositions();
        const hasPos = positions.some((p: any) =>
          p.symbol === strategy.symbol && parseFloat(p.positionAmt) !== 0
        );
        if (hasPos) return;

        if (rsi < oversold && strategy.allowLong) {
          await this.placeOrder(userId, strategy, 'BUY', 'LONG');
        } else if (rsi > overbought && strategy.allowShort) {
          await this.placeOrder(userId, strategy, 'SELL', 'SHORT');
        }
      } else if (strategy.type === 'MA_CROSS') {
        const short = params?.shortPeriod ?? 9;
        const long = params?.longPeriod ?? 21;
        const emaShort = this.calcEMA(closes, short);
        const emaLong = this.calcEMA(closes, long);
        const prevShort = this.calcEMA(closes.slice(0, -1), short);
        const prevLong = this.calcEMA(closes.slice(0, -1), long);

        const positions = await this.binance.getPositions();
        const hasPos = positions.some((p: any) =>
          p.symbol === strategy.symbol && parseFloat(p.positionAmt) !== 0
        );
        if (hasPos) return;

        if (prevShort <= prevLong && emaShort > emaLong && strategy.allowLong) {
          await this.placeOrder(userId, strategy, 'BUY', 'LONG');
        } else if (prevShort >= prevLong && emaShort < emaLong && strategy.allowShort) {
          await this.placeOrder(userId, strategy, 'SELL', 'SHORT');
        }
      }
    } catch (e) {
      this.logger.error(`[${strategy.symbol}] 전략 처리 오류`, e);
    }
  }

  private async placeOrder(userId: string, strategy: any, side: string, positionSide: string) {
    try {
      const price = await this.binance.getTickerPrice(strategy.symbol);
      const stepSize = await this.binance.getStepSize(strategy.symbol);
    const notional = strategy.positionSizeUsdt * strategy.leverage;
      const qty = (notional / price);
      const qtyStr = formatQty(qty, stepSize);

      this.logger.log(`[${strategy.symbol}] ${side} 주문 시도 qty:${qtyStr} price:${price}`);

      await this.binance.setLeverage(strategy.symbol, strategy.leverage);
      await this.binance.placeOrder({
        symbol: strategy.symbol,
        side,
        positionSide: 'BOTH',
        type: 'MARKET',
        quantity: qtyStr,
      });

      this.logger.log(`[${strategy.symbol}] ${side} 주문 완료`);
    } catch (e) {
      this.logger.error(`[${strategy.symbol}] 주문 실패`, e);
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
