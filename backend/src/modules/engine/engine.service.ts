import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BinanceService } from '../binance/binance.service';
import { StrategyEngineService } from './strategy-engine.service';

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

@Injectable()
export class EngineService {
  private readonly logger = new Logger(EngineService.name);

  constructor(
    private prisma:         PrismaService,
    private binance:        BinanceService,
    private strategyEngine: StrategyEngineService,
  ) {}

  async getStatus(userId: string) {
    const state  = await this.prisma.engineState.findFirst({ where: { userId } });
    const active = await this.prisma.strategy.count({ where: { userId, enabled: true } });
    return { state, activeStrategies: active };
  }

  async start(userId: string) {
    await this.binance.loadApiConfig(userId);
    const ok = await this.binance.ping();
    if (!ok) throw new BadRequestException({ code: 'API_CONNECTION_FAILED', message: 'Binance API 연결 실패' });
    const now = new Date();
    await this.prisma.engineState.upsert({
      where:  { userId },
      update: { status: 'RUNNING', startedAt: now, stoppedAt: null, stopReason: null },
      create: { userId, status: 'RUNNING', startedAt: now },
    });
    this.logger.log(`[${userId}] 자동매매 엔진 시작`);
    await this.strategyEngine.startEngine(userId);
    return { status: 'RUNNING', startedAt: now };
  }

  async stop(userId: string, reason = 'MANUAL') {
    await this.prisma.engineState.update({
      where: { userId },
      data:  { status: 'STOPPED', stoppedAt: new Date(), stopReason: reason },
    });
    this.strategyEngine.stopEngine(userId);
    this.logger.log(`[${userId}] 자동매매 엔진 중지`);
    return { status: 'STOPPED' };
  }

