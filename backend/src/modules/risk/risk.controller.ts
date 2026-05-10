import { Controller, Get, Put, Post, Body, Query, UseGuards } from '@nestjs/common';
import { RiskService } from './risk.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('settings/risk')
@UseGuards(JwtAuthGuard)
export class RiskController {
  constructor(private svc: RiskService) {}

  @Get() async get(@CurrentUser() u: any) { return { success: true, data: await this.svc.getConfig(u.id) }; }
  @Put() async update(@CurrentUser() u: any, @Body() body: any) { return { success: true, data: await this.svc.updateConfig(u.id, body) }; }
  @Get('block-logs') async logs(@CurrentUser() u: any, @Query('page') p = '1', @Query('limit') l = '20') {
    return { success: true, data: await this.svc.getBlockLogs(u.id, +p, +l) };
  }
  @Post('reset-daily') async resetDaily(@CurrentUser() u: any) { return { success: true, data: await this.svc.resetDailyStats(u.id) }; }
  @Post('reset-consec-loss') async resetConsec(@CurrentUser() u: any) { return { success: true, data: await this.svc.resetConsecLoss(u.id) }; }
}
