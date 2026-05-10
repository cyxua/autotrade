import { Controller, Get, Post, Put, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiSettingsService } from './api-settings.service';
import { SaveApiConfigDto, ChangeModeDto } from './dto/api-config.dto';

@Controller('settings/api')
@UseGuards(JwtAuthGuard)
export class ApiSettingsController {
  constructor(private svc: ApiSettingsService) {}

  @Get()
  async get(@CurrentUser() u: any) { return { success: true, data: await this.svc.getConfig(u.id) }; }

  @Post()
  async save(@CurrentUser() u: any, @Body() dto: SaveApiConfigDto) { return { success: true, data: await this.svc.saveConfig(u.id, dto) }; }

  @Post('test')
  async test(@CurrentUser() u: any) { return { success: true, data: await this.svc.testConnection(u.id) }; }

  @Put('mode')
  async changeMode(@CurrentUser() u: any, @Body() dto: ChangeModeDto) { return { success: true, data: await this.svc.changeMode(u.id, dto) }; }
}
