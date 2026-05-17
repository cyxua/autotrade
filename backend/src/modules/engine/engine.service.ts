import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BinanceService } from '../binance/binance.service';
import { StrategyEngineService } from './strategy-engine.service';

@Injectable()
export class EngineService {
  private readonly logger = new Logger(EngineService.name);

  constructor(
    private prisma:         PrismaService,
    private binance:        BinanceService,
    private strategyEngine: StrategyEngineService,
  ) {}

  async getStatus(userId: string) {
    const state  = await this.prisma.engineState.findFirst({ where: { userId } });
    const active = await this.prisma.strategy.count({ where: { userId, enabled: true } });
    return { state, activeStrategies: active };
  }

  async start(userId: string) {
    await this.binance.loadApiConfig(userId);
    const ok = await this.binance.ping();
    if (!ok) throw new BadRequestException({ code: 'API_CONNECTION_FAILED', message: 'Binance API 연결 실패' });
    const now = new Date();
    await this.prisma.engineState.upsert({
      where:  { userId },
      update: { status: 'RUNNING', startedAt: now, stoppedAt: null, stopReason: null },
      create: { userId, status: 'RUNNING', startedAt: now },
    });
    this.logger.log(`[${userId}] 자동매매 엔진 시작`);
    await this.strategyEngine.startEngine(userId);
    return { status: 'RUNNING', startedAt: now };
  }

  async stop(userId: string, reason = 'MANUAL') {
    await this.prisma.engineState.update({
      where: { userId },
      data:  { status: 'STOPPED', stoppedAt: new Date(), stopReason: reason },
    });
    this.strategyEngine.stopEngine(userId);
    this.logger.log(`[${userId}] 자동매매 엔진 중지`);
    return { status: 'STOPPED' };
  }

  async emergencyStop(userId: string, closePositions = false) {
    this.logger.warn(`[${userId}] 🚨 긴급 정지 실행`);
    await this.prisma.engineState.update({
      where: { userId },
      data:  { status: 'EMERGENCY_STOPPED', stoppedAt: new Date(), stopReason: 'EMERGENCY' },
    });
    this.strategyEngine.stopEngine(userId);

    const strategies = await this.prisma.strategy.findMany({
      where: { userId, enabled: true }, select: { symbol: true },
    });
    const strategySymbols = [...new Set(strategies.map(s => s.symbol))];

    // ── 항목 5: positionSymbols 조회 실패 명시적 기록 ────────────
    let cancelResult = { canceled: [] as string[], cancelErrors: [] as { symbol: string; error: string }[] };
    let canceledAlgoOrders = 0;
    try {
      let positionSymbols: string[] = [];
      try {
        const positions = await this.binance.getPositionsStrict();
        positionSymbols = positions
          .filter((p: any) => parseFloat(p.positionAmt) !== 0)
          .map((p: any) => p.symbol as string);
      } catch (e: any) {
        // 포지션 조회 실패를 cancelErrors에 명시적으로 기록
        cancelResult.cancelErrors.push({ symbol: '_POSITION_FETCH_', error: e.message });
        this.logger.error('긴급 정지 — 포지션 심볼 조회 실패 (전략 심볼만으로 취소 진행)', e.message);
      }
      const allSymbols = [...new Set([...strategySymbols, ...positionSymbols])];
      const result = await this.binance.cancelAllOrdersStrict(allSymbols);
      cancelResult.canceled      = result.canceled;
      cancelResult.cancelErrors  = [...cancelResult.cancelErrors, ...result.cancelErrors];

      // Algo 조건부 주문 취소 (TP/SL Algo Order)
      canceledAlgoOrders = 0;
      for (const sym of allSymbols) {
        try {
          await this.binance.cancelAllAlgoOrders(sym);
          canceledAlgoOrders++;
          this.logger.log(`[${sym}] Algo 주문 취소 완료`);
        } catch (e: any) {
          const algoErr = e.message ?? 'ALGO_CANCEL_FAILED';
          // Algo 주문이 없으면 에러가 날 수 있으므로 warn 수준
          this.logger.warn(`[${sym}] Algo 주문 취소 스킵: ${algoErr}`);
          if (!algoErr.includes('No algo order') && !algoErr.includes('-2011')) {
            cancelResult.cancelErrors.push({ symbol: sym, error: `ALGO: ${algoErr}` });
          }
        }
      }
    } catch (e: any) {
      cancelResult.cancelErrors.push({ symbol: '_CANCEL_ALL_', error: e.message });
      this.logger.error('주문 전체 취소 실패', e.message);
    }

    // 포지션 청산
    let closedPositions = 0;
    const closeErrors:   { symbol: string; error: string }[] = [];
    let positionFetchError: string | null = null;

    if (closePositions) {
      let positions: any[] = [];
      try {
        positions = await this.binance.getPositionsStrict();
      } catch (e: any) {
        positionFetchError = `POSITION_FETCH_FAILED: ${e.message}`;
        this.logger.error('긴급 정지 포지션 조회 실패 — 청산 불가', e.message);
      }

      for (const p of positions.filter((p: any) => parseFloat(p.positionAmt) !== 0)) {
        try {
          let filters: { stepSize: number };
          try {
            filters = await this.binance.getSymbolFilters(p.symbol);
          } catch (e: any) {
            closeErrors.push({ symbol: p.symbol, error: `SYMBOL_FILTER_FAILED: ${e.message}` });
            this.logger.error(`[${p.symbol}] stepSize 조회 실패 — 긴급 청산 스킵`);
            continue;
          }
          const posAmt    = parseFloat(p.positionAmt);
          const orderSide = posAmt > 0 ? 'SELL' : 'BUY';
          const precision = filters.stepSize < 1 ? (String(filters.stepSize).split('.')[1]?.length ?? 0) : 0;
          const qtyStr    = (Math.floor(Math.abs(posAmt) / filters.stepSize) * filters.stepSize).toFixed(precision);

          // ── 항목 6: reduceOnly 추가 (지원 안 하면 재시도) ────────
          try {
            await this.binance.placeOrder({
              symbol: p.symbol, side: orderSide, positionSide: 'BOTH',
              type: 'MARKET', quantity: qtyStr, reduceOnly: 'true',
            });
          } catch (reduceErr: any) {
            const code = reduceErr.message?.match(/code=(-?\d+)/)?.[1];
            if (code === '-4115' || code === '-2022') {
              // reduceOnly 미지원 — fallback 재시도
              this.logger.warn(`[${p.symbol}] reduceOnly 거절 (code ${code}), 재시도 without reduceOnly`);
              await this.binance.placeOrder({
                symbol: p.symbol, side: orderSide, positionSide: 'BOTH', type: 'MARKET', quantity: qtyStr,
              });
            } else {
              throw reduceErr;
            }
          }
          closedPositions++;
        } catch (e: any) {
          closeErrors.push({ symbol: p.symbol, error: e.message });
          this.logger.error(`[${p.symbol}] 긴급 청산 실패`, e.message);
        }
      }
    }

    return {
      status: 'EMERGENCY_STOPPED',
      canceledOrders:     cancelResult.canceled.length,
      canceledAlgoOrders: canceledAlgoOrders,
      cancelErrors:       cancelResult.cancelErrors,
      closedPositions,
      closeErrors,
      positionFetchError,
    };
  }

