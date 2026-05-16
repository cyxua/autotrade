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

    // 활성 전략 심볼 수집
    const strategies = await this.prisma.strategy.findMany({
      where: { userId, enabled: true }, select: { symbol: true },
    });
    const strategySymbols = [...new Set(strategies.map(s => s.symbol))];

    // cancelAllOrdersStrict: 전략 심볼 + 오픈 포지션 심볼
    let cancelResult = { canceled: [] as string[], cancelErrors: [] as { symbol: string; error: string }[] };
    try {
      // 오픈 포지션 심볼 추가
      let positionSymbols: string[] = [];
      try {
        const positions = await this.binance.getPositionsStrict();
        positionSymbols = positions
          .filter((p: any) => parseFloat(p.positionAmt) !== 0)
          .map((p: any) => p.symbol as string);
      } catch {}
      const allSymbols = [...new Set([...strategySymbols, ...positionSymbols])];
      cancelResult = await this.binance.cancelAllOrdersStrict(allSymbols);
    } catch (e: any) {
      this.logger.error('주문 취소 실패', e.message);
    }

    // 포지션 청산
    let closedPositions = 0;
    const closeErrors: { symbol: string; error: string }[] = [];
    let positionFetchError: string | null = null;

    if (closePositions) {
      let positions: any[] = [];
      try {
        positions = await this.binance.getPositionsStrict();
      } catch (e: any) {
        positionFetchError = `POSITION_FETCH_FAILED: ${e.message}`;
        this.logger.error('긴급 정지 포지션 조회 실패', e.message);
      }

      for (const p of positions.filter((p: any) => parseFloat(p.positionAmt) !== 0)) {
        try {
          // stepSize 조회 실패 시 청산 주문 생략
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
          const snapped   = Math.floor(Math.abs(posAmt) / filters.stepSize) * filters.stepSize;
          const qtyStr    = snapped.toFixed(precision);
          await this.binance.placeOrder({
            symbol: p.symbol, side: orderSide, positionSide: 'BOTH', type: 'MARKET', quantity: qtyStr,
          });
          closedPositions++;
        } catch (e: any) {
          closeErrors.push({ symbol: p.symbol, error: e.message });
          this.logger.error(`[${p.symbol}] 긴급 청산 실패`, e.message);
        }
      }
    }

    return {
      status: 'EMERGENCY_STOPPED',
      canceledOrders:   cancelResult.canceled.length,
      cancelErrors:     cancelResult.cancelErrors,
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

    // stepSize 조회 실패 시 청산 금지
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
    const snapped   = Math.floor(Math.abs(posAmt) / filters.stepSize) * filters.stepSize;
    const qtyStr    = snapped.toFixed(precision);

    await this.binance.placeOrder({ symbol, side, positionSide: 'BOTH', type: 'MARKET', quantity: qtyStr });
    return { status: 'CLOSED', symbol, quantity: qtyStr };
  }
}
