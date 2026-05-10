import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { FuturesService } from './futures.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('futures')
export class FuturesController {
  constructor(private svc: FuturesService) {}

  // 공개 API (인증 불필요)
  @Get('symbols')
  async symbols() {
    return { success: true, data: await this.svc.getSymbols() };
  }

  @Get('tickers')
  async tickers() {
    return { success: true, data: await this.svc.getTickers() };
  }

  @Get('klines')
  async klines(
    @Query('symbol') symbol: string,
    @Query('interval') interval: string = '15m',
    @Query('limit') limit: string = '500',
  ) {
    return { success: true, data: await this.svc.getKlines(symbol, interval, parseInt(limit)) };
  }

  @Get('price')
  async price(@Query('symbol') symbol: string) {
    return { success: true, data: await this.svc.getPrice(symbol) };
  }

  // 인증 필요 API
  @Get('balance')
  @UseGuards(JwtAuthGuard)
  async balance(@CurrentUser() u: any) {
    return { success: true, data: await this.svc.getBalance(u.id) };
  }

  @Get('account')
  @UseGuards(JwtAuthGuard)
  async account(@CurrentUser() u: any) {
    return { success: true, data: await this.svc.getAccount(u.id) };
  }

  @Get('positions')
  @UseGuards(JwtAuthGuard)
  async positions(@CurrentUser() u: any) {
    return { success: true, data: await this.svc.getPositions(u.id) };
  }

  @Get('orders')
  @UseGuards(JwtAuthGuard)
  async orders(
    @CurrentUser() u: any,
    @Query('symbol') symbol: string,
    @Query('limit') limit: string = '20',
  ) {
    if (!symbol) {
      const botOrders = await this.svc.getBotOrders(u.id, parseInt(limit));
      return { success: true, data: botOrders, source: 'db' };
    }
    try {
      const data = await this.svc.getOrders(u.id, symbol, parseInt(limit));
      return { success: true, data, source: 'binance' };
    } catch {
      const botOrders = await this.svc.getBotOrders(u.id, parseInt(limit));
      return { success: true, data: botOrders, source: 'db' };
    }
  }
}
