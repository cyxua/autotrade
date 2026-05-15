import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BinanceService } from '../binance/binance.service';
import { BadRequestException } from '@nestjs/common';
import { StrategyEngineService } from './strategy-engine.service';

@Injectable()
export class EngineService {
  private readonly logger = new Logger(EngineService.name);

  constructor(
    private prisma: PrismaService,
    private binance: BinanceService,
    private strategyEngine: StrategyEngineService,
  ) {}

  async getStatus(userId: string) {
    const state = await this.prisma.engineState.findFirst({ where: { userId } });
    const active = await this.prisma.strategy.count({ where: { userId, enabled: true } });
    return { state, activeStrategies: active };
  }

  async start(userId: string) {
    await this.binance.loadApiConfig(userId);
    const ok = await this.binance.ping();
    if (!ok) throw new BadRequestException({ code: 'API_CONNECTION_FAILED', message: 'Binance API 연결 실패' });
    const now = new Date();
    await this.prisma.engineState.upsert({
      where: { userId },
      update: { status: 'RUNNING', startedAt: now, stoppedAt: null, stopReason: null },
      create: { userId, status: 'RUNNING', startedAt: now },
    });
    this.logger.log(`[${userId}] 자동매매 엔진 시작`);
    await this.strategyEngine.startEngine(userId);
    return { status: 'RUNNING', startedAt: now };
  }

  async stop(userId: string, reason = 'MANUAL') {
    await this.prisma.engineState.update({ where: { userId }, data: { status: 'STOPPED', stoppedAt: new Date(), stopReason: reason } });
    this.strategyEngine.stopEngine(userId);
    this.logger.log(`[${userId}] 자동매매 엔진 중지`);
    return { status: 'STOPPED' };
  }

  async emergencyStop(userId: string, closePositions = false) {
    this.logger.warn(`[${userId}] 🚨 긴급 정지 실행`);
    await this.prisma.engineState.update({ where: { userId }, data: { status: 'EMERGENCY_STOPPED', stoppedAt: new Date(), stopReason: 'EMERGENCY' } });
    this.strategyEngine.stopEngine(userId);
    let canceledOrders = 0;
    try { await this.binance.cancelAllOrders(); canceledOrders = 1; } catch (e) { this.logger.error('주문 취소 실패', e); }
    let closedPositions = 0;
    let positionError: string | null = null;
    if (closePositions) {
      try {
        // ★ fix #5: getPositionsStrict — 실패 시 에러 반영
        const positions = await this.binance.getPositionsStrict();
        const open = positions.filter((p: any) => parseFloat(p.positionAmt) !== 0);
        for (const p of open) {
          try {
            const posAmt = parseFloat(p.positionAmt);
            const orderSide = posAmt > 0 ? 'SELL' : 'BUY';
            // ★ fix #6: stepSize 기반 수량 포맷
            let filters: { stepSize: number } = { stepSize: 1 };
            try { filters = await this.binance.getSymbolFilters(p.symbol); } catch {}
            const precision = filters.stepSize < 1 ? (String(filters.stepSize).split('.')[1]?.length ?? 0) : 0;
            const snapped   = Math.floor(Math.abs(posAmt) / filters.stepSize) * filters.stepSize;
            const qtyStr    = snapped.toFixed(precision);
            await this.binance.placeOrder({
              symbol: p.symbol, side: orderSide, positionSide: 'BOTH', type: 'MARKET', quantity: qtyStr,
            });
            closedPositions++;
          } catch (e: any) {
            this.logger.error(`[${p.symbol}] 긴급 청산 실패`, e.message);
          }
        }
      } catch (e: any) {
        // ★ fix #5: 포지션 조회 실패를 응답에 반영
        positionError = `POSITION_FETCH_FAILED: ${e.message}`;
        this.logger.error('긴급 정지 포지션 조회 실패', e.message);
      }
    }
    return { status: 'EMERGENCY_STOPPED', canceledOrders, closedPositions, positionError };
  }

  async resetEmergencyStop(userId: string) {
    await this.prisma.engineState.upsert({
      where: { userId },
      update: { status: 'STOPPED', stopReason: null },
      create: { userId, status: 'STOPPED' },
    });
    return { status: 'RESET' };
  }

  async closePosition(userId: string, symbol: string) {
    await this.binance.loadApiConfig(userId);
    // ★ fix #5: getPositionsStrict 사용
    const positions = await this.binance.getPositionsStrict();
    const pos = positions.find((p: any) => p.symbol === symbol && parseFloat(p.positionAmt) !== 0);
    if (!pos) return { status: 'NO_POSITION' };
    const posAmt = parseFloat(pos.positionAmt);
    const side   = posAmt > 0 ? 'SELL' : 'BUY';
    // ★ fix #6: stepSize 기반 수량 포맷
    let filters: { stepSize: number } = { stepSize: 1 };
    try { filters = await this.binance.getSymbolFilters(symbol); } catch {}
    const precision = filters.stepSize < 1 ? (String(filters.stepSize).split('.')[1]?.length ?? 0) : 0;
    const snapped   = Math.floor(Math.abs(posAmt) / filters.stepSize) * filters.stepSize;
    const qtyStr    = snapped.toFixed(precision);
    await this.binance.placeOrder({ symbol, side, positionSide: 'BOTH', type: 'MARKET', quantity: qtyStr });
    return { status: 'CLOSED', symbol, quantity: qtyStr };
  }
}
