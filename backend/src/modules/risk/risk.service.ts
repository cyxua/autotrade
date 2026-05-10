import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RiskService {
  constructor(private prisma: PrismaService) {}

  getConfig(userId: string) { return this.prisma.riskConfig.findUnique({ where: { userId } }); }

  updateConfig(userId: string, data: any) {
    return this.prisma.riskConfig.upsert({ where: { userId }, update: data, create: { userId, ...data } });
  }

  async getBlockLogs(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.riskBlockLog.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      this.prisma.riskBlockLog.count({ where: { userId } }),
    ]);
    return { items, total, page, limit };
  }

  logBlock(userId: string, strategyId: string | null, symbol: string, reason: string, detail?: any) {
    return this.prisma.riskBlockLog.create({ data: { userId, strategyId, symbol, reason, detail } });
  }

  resetDailyStats(userId: string) {
    return this.prisma.engineState.update({ where: { userId }, data: { dailyPnl: 0, dailyTrades: 0, dailyLossDate: new Date() } });
  }

  resetConsecLoss(userId: string) {
    return this.prisma.engineState.update({ where: { userId }, data: { consecLossCount: 0 } });
  }
}