  async emergencyStop(userId: string, closePositions = true) {
    this.logger.warn(`[${userId}] 🚨 긴급 정지 실행 (closePositions: ${closePositions})`);

    // ── 1. 엔진 즉시 정지 ───────────────────────────────────────────
    await this.prisma.engineState.update({
      where: { userId },
      data:  { status: 'EMERGENCY_STOPPED', stoppedAt: new Date(), stopReason: 'EMERGENCY' },
    });
    this.strategyEngine.stopEngine(userId);

    // ── 2. 전략 심볼 수집 ────────────────────────────────────────────
    const strategies = await this.prisma.strategy.findMany({
      where: { userId, enabled: true }, select: { symbol: true },
    });
    const strategySymbols = [...new Set(strategies.map(s => s.symbol))];

    // ── 3. 최신 포지션 조회 (캐시 X) ────────────────────────────────
    let livePositions: any[] = [];
    let positionFetchError: string | null = null;
    let positionSymbols: string[] = [];

    try {
      livePositions  = await this.binance.getPositionsStrict();
      positionSymbols = livePositions
        .filter((p: any) => parseFloat(p.positionAmt) !== 0)
        .map((p: any) => p.symbol as string);
    } catch (e: any) {
      positionFetchError = `POSITION_FETCH_FAILED: ${e.message}`;
      this.logger.error('긴급 정지 — 포지션 조회 실패', e.message);
    }

    const allSymbols = [...new Set([...strategySymbols, ...positionSymbols])];

    // ── 4. 일반 미체결 주문 취소 ─────────────────────────────────────
    let canceledNormalOrders = 0;
    const cancelErrors: { symbol: string; error: string }[] = [];

    for (const sym of allSymbols) {
      try {
        await this.binance.cancelAllOrdersStrict([sym]);
        canceledNormalOrders++;
      } catch (e: any) {
        cancelErrors.push({ symbol: sym, error: e.message });
        this.logger.error(`[${sym}] 일반 주문 취소 실패: ${e.message}`);
      }
    }

    // ── 5. Algo TP/SL 주문 취소 ──────────────────────────────────────
    let canceledAlgoOrders = 0;
    for (const sym of allSymbols) {
      try {
        await this.binance.cancelAllAlgoOrders(sym);
        canceledAlgoOrders++;
        this.logger.log(`[${sym}] Algo 주문 취소 완료`);
      } catch (e: any) {
        const msg = e.message ?? '';
        this.logger.warn(`[${sym}] Algo 주문 취소 스킵: ${msg}`);
        if (!msg.includes('No algo order') && !msg.includes('-2011')) {
          cancelErrors.push({ symbol: sym, error: `ALGO: ${msg}` });
        }
      }
    }

    // ── 6. 포지션 시장가 청산 ────────────────────────────────────────
    const openPositions = livePositions.filter((p: any) => parseFloat(p.positionAmt) !== 0);
    const positionsFound = openPositions.length;
    let closeAttempts = 0;
    let closeSuccess  = 0;
    const closeErrors: {
      symbol: string; reason: string; message?: string; posAmt?: string; qty?: string;
    }[] = [];

    if (closePositions && openPositions.length > 0) {
      for (const p of openPositions) {
        const sym    = p.symbol as string;
        const posAmt = parseFloat(p.positionAmt);

        // stepSize 조회 실패 시 청산 생략
        let filters: { stepSize: number };
        try {
          filters = await this.binance.getSymbolFilters(sym);
        } catch (e: any) {
          closeErrors.push({ symbol: sym, reason: 'SYMBOL_FILTER_FAILED', message: e.message, posAmt: String(posAmt) });
          this.logger.error(`[${sym}] stepSize 조회 실패 — 긴급 청산 스킵`);
          continue;
        }

        const side      = posAmt > 0 ? 'SELL' : 'BUY';
        const precision = filters.stepSize < 1 ? (String(filters.stepSize).split('.')[1]?.length ?? 0) : 0;
        const qtyStr    = (Math.floor(Math.abs(posAmt) / filters.stepSize) * filters.stepSize).toFixed(precision);

        if (Number(qtyStr) <= 0) {
          closeErrors.push({ symbol: sym, reason: 'CLOSE_QTY_ZERO', posAmt: String(posAmt), qty: qtyStr });
          this.logger.error(`[${sym}] 청산 수량 0 — 스킵`);
          continue;
        }

        closeAttempts++;
        try {
          // reduceOnly=true 시도 (포지션 역방향 신규 진입 방지)
          await this.binance.placeOrder({
            symbol: sym, side, positionSide: 'BOTH', type: 'MARKET', quantity: qtyStr, reduceOnly: 'true',
          });
          this.logger.log(`[${sym}] 청산 주문 전송 — side:${side} qty:${qtyStr}`);

          // 1.5초 대기 후 포지션 재확인
          await sleep(1500);
          try {
            const verify    = await this.binance.getPositionsStrict();
            const stillOpen = verify.find(
              (v: any) => v.symbol === sym && parseFloat(v.positionAmt) !== 0,
            );
            if (stillOpen) {
              closeErrors.push({
                symbol: sym, reason: 'POSITION_STILL_OPEN',
                posAmt: String(stillOpen.positionAmt), qty: qtyStr,
              });
              this.logger.error(`[${sym}] 청산 후 포지션 잔존: ${stillOpen.positionAmt}`);
            } else {
              closeSuccess++;
              this.logger.log(`[${sym}] 청산 확인 완료`);
            }
          } catch (ve: any) {
            // 재확인 실패 — 성공으로 처리하지 않음 (사용자 직접 확인 필요)
            closeErrors.push({
              symbol: sym, reason: 'CLOSE_VERIFY_FAILED',
              message: `청산 주문 전송 후 포지션 재확인 실패: ${ve.message}. Binance 앱에서 직접 확인하세요.`,
              posAmt: String(posAmt), qty: qtyStr,
            });
            this.logger.error(`[${sym}] 청산 후 포지션 재확인 실패 — 수동 확인 필요: ${ve.message}`);
          }

        } catch (e: any) {
          // reduceOnly 에러 코드 확인
          const errRes  = e.getResponse?.() ?? {};
          const binCode = Number(errRes.binanceCode ?? 0);

          if (binCode === -4115 || binCode === -2022) {
            // reduceOnly 미지원 — 기록만 하고 fallback 없음 (의도적 포지션 방향 혼동 방지)
            closeErrors.push({
              symbol: sym, reason: 'REDUCE_ONLY_REJECTED',
              message: `code=${binCode}: reduceOnly 미지원. 수동 청산 필요`,
              posAmt: String(posAmt), qty: qtyStr,
            });
            this.logger.error(`[${sym}] reduceOnly 거절 — 수동 청산 필요 (code ${binCode})`);
          } else {
            closeErrors.push({
              symbol: sym, reason: 'CLOSE_POSITION_FAILED',
              message: e.message, posAmt: String(posAmt), qty: qtyStr,
            });
            this.logger.error(`[${sym}] 청산 실패: ${e.message}`);
          }
        }
      }
    }

    // ── 7. 청산 후 잔여 Algo 주문 재취소 (안전망) ────────────────────
    if (closePositions && positionSymbols.length > 0) {
      for (const sym of positionSymbols) {
        try {
          await this.binance.cancelAllAlgoOrders(sym);
        } catch { /* 이미 취소됐거나 없으면 무시 */ }
      }
    }

    return {
      status:                'EMERGENCY_STOPPED',
      closePositionsRequested: closePositions,
      positionsFound,
      closeAttempts,
      closeSuccess,
      canceledNormalOrders,
      canceledAlgoOrders,
      cancelErrors,
      closeErrors,
      positionFetchError,
    };
  }

