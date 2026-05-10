import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrderController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() u: any, @Query('page') page = '1', @Query('limit') limit = '20', @Query('symbol') symbol?: string, @Query('status') status?: string) {
    const skip = (+page - 1) * +limit;
    const where: any = { userId: u.id };
    if (symbol) where.symbol = symbol;
    if (status) where.status = status;
    const [items, total] = await Promise.all([
      this.prisma.order.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: +limit, include: { strategy: { select: { name: true } } } }),
      this.prisma.order.count({ where }),
    ]);
    return { success: true, data: { items, total, page: +page, limit: +limit, totalPages: Math.ceil(total / +limit) } };
  }
}
