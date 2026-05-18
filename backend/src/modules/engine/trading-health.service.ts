import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BinanceService } from '../binance/binance.service';

const CRITICAL_REASONS = [
  'ENTRY_ORDER_UNPROTECTED', 'SL_ORDER_FAILED',
  'ENTRY_ORDER_STATUS_UNKNOWN', 'POSITION_STILL_OPEN', 'CLOSE_VERIFY_FAILED',
];

export interface TradingHealthFlags {
  isSafeToStartAutoTrade:  boolean;
  hasOpenPosition:         boolean;
  hasOpenOrders:           boolean;
  hasOpenAlgoOrders:       boolean;
  hasUnprotectedPosition:  boolean;
  hasCriticalRiskBlock:    boolean;
  criticalWindowMinutes:   number;
  scannedSymbols:          number;
  fetchErrors:             string[];
}

export interface TradingHealthResult {
  flags:          TradingHealthFlags;
  positions:      any[];
  openOrders:     any[];
  openAlgoOrders: any[];
}

function isValidSlAlgo(o: any, positionAmt: number): boolean {
  const orderType = o.orderType ?? o.type;
  if (orderType !== 'STOP_MARKET') return false;
  const cp = String(o.closePosition);
  if (cp !== 'true' && cp !== 'TRUE') return false;
  const valid = ['NEW', 'ACCEPTED', 'WORKING'];
  if (!valid.includes(o.algoStatus)) return false;
  if (positionAmt > 0 && o.side !== 'SELL') return false;
  if (positionAmt < 0 && o.side !== 'BUY')  return false;
  return true;
}

@Injectable()
export class TradingHealthService {
  private readonly logger = new Logger(TradingHealthService.name);

  constructor(
    private prisma:  PrismaService,
    private binance: BinanceService,
  ) {}

  async getTradingHealth(userId: string): Promise<TradingHealthResult> {
    const fetchErrors: string[] = [];

    // ── 1. 활성 전략 심볼 ────────────────────────────────────────────
    const [activeStrategies, recentBotOrders, recentRiskBlocks] = await Promise.all([
      this.prisma.strategy.findMany({
        where: { userId, enabled: true }, select: { symbol: true },
      }),
      this.prisma.order.findMany({
        where: { userId }, orderBy: { createdAt: 'desc' }, take: 20,
        select: { symbol: true },
      }),
      this.prisma.riskBlockLog.findMany({
        where: { userId }, orderBy: { createdAt: 'desc' }, take: 20,
        select: { symbol: true },
      }),
    ]);
    const strategySymbols  = activeStrategies.map(s => s.symbol);
    const botOrderSymbols  = recentBotOrders.map(o => o.symbol).filter(Boolean) as string[];
    const riskBlockSymbols = recentRiskBlocks.map(b => b.symbol).filter(Boolean) as string[];

    // ── 2. API Config 로드 ───────────────────────────────────────────
    let apiLoaded = false;
    try {
      await this.binance.loadApiConfig(userId);
      apiLoaded = true;
    } catch (e: any) {
      fetchErrors.push(`API_CONFIG_LOAD_FAILED: ${e.message}`);
    }

    // ── 3. Binance 포지션 ─────────────────────────────────────────────
    let positions:     any[]    = [];
    let positionSymbols: string[] = [];

    if (apiLoaded) {
      try {
        const raw = await this.binance.getPositionsStrict();
        positions = raw
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
        positionSymbols = positions.map(p => p.symbol);
      } catch (e: any) {
        fetchErrors.push(`POSITION_FETCH: ${e.message}`);
      }
    }

    // ── 4. allSymbols — 4종 합산 (포지션+전략+주문+리스크로그) ─────────
    const allSymbols = [...new Set([
      ...positionSymbols, ...strategySymbols,
      ...botOrderSymbols, ...riskBlockSymbols,
    ])];

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

    // ── 6. Algo 주문 — 4종 심볼 전체 커버 ────────────────────────────
    let openAlgoOrders: any[] = [];
    if (apiLoaded) {
      try {
        if (allSymbols.length > 0) {
          const results = await Promise.all(
            allSymbols.map(sym => this.binance.getOpenAlgoOrders(sym).catch(() => [])),
          );
          openAlgoOrders = results.flat().map((o: any) => ({
            symbol:        o.symbol,
            algoId:        o.algoId,
            clientAlgoId:  o.clientAlgoId,
            type:          o.orderType ?? o.type,
            side:          o.side,
            triggerPrice:  o.triggerPrice ?? o.stopPrice,
            algoStatus:    o.algoStatus,
            closePosition: o.closePosition,
          }));
        } else {
          const raw = await this.binance.getOpenAlgoOrders();
          openAlgoOrders = raw.map((o: any) => ({
            symbol:        o.symbol,
            algoId:        o.algoId,
            clientAlgoId:  o.clientAlgoId,
            type:          o.orderType ?? o.type,
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

    // ── 7. 치명 로그 — 1시간 이내 별도 쿼리 ─────────────────────────
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const criticalCount = await this.prisma.riskBlockLog.count({
      where: {
        userId,
        reason:    { in: CRITICAL_REASONS },
        createdAt: { gte: oneHourAgo },
      },
    });

    // ── 8. healthFlags 판단 ───────────────────────────────────────────
    const hasOpenPosition        = positions.length > 0;
    const hasOpenAlgoOrders      = openAlgoOrders.length > 0;
    const hasUnprotectedPosition = positions.some(pos => {
      const posAmt = parseFloat(pos.positionAmt);
      return !openAlgoOrders.some(o => o.symbol === pos.symbol && isValidSlAlgo(o, posAmt));
    });
    const hasCriticalRiskBlock = criticalCount > 0;

    const isSafeToStartAutoTrade =
      !hasOpenPosition &&
      openOrders.length === 0 &&
      !hasOpenAlgoOrders &&
      !hasCriticalRiskBlock &&
      fetchErrors.length === 0;

    this.logger.debug(
      `[${userId}] TradingHealth: safe=${isSafeToStartAutoTrade}` +
      ` pos=${hasOpenPosition} orders=${openOrders.length}` +
      ` algo=${hasOpenAlgoOrders} critical=${hasCriticalRiskBlock}` +
      ` scanned=${allSymbols.length}`,
    );

    return {
      flags: {
        isSafeToStartAutoTrade,
        hasOpenPosition,
        hasOpenOrders: openOrders.length > 0,
        hasOpenAlgoOrders,
        hasUnprotectedPosition,
        hasCriticalRiskBlock,
        criticalWindowMinutes: 60,
        scannedSymbols:        allSymbols.length,
        fetchErrors,
      },
      positions,
      openOrders,
      openAlgoOrders,
    };
  }
}
