import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { BinanceService } from '../binance/binance.service';

const CRITICAL_REASONS = new Set([
  'ENTRY_ORDER_UNPROTECTED', 'SL_ORDER_FAILED',
  'ENTRY_ORDER_STATUS_UNKNOWN', 'POSITION_STILL_OPEN', 'CLOSE_VERIFY_FAILED',
]);

// 미보호 포지션: SL Algo 조건 엄격 검사
function isValidSlAlgo(o: any, positionAmt: number): boolean {
  const orderType = o.orderType ?? o.type;
  if (orderType !== 'STOP_MARKET') return false;
  const cp = String(o.closePosition);
  if (cp !== 'true' && cp !== 'TRUE') return false;
  const validStatus = ['NEW', 'ACCEPTED', 'WORKING'];
  if (!validStatus.includes(o.algoStatus)) return false;
  if (positionAmt > 0 && o.side !== 'SELL') return false;
  if (positionAmt < 0 && o.side !== 'BUY')  return false;
  return true;
}

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(
    private prisma:  PrismaService,
    private binance: BinanceService,
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
    const todayOrders = await this.prisma.order.findMany({
      where: { userId: u.id, status: 'FILLED', filledAt: { gte: today } },
    });
    const wins = todayOrders.filter(o => (o.realizedPnl ?? 0) > 0).length;
    return {
      success: true,
      data: {
        engine: {
          status:          engineState?.status      ?? 'STOPPED',
          tradingMode:     apiConfig?.tradingMode   ?? 'TESTNET',
          dailyPnl:        engineState?.dailyPnl    ?? 0,
          dailyTrades:     engineState?.dailyTrades  ?? 0,
          consecLossCount: engineState?.consecLossCount ?? 0,
        },
        positions: {
          count:              positions.length,
          totalUnrealizedPnl: positions.reduce((s, p) => s + (p.unrealizedPnl ?? 0), 0),
        },
        strategies: {
          total:   strategies.length,
          enabled: strategies.filter(s => s.enabled).length,
        },
        todayStats: {
          realizedPnl: todayOrders.reduce((s, o) => s + (o.realizedPnl ?? 0), 0),
          trades:      todayOrders.length,
          winRate:     todayOrders.length > 0 ? wins / todayOrders.length : 0,
        },
      },
    };
  }

  @Get('trading-health')
  async tradingHealth(@CurrentUser() u: any) {
    const fetchErrors: string[] = [];

    // ── 1. 엔진 상태 ─────────────────────────────────────────────────
    const engineState = await this.prisma.engineState.findUnique({ where: { userId: u.id } });

    // ── 2. loadApiConfig 실패 시 Binance 조회 중단 ───────────────────
    let apiLoaded = false;
    try {
      await this.binance.loadApiConfig(u.id);
      apiLoaded = true;
    } catch (e: any) {
      fetchErrors.push(`API_CONFIG_LOAD_FAILED: ${e.message}`);
    }

    // ── 3. 활성 전략 심볼 수집 ────────────────────────────────────────
    const activeStrategies = await this.prisma.strategy.findMany({
      where: { userId: u.id, enabled: true }, select: { symbol: true },
    });
    const strategySymbols = [...new Set(activeStrategies.map(s => s.symbol))];

    // ── 4. Binance 실시간 포지션 ──────────────────────────────────────
    let currentPositions: any[] = [];
    let positionSymbols: string[] = [];

    if (apiLoaded) {
      try {
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
        positionSymbols = currentPositions.map(p => p.symbol);
      } catch (e: any) {
        fetchErrors.push(`POSITION_FETCH: ${e.message}`);
      }
    }

    // 조회 대상 심볼 = 포지션 심볼 + 전략 심볼 (중복 제거)
    const allSymbols = [...new Set([...positionSymbols, ...strategySymbols])];

    // ── 5. 일반 미체결 주문 ───────────────────────────────────────────
    let openOrders: any[] = [];
    if (apiLoaded) {
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
        fetchErrors.push(`OPEN_ORDERS_FETCH: ${e.message}`);
      }
    }

    // ── 6. Algo 주문 — 심볼별 조회로 weight 절감 ──────────────────────
    // symbol 없이 전체 조회하면 Binance weight가 크므로,
    // 포지션+전략 심볼 기준으로 symbol별 조회 (심볼 없으면 전체 1회만 허용)
    let openAlgoOrders: any[] = [];
    if (apiLoaded) {
      try {
        if (allSymbols.length > 0) {
          const results = await Promise.all(
            allSymbols.map(sym =>
              this.binance.getOpenAlgoOrders(sym).catch(() => []),
            ),
          );
          openAlgoOrders = results.flat().map((o: any) => ({
            symbol:        o.symbol,
            algoId:        o.algoId,
            clientAlgoId:  o.clientAlgoId,
            type:          o.orderType ?? o.type,   // Binance 응답은 orderType 사용
            side:          o.side,
            triggerPrice:  o.triggerPrice ?? o.stopPrice,
            algoStatus:    o.algoStatus,
            closePosition: o.closePosition,
          }));
        } else {
          // 심볼 없으면 전체 1회 조회 (포지션도 없고 전략도 없는 경우)
          const raw = await this.binance.getOpenAlgoOrders();
          openAlgoOrders = raw.map((o: any) => ({
            symbol:        o.symbol,
            algoId:        o.algoId,
            clientAlgoId:  o.clientAlgoId,
            type:          o.orderType ?? o.type,   // Binance 응답은 orderType 사용
            side:          o.side,
            triggerPrice:  o.triggerPrice ?? o.stopPrice,
            algoStatus:    o.algoStatus,
            closePosition: o.closePosition,
          }));
        }
      } catch (e: any) {
        fetchErrors.push(`ALGO_ORDERS_FETCH: ${e.message}`);
      }
    }

    // ── 7. DB 최근 주문 ───────────────────────────────────────────────
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

    // ── 8. 치명 리스크 로그 — 1시간 이내만 ───────────────────────────
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentRiskBlocks = await this.prisma.riskBlockLog.findMany({
      where:   { userId: u.id },
      orderBy: { createdAt: 'desc' },
      take:    20,
      select:  { id: true, symbol: true, reason: true, detail: true, createdAt: true },
    });
    const criticalBlocks = recentRiskBlocks.filter(
      b => CRITICAL_REASONS.has(b.reason) && b.createdAt >= oneHourAgo,
    );

    // ── 9. healthFlags ────────────────────────────────────────────────
    // 미보호 포지션: 엄격 SL Algo 검사 (type, closePosition, algoStatus, side)
    const unprotectedPositions = currentPositions.filter(pos => {
      const posAmt = parseFloat(pos.positionAmt);
      const validSl = openAlgoOrders.some(
        o => o.symbol === pos.symbol && isValidSlAlgo(o, posAmt),
      );
      return !validSl;
    });

    const hasOpenPosition        = currentPositions.length > 0;
    const hasOpenAlgoOrders      = openAlgoOrders.length > 0;
    const hasUnprotectedPosition = unprotectedPositions.length > 0;
    const hasCriticalRiskBlock   = criticalBlocks.length > 0;

    const isSafeToStartAutoTrade =
      !hasOpenPosition &&
      openOrders.length === 0 &&
      !hasOpenAlgoOrders &&
      !hasCriticalRiskBlock &&
      fetchErrors.length === 0;

    return {
      success: true,
      data: {
        engineState: {
          status:          engineState?.status          ?? 'STOPPED',
          dailyTrades:     engineState?.dailyTrades      ?? 0,
          dailyPnl:        engineState?.dailyPnl         ?? 0,
          consecLossCount: engineState?.consecLossCount  ?? 0,
          stopReason:      engineState?.stopReason       ?? null,
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
          unprotectedPositions: unprotectedPositions.map(p => p.symbol),
          hasCriticalRiskBlock,
          criticalBlockReasons: criticalBlocks.slice(0, 5).map(b => ({
            reason:    b.reason,
            symbol:    b.symbol,
            createdAt: b.createdAt,
          })),
          criticalWindowMinutes: 60,   // 판단 기준 시간 (분)
          isSafeToStartAutoTrade,
          fetchErrors,
        },
      },
    };
  }
}