  async resetEmergencyStop(userId: string) {
    await this.prisma.engineState.upsert({
      where:  { userId },
      update: { status: 'STOPPED', stopReason: null },
      create: { userId, status: 'STOPPED' },
    });
    return { status: 'RESET' };
  }

  // ── 수동 포지션 청산 ────────────────────────────────────────────────
  async closePosition(userId: string, symbol: string) {
    await this.binance.loadApiConfig(userId);

    // 최신 포지션 조회
    const positions = await this.binance.getPositionsStrict();
    const pos = positions.find((p: any) => p.symbol === symbol && parseFloat(p.positionAmt) !== 0);
    if (!pos) return { status: 'NO_POSITION' };

    let filters: { stepSize: number };
    try {
      filters = await this.binance.getSymbolFilters(symbol);
    } catch (e: any) {
      throw new BadRequestException({
        code: 'SYMBOL_FILTER_FAILED',
        message: `${symbol} 심볼 필터 조회 실패: ${e.message}`,
      });
    }

    const posAmt    = parseFloat(pos.positionAmt);
    const side      = posAmt > 0 ? 'SELL' : 'BUY';
    const precision = filters.stepSize < 1 ? (String(filters.stepSize).split('.')[1]?.length ?? 0) : 0;
    const qtyStr    = (Math.floor(Math.abs(posAmt) / filters.stepSize) * filters.stepSize).toFixed(precision);

    if (Number(qtyStr) <= 0) {
      throw new BadRequestException({ code: 'CLOSE_QTY_ZERO', message: `청산 수량 계산 결과 0 — posAmt:${posAmt}, stepSize:${filters.stepSize}` });
    }

    try {
      await this.binance.placeOrder({
        symbol, side, positionSide: 'BOTH', type: 'MARKET', quantity: qtyStr, reduceOnly: 'true',
      });
    } catch (e: any) {
      const errRes  = e.getResponse?.() ?? {};
      const binCode = Number(errRes.binanceCode ?? 0);
      if (binCode === -4115 || binCode === -2022) {
        // reduceOnly 미지원 — fallback 없이 오류 반환 (의도적)
        throw new BadRequestException({
          code:    'REDUCE_ONLY_REJECTED',
          message: `reduceOnly 미지원(code ${binCode}). Binance 앱에서 수동 청산하세요.`,
        });
      }
      throw new BadRequestException({ code: 'CLOSE_ORDER_FAILED', message: e.message });
    }

    // 청산 후 포지션 재확인
    await sleep(1500);
    let closeStatus = 'CLOSED';
    let remaining: string | undefined;
    let verifyMessage: string | undefined;
    try {
      const verify    = await this.binance.getPositionsStrict();
      const stillOpen = verify.find((v: any) => v.symbol === symbol && parseFloat(v.positionAmt) !== 0);
      if (stillOpen) {
        closeStatus    = 'POSITION_STILL_OPEN';
        remaining      = String(stillOpen.positionAmt);
        verifyMessage  = '청산 주문은 전송됐으나 포지션이 남아 있습니다. Binance 앱에서 직접 확인하세요.';
      }
    } catch (ve: any) {
      closeStatus   = 'CLOSE_VERIFY_FAILED';
      verifyMessage = `청산 주문 전송 후 포지션 재확인 실패: ${ve.message}. Binance 앱에서 직접 확인하세요.`;
      this.logger.error(`[${symbol}] 청산 후 포지션 재확인 실패: ${ve.message}`);
    }

    return { status: closeStatus, symbol, quantity: qtyStr, remaining, message: verifyMessage };
  }
}
