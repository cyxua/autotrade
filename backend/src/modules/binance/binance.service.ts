import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { decrypt } from '../../common/utils/crypto.util';

@Injectable()
export class BinanceService {
  private _posCache: { data: any; ts: number } | null = null;
  private readonly logger = new Logger(BinanceService.name);
  private client: AxiosInstance;
  private mode: 'testnet' | 'live' = 'testnet';
  private apiKey = '';
  private apiSecret = '';

  private readonly BASE_URLS = {
    testnet: 'https://testnet.binancefuture.com',
    live: 'https://fapi.binance.com',
  };

  constructor(private config: ConfigService, private prisma: PrismaService) {
    this.initClient('testnet');
  }

  private initClient(mode: 'testnet' | 'live') {
    this.mode = mode;
    this.client = axios.create({ baseURL: this.BASE_URLS[mode], timeout: 10_000 });
  }

  async loadApiConfig(userId: string) {
    const cfg = await this.prisma.apiConfig.findUnique({ where: { userId } });
    if (!cfg) throw new BadRequestException({ code: 'API_NOT_CONFIGURED', message: 'API 키가 설정되지 않았습니다.' });
    const encKey = this.config.get<string>('ENCRYPTION_KEY') ?? '';
    this.apiSecret = decrypt({ encrypted: cfg.encryptedSecret, iv: cfg.secretIv, tag: cfg.secretTag }, encKey);
    this.apiKey = cfg.apiKey;
    this.initClient(cfg.tradingMode === 'LIVE' ? 'live' : 'testnet');
  }

  private sign(queryString: string): string {
    return crypto.createHmac('sha256', this.apiSecret).update(queryString).digest('hex');
  }

