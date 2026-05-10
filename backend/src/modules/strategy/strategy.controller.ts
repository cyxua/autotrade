import { Controller, Get, Post, Put, Delete, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { StrategyService } from './strategy.service';
import { CreateStrategyDto } from './dto/strategy.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('strategies')
@UseGuards(JwtAuthGuard)
export class StrategyController {
  constructor(private svc: StrategyService) {}

  @Get()
  async list(@CurrentUser() u: any, @Query('enabled') enabled?: string) {
    return { success: true, data: await this.svc.findAll(u.id, enabled === 'true') };
  }

  @Post()
  async create(@CurrentUser() u: any, @Body() dto: CreateStrategyDto) {
    return { success: true, data: await this.svc.create(u.id, dto) };
  }

  @Get(':id')
  async get(@CurrentUser() u: any, @Param('id') id: string) {
    return { success: true, data: await this.svc.findOne(u.id, id) };
  }

  @Put(':id')
  async update(@CurrentUser() u: any, @Param('id') id: string, @Body() dto: CreateStrategyDto) {
    return { success: true, data: await this.svc.update(u.id, id, dto) };
  }

  @Delete(':id')
  async delete(@CurrentUser() u: any, @Param('id') id: string) {
    await this.svc.delete(u.id, id); return { success: true };
  }

  @Patch(':id/toggle')
  async toggle(@CurrentUser() u: any, @Param('id') id: string) {
    return { success: true, data: await this.svc.toggle(u.id, id) };
  }
}
