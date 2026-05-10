import { Controller, Post, Get, Put, Body, Res, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, ChangePasswordDto } from './dto/login.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

const COOKIE_OPT = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: any) {
    const { accessToken, refreshToken } = await this.auth.login(dto);
    res.cookie('access_token', accessToken, { ...COOKIE_OPT, maxAge: 86400_000 });
    res.cookie('refresh_token', refreshToken, { ...COOKIE_OPT, maxAge: 7 * 86400_000 });
    return { success: true, data: { expiresIn: 86400 } };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: any) {
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    return { success: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: any) {
    return { success: true, data: user };
  }

  @Put('password')
  @UseGuards(JwtAuthGuard)
  async changePassword(@CurrentUser() user: any, @Body() dto: ChangePasswordDto) {
    const data = await this.auth.changePassword(user.id, dto);
    return { success: true, data };
  }
}
