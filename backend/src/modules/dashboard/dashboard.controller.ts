import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { BinanceService } from '../binance/binance.service';

const CRITICAL_REASONS = new Set([
  'ENTRY_ORDER_UNPROTECTED', 'SL_ORDER_FAILED',
  'ENTRY_ORDER_STATUS_UNKNOWN', 'POSITION_STILL_OPEN', 'CLOSE_VERIFY_FAILED',
]);

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(
    private prisma:   PrismaService,
    private binance:  BinanceService,
  ) {}

  @Get('summary')
  async summary(@CurrentUser() u: any) {
    const [engineState, strategies, positions, apiConfig] = await Promise.all([
      this.prisma.engineState.findUnique({ where: { userId: u.id } }),
      this.prisma.strategy.findMany({ where: { userId: u.id }, select: { id: true, enabled: true } }),
      this.prisma.position.findMany({ where: { userId: u.id, status: 'OPEN' } }),
      this.prisma.apiConfig.findUnique({ where: { userId: u.id }, select: { tradingMode: true } }),
    ]);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayOrders = await this.prisma.order.findMany({ where: { userId: u.id, status: 'FILLED', filledAt: { gte: today } } });
    const wins = todayOrders.filter(o => (o.realizedPnl ?? 0) > 0).length;
    return {
      success: true,
      data: {
        engine: { status: engineState?.status ?? 'STOPPED', tradingMode: apiConfig?.tradingMode ?? 'TESTNET', dailyPnl: engineState?.dailyPnl ?? 0, dailyTrades: engineState?.dailyTrades ?? 0, consecLossCount: engineState?.consecLossCount ?? 0 },
        positions: { count: positions.length, totalUnrealizedPnl: positions.reduce((s, p) => s + (p.unrealizedPnl ?? 0), 0) },
        strategies: { total: strategies.length, enabled: strategies.filter(s => s.enabled).length },
        todayStats: { realizedPnl: todayOrders.reduce((s, o) => s + (o.realizedPnl ?? 0), 0), trades: todayOrders.length, winRate: todayOrders.length > 0 ? wins / todayOrders.length : 0 },
      },
    };
  }

  @Get('trading-health')
  async tradingHealth(@CurrentUser() u: any) {
    const errors: string[] = [];

    // 1. 엔진 상태
    const engineState = await this.prisma.engineState.findUnique({ where: { userId: u.id } });

    // 2. Binance 포지션 (실시간)
    let currentPositions: any[] = [];
    try {
      await this.binance.loadApiConfig(u.id);
      const raw = await this.binance.getPositionsStrict();
      currentPositions = raw
        .filter((p: any) => parseFloat(p.positionAmt) !== 0)
        .map((p: any) => ({
          symbol:           p.symbol,
          positionAmt:      p.positionAmt,
          entryPrice:       p.entryPrice,
          markPrice:        p.markPrice,
          unrealizedProfit: p.unRealizedProfit ?? p.unrealizedProfit ?? '0',
          liquidationPrice: p.liquidationPrice,
          leverage:         p.leverage,
          marginType:       p.marginType,
        }));
    } catch (e: any) {
      errors.push(`POSITION_FETCH: ${e.message}`);
    }

    // 3. 일반 미체결 주문 (Binance)
    let openOrders: any[] = [];
    try {
      const raw = await this.binance.getOpenOrders();
      openOrders = raw.map((o: any) => ({
        symbol:   o.symbol,
        orderId:  o.orderId,
        type:     o.type,
        side:     o.side,
        price:    o.price,
        quantity: o.origQty,
        status:   o.status,
      }));
    } catch (e: any) {
      errors.push(`OPEN_ORDERS_FETCH: ${e.message}`);
    }

    // 4. Algo 미체결 주문 (TP/SL)
    let openAlgoOrders: any[] = [];
    try {
      const raw = await this.binance.getOpenAlgoOrders();
      openAlgoOrders = raw.map((o: any) => ({
        symbol:        o.symbol,
        algoId:        o.algoId,
        clientAlgoId:  o.clientAlgoId,
        type:          o.type,
        side:          o.side,
        triggerPrice:  o.triggerPrice ?? o.stopPrice,
        algoStatus:    o.algoStatus,
        closePosition: o.closePosition,
      }));
    } catch (e: any) {
      errors.push(`ALGO_ORDERS_FETCH: ${e.message}`);
    }

    // 5. DB 최근 주문 20개
    const recentBotOrders = await this.prisma.order.findMany({
      where:   { userId: u.id },
      orderBy: { createdAt: 'desc' },
      take:    20,
      select:  {
        id: true, symbol: true, side: true, orderType: true,
        status: true, quantity: true, avgFillPrice: true,
        stopPrice: true, filledAt: true, exitReason: true, entryReason: true,
        binanceOrderId: true, createdAt: true,
      },
    });

    // 6. 최근 리스크 로그 20개
    const recentRiskBlocks = await this.prisma.riskBlockLog.findMany({
      where:   { userId: u.id },
      orderBy: { createdAt: 'desc' },
      take:    20,
      select:  { id: true, symbol: true, reason: true, detail: true, createdAt: true },
    });

    // 7. healthFlags 판단
    const slAlgoSymbols = new Set(
      openAlgoOrders.filter(o => o.type === 'STOP_MARKET').map(o => o.symbol),
    );
    const hasOpenPosition   = currentPositions.length > 0;
    const hasOpenAlgoOrders = openAlgoOrders.length > 0;

    // 미보호 포지션: 포지션이 있는데 해당 심볼의 SL Algo 주문 없음
    const unprotectedPositions = currentPositions.filter(p => !slAlgoSymbols.has(p.symbol));
    const hasUnprotectedPosition = unprotectedPositions.length > 0;

    // 치명 로그: 최근 5개 내에 critical reason 포함
    const criticalBlocks = recentRiskBlocks.filter(b => CRITICAL_REASONS.has(b.reason));
    const hasCriticalRiskBlock = criticalBlocks.length > 0;

    const isSafeToStartAutoTrade =
      !hasOpenPosition &&
      openOrders.length === 0 &&
      !hasOpenAlgoOrders &&
      !hasCriticalRiskBlock &&
      errors.length === 0;

    return {
      success: true,
      data: {
        engineState: {
          status:          engineState?.status      ?? 'STOPPED',
          dailyTrades:     engineState?.dailyTrades  ?? 0,
          dailyPnl:        engineState?.dailyPnl     ?? 0,
          consecLossCount: engineState?.consecLossCount ?? 0,
          stopReason:      engineState?.stopReason   ?? null,
        },
        currentPositions,
        openOrders,
        openAlgoOrders,
        recentBotOrders,
        recentRiskBlocks,
        healthFlags: {
          hasOpenPosition,
          hasOpenAlgoOrders,
          hasUnprotectedPosition,
          unprotectedPositions:  unprotectedPositions.map(p => p.symbol),
          hasCriticalRiskBlock,
          criticalBlockReasons:  criticalBlocks.slice(0, 5).map(b => ({ reason: b.reason, symbol: b.symbol, createdAt: b.createdAt })),
          isSafeToStartAutoTrade,
          fetchErrors: errors,
        },
      },
    };
  }
}
