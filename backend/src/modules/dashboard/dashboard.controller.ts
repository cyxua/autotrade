import { Controller, Get, UseGuards } from '@nestjs/common';
import { TradingHealthService, TradingHealthFlags } from '../engine/trading-health.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(
    private prisma:         PrismaService,
    private tradingHealthSvc: TradingHealthService,
  ) {}

  @Get('summary')
  async summary(@CurrentUser() u: any) {
    const [engineState, strategies, positions, apiConfig] = await Promise.all([
      this.prisma.engineState.findUnique({ where: { userId: u.id } }),
      this.prisma.strategy.findMany({ where: { userId: u.id }, select: { id: true, enabled: true } }),
      this.prisma.position.findMany({ where: { userId: u.id, status: 'OPEN' } }),
      this.prisma.apiConfig.findUnique({ where: { userId: u.id }, select: { tradingMode: true } }),
    ]);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayOrders = await this.prisma.order.findMany({
      where: { userId: u.id, status: 'FILLED', filledAt: { gte: today } },
    });
    const wins = todayOrders.filter(o => (o.realizedPnl ?? 0) > 0).length;
    return {
      success: true,
      data: {
        engine: {
          status:          engineState?.status      ?? 'STOPPED',
          tradingMode:     apiConfig?.tradingMode   ?? 'TESTNET',
          dailyPnl:        engineState?.dailyPnl    ?? 0,
          dailyTrades:     engineState?.dailyTrades  ?? 0,
          consecLossCount: engineState?.consecLossCount ?? 0,
        },
        positions: {
          count:              positions.length,
          totalUnrealizedPnl: positions.reduce((s, p) => s + (p.unrealizedPnl ?? 0), 0),
        },
        strategies: {
          total:   strategies.length,
          enabled: strategies.filter(s => s.enabled).length,
        },
        todayStats: {
          realizedPnl: todayOrders.reduce((s, o) => s + (o.realizedPnl ?? 0), 0),
          trades:      todayOrders.length,
          winRate:     todayOrders.length > 0 ? wins / todayOrders.length : 0,
        },
      },
    };
  }

  @Get('trading-health')
  async tradingHealth(@CurrentUser() u: any) {
    // ── 공통 헬스 서비스 호출 ─────────────────────────────────────
    const health = await this.tradingHealthSvc.getTradingHealth(u.id);

    // ── 엔진 상태 (DB) ────────────────────────────────────────────
    const engineState = await this.prisma.engineState.findUnique({ where: { userId: u.id } });

    // ── DB 최근 주문 / 리스크 로그 (화면 표시용) ─────────────────
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const [recentBotOrders, recentRiskBlocks, criticalBlocks] = await Promise.all([
      this.prisma.order.findMany({
        where:   { userId: u.id },
        orderBy: { createdAt: 'desc' },
        take:    20,
        select:  {
          id: true, symbol: true, side: true, orderType: true,
          status: true, quantity: true, avgFillPrice: true,
          stopPrice: true, filledAt: true, exitReason: true, entryReason: true,
          binanceOrderId: true, createdAt: true,
        },
      }),
      this.prisma.riskBlockLog.findMany({
        where:   { userId: u.id },
        orderBy: { createdAt: 'desc' },
        take:    20,
        select:  { id: true, symbol: true, reason: true, detail: true, createdAt: true },
      }),
      this.prisma.riskBlockLog.findMany({
        where: {
          userId:    u.id,
          reason:    { in: ['ENTRY_ORDER_UNPROTECTED','SL_ORDER_FAILED','ENTRY_ORDER_STATUS_UNKNOWN','POSITION_STILL_OPEN','CLOSE_VERIFY_FAILED'] },
          createdAt: { gte: oneHourAgo },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, symbol: true, reason: true, detail: true, createdAt: true },
      }),
    ]);

    const flags: TradingHealthFlags & { criticalBlockReasons: { reason: string; symbol: string; createdAt: Date }[] } = {
      ...health.flags,
      criticalBlockReasons: criticalBlocks.slice(0, 5).map(b => ({
        reason:    b.reason,
        symbol:    b.symbol,
        createdAt: b.createdAt,
      })),
    } as any;

    return {
      success: true,
      data: {
        engineState: {
          status:          engineState?.status          ?? 'STOPPED',
          dailyTrades:     engineState?.dailyTrades      ?? 0,
          dailyPnl:        engineState?.dailyPnl         ?? 0,
          consecLossCount: engineState?.consecLossCount  ?? 0,
          stopReason:      engineState?.stopReason       ?? null,
        },
        currentPositions: health.positions,
        openOrders:       health.openOrders,
        openAlgoOrders:   health.openAlgoOrders,
        recentBotOrders,
        recentRiskBlocks,
        healthFlags:      flags,
      },
    };
  }
}