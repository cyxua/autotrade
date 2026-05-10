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
    const { ok } = await this.binance.testConnection();
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
    if (closePositions) {
      try {
        const positions = await this.binance.getPositions();
        const open = positions.filter((p: any) => parseFloat(p.positionAmt) !== 0);
        for (const p of open) {
          const side = parseFloat(p.positionAmt) > 0 ? 'LONG' : 'SHORT';
          const orderSide = side === 'LONG' ? 'SELL' : 'BUY';
          await this.binance.placeOrder({ symbol: p.symbol, side: orderSide, positionSide: side, type: 'MARKET', quantity: Math.abs(parseFloat(p.positionAmt)).toString(), reduceOnly: true });
          closedPositions++;
        }
      } catch (e) { this.logger.error('포지션 청산 실패', e); }
    }
    return { status: 'EMERGENCY_STOPPED', canceledOrders, closedPositions };
  }
}
