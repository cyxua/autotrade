import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UserService implements OnModuleInit {
  private readonly logger = new Logger(UserService.name);
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    const count = await this.prisma.user.count();
    if (count === 0) {
      const hash = await bcrypt.hash('Admin1234!', 12);
      const user = await this.prisma.user.create({ data: { email: 'admin@example.com', passwordHash: hash } });
      await Promise.all([
        this.prisma.riskConfig.create({ data: { userId: user.id } }),
        this.prisma.scannerConfig.create({ data: { userId: user.id } }),
        this.prisma.notificationConfig.create({ data: { userId: user.id } }),
        this.prisma.engineState.create({ data: { userId: user.id } }),
      ]);
      this.logger.warn('초기 관리자 계정 생성됨 (admin@example.com / Admin1234!) — 반드시 비밀번호를 변경하세요!');
    }
  }

  findById(id: string) { return this.prisma.user.findUnique({ where: { id } }); }
}
