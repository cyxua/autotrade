import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(ctx: ExecutionContext) { return super.canActivate(ctx); }
  handleRequest(err: any, user: any) {
    if (err || !user) throw new UnauthorizedException({ code: 'TOKEN_EXPIRED', message: '인증이 필요합니다.' });
    return user;
  }
}