  async resetEmergencyStop(userId: string) {
    await this.prisma.engineState.upsert({
      where:  { userId },
      update: { status: 'STOPPED', stopReason: null },
      create: { userId, status: 'STOPPED' },
    });
    return { status: 'RESET' };
  }

  async closePosition(userId: string, symbol: string) {
    await this.binance.loadApiConfig(userId);
    const positions = await this.binance.getPositionsStrict();
    const pos = positions.find((p: any) => p.symbol === symbol && parseFloat(p.positionAmt) !== 0);
    if (!pos) return { status: 'NO_POSITION' };

    let filters: { stepSize: number };
    try {
      filters = await this.binance.getSymbolFilters(symbol);
    } catch (e: any) {
      throw new BadRequestException({
        code:    'SYMBOL_FILTER_FAILED',
        message: `${symbol} 심볼 필터 조회 실패 — 청산 중단: ${e.message}`,
      });
    }

    const posAmt    = parseFloat(pos.positionAmt);
    const side      = posAmt > 0 ? 'SELL' : 'BUY';
    const precision = filters.stepSize < 1 ? (String(filters.stepSize).split('.')[1]?.length ?? 0) : 0;
    const qtyStr    = (Math.floor(Math.abs(posAmt) / filters.stepSize) * filters.stepSize).toFixed(precision);

    // ── 항목 6: reduceOnly 추가 ───────────────────────────────────
    try {
      await this.binance.placeOrder({
        symbol, side, positionSide: 'BOTH', type: 'MARKET', quantity: qtyStr, reduceOnly: 'true',
      });
    } catch (reduceErr: any) {
      const code = reduceErr.message?.match(/code=(-?\d+)/)?.[1];
      if (code === '-4115' || code === '-2022') {
        this.logger.warn(`[${symbol}] reduceOnly 거절 (code ${code}), 재시도 without reduceOnly`);
        await this.binance.placeOrder({
          symbol, side, positionSide: 'BOTH', type: 'MARKET', quantity: qtyStr,
        });
      } else {
        throw new BadRequestException({ code: 'CLOSE_ORDER_FAILED', message: reduceErr.message });
      }
    }
    return { status: 'CLOSED', symbol, quantity: qtyStr };
  }
}
