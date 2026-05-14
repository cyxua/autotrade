import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { decrypt } from '../../common/utils/crypto.util';

@Injectable()
export class FuturesService {
  private cache = new Map<string, { data: any; ts: number }>();
  private cached(key: string, ttl: number, fn: () => Promise<any>) {
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.ts < ttl) return Promise.resolve(hit.data);
    return fn().then(data => { this.cache.set(key, { data, ts: Date.now() }); return data; });
  }
  private readonly logger = new Logger(FuturesService.name);
  private readonly BASE = 'https://fapi.binance.com';
  private client: AxiosInstance;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    this.client = axios.create({ baseURL: this.BASE, timeout: 10_000 });
  }

  // ── 공개 API (서명 불필요) ─────────────────────────

  async getSymbols() {
    const res = await this.client.get('/fapi/v1/exchangeInfo');
    return res.data.symbols
      .filter((s: any) =>
        s.status === 'TRADING' &&
        s.contractType === 'PERPETUAL' &&
        s.quoteAsset === 'USDT'
      )
      .map((s: any) => ({
        symbol: s.symbol,
        baseAsset: s.baseAsset,
        quoteAsset: s.quoteAsset,
        contractType: s.contractType,
        status: s.status,
        pricePrecision: s.pricePrecision,
        quantityPrecision: s.quantityPrecision,
      }));
  }

  async getTickers() {
    const res = await this.client.get('/fapi/v1/ticker/24hr');
    return res.data.map((t: any) => ({
      symbol: t.symbol,
      lastPrice: t.lastPrice,
      priceChangePercent: t.priceChangePercent,
      quoteVolume: t.quoteVolume,
      count: t.count,
      highPrice: t.highPrice,
      lowPrice: t.lowPrice,
    }));
  }

  async getKlines(symbol: string, interval: string, limit = 500) {
    const res = await this.client.get('/fapi/v1/klines', {
      params: { symbol, interval, limit },
    });
    return res.data.map((k: any[]) => ({
      time: Math.floor(k[0] / 1000),   // ms → 초 변환
      open:   parseFloat(k[1]),
      high:   parseFloat(k[2]),
      low:    parseFloat(k[3]),
      close:  parseFloat(k[4]),
      volume: parseFloat(k[5]),
      closeTime: k[6],
    }));
  }

  async getPrice(symbol: string) {
    const res = await this.client.get('/fapi/v2/ticker/price', {
      params: { symbol },
    });
    return { symbol: res.data.symbol, price: res.data.price };
  }

  // ── 서명 필요 API ─────────────────────────────────

  private async loadKeys(userId: string) {
    const cfg = await this.prisma.apiConfig.findUnique({ where: { userId } });
    if (!cfg) throw new Error('API 키가 설정되지 않았습니다.');
    const encKey = this.config.get<string>('ENCRYPTION_KEY') ?? '';
    const secret = decrypt(
      { encrypted: cfg.encryptedSecret, iv: cfg.secretIv, tag: cfg.secretTag },
      encKey,
    );
    const baseUrl = cfg.tradingMode === 'LIVE'
      ? 'https://fapi.binance.com'
      : 'https://testnet.binancefuture.com';
    return { apiKey: cfg.apiKey, secret, baseUrl };
  }

  private sign(queryStr: string, secret: string) {
    return crypto.createHmac('sha256', secret).update(queryStr).digest('hex');
  }

  private async signedGet(baseUrl: string, path: string, apiKey: string, secret: string, params: Record<string, any> = {}) {
    const query = { ...params, timestamp: Date.now() };
    const qs = new URLSearchParams(
      Object.entries(query).map(([k, v]) => [k, String(v)])
    ).toString();
    const sig = this.sign(qs, secret);
    const url = `${baseUrl}${path}?${qs}&signature=${sig}`;
    const res = await axios.get(url, {
      headers: { 'X-MBX-APIKEY': apiKey },
      timeout: 10_000,
    });
    return res.data;
  }

  async getBalance(userId: string) {
    try {
      const { apiKey, secret, baseUrl } = await this.loadKeys(userId);
      const data = await this.signedGet(baseUrl, '/fapi/v3/balance', apiKey, secret);
      const usdt = data.find((b: any) => b.asset === 'USDT');
      return {
        asset: 'USDT',
        walletBalance: usdt?.balance ?? '0',
        availableBalance: usdt?.availableBalance ?? '0',
        crossWalletBalance: usdt?.crossWalletBalance ?? '0',
        crossUnPnl: usdt?.crossUnPnl ?? '0',
      };
    } catch (e: any) {
      return { asset: 'USDT', walletBalance: '0', availableBalance: '0', crossWalletBalance: '0', crossUnPnl: '0' };
    }
  }

  async getAccount(userId: string) {
    try {
      const { apiKey, secret, baseUrl } = await this.loadKeys(userId);
      const data = await this.signedGet(baseUrl, '/fapi/v3/account', apiKey, secret);
      return {
        totalWalletBalance:          data.totalWalletBalance,
        totalMarginBalance:          data.totalMarginBalance,
        totalUnrealizedProfit:       data.totalUnrealizedProfit,
        availableBalance:            data.availableBalance,
        totalPositionInitialMargin:  data.totalPositionInitialMargin,
        totalOpenOrderInitialMargin: data.totalOpenOrderInitialMargin,
      };
    } catch (e: any) { return null; }
  }

  async getPositions(userId: string) {
    try {
      const { apiKey, secret, baseUrl } = await this.loadKeys(userId);
      const data = await this.signedGet(baseUrl, '/fapi/v3/positionRisk', apiKey, secret);
      return data
        .filter((p: any) => parseFloat(p.positionAmt) !== 0)
        .map((p: any) => ({
          symbol:          p.symbol,
          positionAmt:     p.positionAmt,
          entryPrice:      p.entryPrice,
          markPrice:       p.markPrice,
          liquidationPrice: p.liquidationPrice,
          unRealizedProfit: p.unRealizedProfit,
          leverage:        p.leverage,
          marginType:      p.marginType,
          side:            parseFloat(p.positionAmt) > 0 ? 'LONG' : 'SHORT',
          notional:        p.notional,
        }));
    } catch (e: any) { return []; }
  }

  async getOrders(userId: string, symbol: string, limit = 20) {
    const { apiKey, secret, baseUrl } = await this.loadKeys(userId);
    const data = await this.signedGet(baseUrl, '/fapi/v1/allOrders', apiKey, secret, { symbol, limit });
    return data
      .sort((a: any, b: any) => b.time - a.time)
      .slice(0, limit)
      .map((o: any) => ({
        orderId:     o.orderId,
        symbol:      o.symbol,
        side:        o.side,
        type:        o.type,
        status:      o.status,
        price:       o.price,
        avgPrice:    o.avgPrice,
        origQty:     o.origQty,
        executedQty: o.executedQty,
        realizedPnl: o.realizedPnl ?? '0',
        time:        o.time,
        updateTime:  o.updateTime,
      }));
  }

  // DB에 저장된 봇 주문 조회
  async getBotOrders(userId: string, limit = 20) {
    return this.prisma.order.findMany({
      where: { userId, status: 'FILLED' },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { strategy: { select: { name: true } } },
    });
  }
}
