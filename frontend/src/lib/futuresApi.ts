import { api } from './api';

// ── 공개 API ──────────────────────────────────────

export async function fetchSymbols() {
  const res = await api.get('/futures/symbols');
  return res.data.data as SymbolInfo[];
}

export async function fetchTickers() {
  const res = await api.get('/futures/tickers');
  return res.data.data as TickerInfo[];
}

export async function fetchKlines(symbol: string, interval: string, limit = 500) {
  const res = await api.get('/futures/klines', { params: { symbol, interval, limit } });
  return res.data.data as KlineData[];
}

export async function fetchPrice(symbol: string) {
  const res = await api.get('/futures/price', { params: { symbol } });
  return res.data.data as { symbol: string; price: string };
}

// ── 인증 필요 API ─────────────────────────────────

export async function fetchBalance() {
  const res = await api.get('/futures/balance');
  return res.data.data as BalanceInfo;
}

export async function fetchAccount() {
  const res = await api.get('/futures/account');
  return res.data.data as AccountInfo;
}

export async function fetchPositions() {
  const res = await api.get('/futures/positions');
  return res.data.data as PositionInfo[];
}

export async function fetchOrders(symbol?: string, limit = 20) {
  const params: any = { limit };
  if (symbol) params.symbol = symbol;
  const res = await api.get('/futures/orders', { params });
  return { data: res.data.data as OrderInfo[], source: res.data.source };
}

// ── 타입 정의 ─────────────────────────────────────

export interface SymbolInfo {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  contractType: string;
  status: string;
  pricePrecision: number;
  quantityPrecision: number;
}

export interface TickerInfo {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  quoteVolume: string;
  count: number;
  highPrice: string;
  lowPrice: string;
}

export interface KlineData {
  time: number;       // 초 단위 UTC timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface BalanceInfo {
  asset: string;
  walletBalance: string;
  availableBalance: string;
  crossWalletBalance: string;
  crossUnPnl: string;
}

export interface AccountInfo {
  totalWalletBalance: string;
  totalMarginBalance: string;
  totalUnrealizedProfit: string;
  availableBalance: string;
  totalPositionInitialMargin: string;
  totalOpenOrderInitialMargin: string;
}

export interface PositionInfo {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  markPrice: string;
  liquidationPrice: string;
  unRealizedProfit: string;
  leverage: string;
  marginType: string;
  side: 'LONG' | 'SHORT';
  notional: string;
}

export interface OrderInfo {
  orderId: number;
  symbol: string;
  side: string;
  type: string;
  status: string;
  price: string;
  avgPrice: string;
  origQty: string;
  executedQty: string;
  realizedPnl: string;
  time: number;
  updateTime: number;
}
