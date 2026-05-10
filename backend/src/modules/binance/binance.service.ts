import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { decrypt } from '../../common/utils/crypto.util';

@Injectable()
export class BinanceService {
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
  async getPositions() { return this.signedRequest('GET', '/fapi/v2/positionRisk'); }
  async getOpenOrders(symbol?: string) {
    return this.signedRequest('GET', '/fapi/v1/openOrders', symbol ? { symbol } : {});
  }
  async setLeverage(symbol: string, leverage: number) {
    return this.signedRequest('POST', '/fapi/v1/leverage', { symbol, leverage });
  }
  async setMarginType(symbol: string, marginType: string) {
    try { return await this.signedRequest('POST', '/fapi/v1/marginType', { symbol, marginType }); }
    catch (err: any) { if (err.message?.includes('-4046')) return null; throw err; }
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
      low: parseFloat(k[3]), close: parseFloat(k[4]), volume: parseFloat(k[5]), closeTime: k[6],
    }));
  }
  getMode() { return this.mode; }
}
