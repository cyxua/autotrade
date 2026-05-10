import { Injectable, UnauthorizedException, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto, ChangePasswordDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService, private config: ConfigService) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      throw new HttpException({ code: 'ACCOUNT_LOCKED', message: '계정이 잠겼습니다. 15분 후 다시 시도하세요.' }, HttpStatus.LOCKED);
    }
    const valid = user && (await bcrypt.compare(dto.password, user.passwordHash));
    if (!valid) {
      if (user) {
        const failCount = user.loginFailCount + 1;
        await this.prisma.user.update({ where: { id: user.id }, data: { loginFailCount: failCount, lockedUntil: failCount >= 5 ? new Date(Date.now() + 15 * 60_000) : null } });
      }
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { loginFailCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
    return this.generateTokens(user.id, user.email);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException({ code: 'INVALID_CREDENTIALS', message: '현재 비밀번호가 틀립니다.' });
    const hash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } });
    return { message: '비밀번호가 변경되었습니다.' };
  }

  generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };
    return {
      accessToken: this.jwt.sign(payload, { secret: this.config.get('JWT_SECRET'), expiresIn: this.config.get('JWT_EXPIRES_IN') }),
      refreshToken: this.jwt.sign(payload, { secret: this.config.get('REFRESH_TOKEN_SECRET'), expiresIn: '7d' }),
    };
  }
}
