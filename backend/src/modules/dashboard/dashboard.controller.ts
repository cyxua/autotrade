import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private prisma: PrismaService) {}

  @Get('summary')
  async summary(@CurrentUser() u: any) {
    const [engineState, strategies, positions] = await Promise.all([
      this.prisma.engineState.findUnique({ where: { userId: u.id } }),
      this.prisma.strategy.findMany({ where: { userId: u.id }, select: { id: true, enabled: true } }),
      this.prisma.position.findMany({ where: { userId: u.id, status: 'OPEN' } }),
    ]);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayOrders = await this.prisma.order.findMany({ where: { userId: u.id, status: 'FILLED', filledAt: { gte: today } } });
    const wins = todayOrders.filter(o => (o.realizedPnl ?? 0) > 0).length;
    return {
      success: true,
      data: {
        engine: { status: engineState?.status ?? 'STOPPED', tradingMode: 'TESTNET', dailyPnl: engineState?.dailyPnl ?? 0, dailyTrades: engineState?.dailyTrades ?? 0, consecLossCount: engineState?.consecLossCount ?? 0 },
        positions: { count: positions.length, totalUnrealizedPnl: positions.reduce((s, p) => s + (p.unrealizedPnl ?? 0), 0) },
        strategies: { total: strategies.length, enabled: strategies.filter(s => s.enabled).length },
        todayStats: { realizedPnl: todayOrders.reduce((s, o) => s + (o.realizedPnl ?? 0), 0), trades: todayOrders.length, winRate: todayOrders.length > 0 ? wins / todayOrders.length : 0 },
      },
    };
  }
}