  private async signedRequest(method: 'GET' | 'POST' | 'DELETE', path: string, params: Record<string, any> = {}) {
    const query = { ...params, timestamp: Date.now() };
    const queryStr = new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)])).toString();
    const signature = this.sign(queryStr);
    const headers = { 'X-MBX-APIKEY': this.apiKey };
    try {
      const url = `${path}?${queryStr}&signature=${signature}`;
      const res = method === 'GET'
        ? await this.client.get(url, { headers })
        : method === 'POST'
          ? await this.client.post(url, null, { headers })
          : await this.client.delete(url, { headers });
      return res.data;
    } catch (err: any) {
      const code = err.response?.data?.code;
      const msg = err.response?.data?.msg ?? err.message;
      this.logger.error(`Binance API 오류 [${path}]: code=${code} msg=${msg}`);
      throw new BadRequestException({ code: 'BINANCE_API_ERROR', message: msg, binanceCode: code });
    }
  }

  async ping(): Promise<boolean> {
    try { await this.client.get('/fapi/v1/ping'); return true; } catch { return false; }
  }

  async getAccount() { return this.signedRequest('GET', '/fapi/v2/account'); }
  async getBalance() { return this.signedRequest('GET', '/fapi/v2/balance'); }
  // 표시용: 실패 시 캐시 또는 [] 반환 (UI 전용)
  async getPositionsDisplay() {
    if (this._posCache && Date.now() - this._posCache.ts < 30000) return this._posCache.data;
    try {
      const data = await this.signedRequest('GET', '/fapi/v2/positionRisk');
      this._posCache = { data, ts: Date.now() };
      return data;
    } catch (e: any) {
      if (this._posCache) return this._posCache.data;
      return [];
    }
  }

  // 거래용: 실패 시 throw (리스크 검사·주문 흐름 전용)
  async getPositionsStrict(): Promise<any[]> {
    try {
      const data = await this.signedRequest('GET', '/fapi/v2/positionRisk');
      this._posCache = { data, ts: Date.now() };
      return data;
    } catch (e: any) {
      throw new Error(`POSITION_FETCH_FAILED: ${e.message}`);
    }
  }

  // 하위 호환 (cancelAllOrders 등)
  async getPositions() { return this.getPositionsDisplay(); }
  async getOpenOrders(symbol?: string) {
    return this.signedRequest('GET', '/fapi/v1/openOrders', symbol ? { symbol } : {});
  }
  async setLeverage(symbol: string, leverage: number) {
    return this.signedRequest('POST', '/fapi/v1/leverage', { symbol, leverage });
  }
  async setMarginType(symbol: string, marginType: string) {
    try { return await this.signedRequest('POST', '/fapi/v1/marginType', { symbol, marginType }); }
    catch (err: any) {
      // -4046: 이미 동일 마진 타입 설정됨 — 무시
      const res = err.getResponse?.() ?? {};
      const binanceCode = res.binanceCode ?? err.binanceCode;
      const msgStr = String(res.message ?? err.message ?? '');
      if (Number(binanceCode) === -4046 || msgStr.includes('No need to change margin type')) {
        return null;
      }
      throw err;
    }
  }
  async placeOrder(params: Record<string, any>) {
    return this.signedRequest('POST', '/fapi/v1/order', params);
  }
  async cancelAllOrders(symbol?: string) {
    if (symbol) return this.signedRequest('DELETE', '/fapi/v1/allOpenOrders', { symbol });
    const positions = await this.getPositions();
    const symbols = positions.filter((p: any) => parseFloat(p.positionAmt) !== 0).map((p: any) => p.symbol);
    return Promise.all(symbols.map((s: string) =>
      this.signedRequest('DELETE', '/fapi/v1/allOpenOrders', { symbol: s }).catch(() => null)
    ));
  }
  async getKlines(symbol: string, interval: string, limit = 200, startTime?: number, endTime?: number) {
    const params: any = { symbol, interval, limit };
    if (startTime) params.startTime = startTime;
    if (endTime) params.endTime = endTime;
    const res = await this.client.get('/fapi/v1/klines', { params });
    return res.data.map((k: any[]) => ({
      openTime: k[0], open: parseFloat(k[1]), high: parseFloat(k[2]),
      low: parseFloat(k[3]), close: parseFloat(k[4]), volume: parseFloat(k[5]), closeTime: k[6], tradeCount: k[8] ?? 0,
    }));
  }
  getMode() { return this.mode; }

  async getSymbolFilters(symbol: string): Promise<{
    stepSize: number; minQty: number; minNotional: number; tickSize: number;
  }> {
    let data: any;
    try {
      data = await this.client.get('/fapi/v1/exchangeInfo');
    } catch (e: any) {
      throw new Error(`SYMBOL_FILTER_CHECK_FAILED: ${e.message}`);
    }
    const sym = data.data.symbols.find((s: any) => s.symbol === symbol);
    if (!sym) throw new Error(`SYMBOL_NOT_FOUND: ${symbol}`);

    const filters: any[] = sym.filters ?? [];
    const lot      = filters.find((f: any) => f.filterType === 'LOT_SIZE');
    const notional = filters.find((f: any) => f.filterType === 'MIN_NOTIONAL');
    const price    = filters.find((f: any) => f.filterType === 'PRICE_FILTER');

    if (!lot)      throw new Error(`LOT_SIZE_FILTER_NOT_FOUND: ${symbol}`);
    if (!price)    throw new Error(`PRICE_FILTER_NOT_FOUND: ${symbol}`);
    if (!notional) throw new Error(`MIN_NOTIONAL_FILTER_NOT_FOUND: ${symbol}`);

    return {
      stepSize:    parseFloat(lot.stepSize),
      minQty:      parseFloat(lot.minQty),
      minNotional: parseFloat(notional.notional),
      tickSize:    parseFloat(price.tickSize),
    };
  }

  // 주문 상세 재조회 (ACK 응답 보완용)
  async getOrderDetail(symbol: string, orderId: number): Promise<any> {
    return this.signedRequest('GET', '/fapi/v1/order', { symbol, orderId });
  }

  // 하위 호환 유지
  async getStepSize(symbol: string): Promise<number> {
    return (await this.getSymbolFilters(symbol)).stepSize;
  }

  // 거래용: symbol별 성공/실패 추적, getPositionsStrict 기반
  async cancelAllOrdersStrict(symbols?: string[]): Promise<{
    canceled: string[]; cancelErrors: { symbol: string; error: string }[];
  }> {
    let targets = symbols ?? [];
    if (targets.length === 0) {
      const positions = await this.getPositionsStrict();  // 실패 시 throw
      targets = positions
        .filter((p: any) => parseFloat(p.positionAmt) !== 0)
        .map((p: any) => p.symbol as string);
    }
    const canceled: string[] = [];
    const cancelErrors: { symbol: string; error: string }[] = [];
    for (const sym of targets) {
      try {
        await this.signedRequest('DELETE', '/fapi/v1/allOpenOrders', { symbol: sym });
        canceled.push(sym);
      } catch (e: any) {
        cancelErrors.push({ symbol: sym, error: e.message });
        this.logger.error(`[${sym}] 주문 취소 실패: ${e.message}`);
      }
    }
    return { canceled, cancelErrors };
  }


  // 손익 이력 조회 (REALIZED_PNL 등)
  async getIncome(
    symbol: string, incomeType: string, startTime?: number, limit = 1000,
  ): Promise<any[]> {
    const params: Record<string, any> = { incomeType, limit };
    if (symbol) params.symbol = symbol;
    if (startTime) params.startTime = startTime;
    return this.signedRequest('GET', '/fapi/v1/income', params);
  }


  // ── Algo Order API (USDⓈ-M Futures 조건부 주문 전용) ────────────────
  // STOP_MARKET / TAKE_PROFIT_MARKET / STOP / TAKE_PROFIT / TRAILING_STOP_MARKET
  // POST /fapi/v1/algoOrder
  async placeAlgoOrder(params: Record<string, string | number | boolean>): Promise<any> {
    return this.signedRequest('POST', '/fapi/v1/algoOrder', params);
  }

  // DELETE /fapi/v1/algoOrder
  async cancelAlgoOrder(algoId?: number, clientAlgoId?: string): Promise<any> {
    const params: Record<string, string | number> = {};
    if (algoId)       params.algoId       = algoId;
    if (clientAlgoId) params.clientAlgoId = clientAlgoId;
    if (!algoId && !clientAlgoId) throw new Error('algoId 또는 clientAlgoId 중 하나는 필수');
    return this.signedRequest('DELETE', '/fapi/v1/algoOrder', params);
  }

  // DELETE /fapi/v1/algoOpenOrders — 심볼의 모든 미체결 Algo 주문 취소
  async cancelAllAlgoOrders(symbol: string): Promise<any> {
    return this.signedRequest('DELETE', '/fapi/v1/algoOpenOrders', { symbol });
  }

  // GET /fapi/v1/algoOrder
  async getAlgoOrder(algoId?: number, clientAlgoId?: string): Promise<any> {
    const params: Record<string, string | number> = {};
    if (algoId)       params.algoId       = algoId;
    if (clientAlgoId) params.clientAlgoId = clientAlgoId;
    if (!algoId && !clientAlgoId) throw new Error('algoId 또는 clientAlgoId 중 하나는 필수');
    return this.signedRequest('GET', '/fapi/v1/algoOrder', params);
  }

  async getTickerPrice(symbol: string): Promise<number> {
    const res = await this.client.get('/fapi/v1/ticker/price', { params: { symbol } });
    return parseFloat(res.data.price);
  }
}
