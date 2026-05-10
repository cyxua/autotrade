import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateStrategyDto } from './dto/strategy.dto';

@Injectable()
export class StrategyService {
  constructor(private prisma: PrismaService) {}

  findAll(userId: string, enabledOnly?: boolean) {
    return this.prisma.strategy.findMany({
      where: { userId, ...(enabledOnly ? { enabled: true } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const s = await this.prisma.strategy.findFirst({ where: { id, userId } });
    if (!s) throw new NotFoundException('전략을 찾을 수 없습니다.');
    return s;
  }

  create(userId: string, dto: CreateStrategyDto) {
    return this.prisma.strategy.create({
      data: { ...dto, userId, params: dto.params ?? {} } as any,
    });
  }

  async update(userId: string, id: string, dto: CreateStrategyDto) {
    await this.findOne(userId, id);
    return this.prisma.strategy.update({
      where: { id },
      data: { ...dto, params: dto.params ?? {} } as any,
    });
  }

  async delete(userId: string, id: string) {
    const s = await this.findOne(userId, id);
    if (s.enabled) throw new ConflictException('활성화된 전략은 삭제할 수 없습니다.');
    return this.prisma.strategy.delete({ where: { id } });
  }

  async toggle(userId: string, id: string) {
    const s = await this.findOne(userId, id);
    const updated = await this.prisma.strategy.update({
      where: { id },
      data: { enabled: !s.enabled },
    });
    return { enabled: updated.enabled };
  }
}
