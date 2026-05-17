import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { EngineService } from './engine.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('engine')
@UseGuards(JwtAuthGuard)
export class EngineController {
  constructor(private engine: EngineService) {}

  @Get('status') async getStatus(@CurrentUser() u: any) { return { success: true, data: await this.engine.getStatus(u.id) }; }
  @Post('start') async start(@CurrentUser() u: any) { return { success: true, data: await this.engine.start(u.id) }; }
  @Post('stop') async stop(@CurrentUser() u: any) { return { success: true, data: await this.engine.stop(u.id) }; }
  @Post('emergency-stop') async emergencyStop(@CurrentUser() u: any, @Body() body: any) {
    return { success: true, data: await this.engine.emergencyStop(u.id, body.closePositions ?? true) };
  }

  @Post('reset-emergency')
  async resetEmergency(@CurrentUser() u: any) {
    return { success: true, data: await this.engine.resetEmergencyStop(u.id) };
  }

  @Post('close-position')
  async closePosition(@CurrentUser() u: any, @Body() body: any) {
    return { success: true, data: await this.engine.closePosition(u.id, body.symbol) };
  }
}
