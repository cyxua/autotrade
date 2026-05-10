export interface MockOrder {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  orderType: string;
  status: 'FILLED' | 'CANCELED' | 'ERROR';
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  leverage: number;
  realizedPnl?: number;
  entryReason: string;
  exitReason?: string;
  strategy: string;
  createdAt: string;
}

export const mockOrders: MockOrder[] = [
  {
    id: 'o-001', symbol: 'BTCUSDT', side: 'LONG',
    orderType: 'MARKET', status: 'FILLED',
    entryPrice: 64200, exitPrice: 65100,
    quantity: 0.01, leverage: 5,
    realizedPnl: 9.0,
    entryReason: 'EMA_GOLDEN_CROSS', exitReason: 'TAKE_PROFIT',
    strategy: 'BTC EMA 크로스',
    createdAt: new Date(Date.now() - 7200_000).toISOString(),
  },
  {
    id: 'o-002', symbol: 'ETHUSDT', side: 'SHORT',
    orderType: 'MARKET', status: 'FILLED',
    entryPrice: 3250, exitPrice: 3180,
    quantity: 0.05, leverage: 3,
    realizedPnl: 3.5,
    entryReason: 'RSI_OVERBOUGHT', exitReason: 'TAKE_PROFIT',
    strategy: 'ETH RSI',
    createdAt: new Date(Date.now() - 14400_000).toISOString(),
  },
  {
    id: 'o-003', symbol: 'SOLUSDT', side: 'LONG',
    orderType: 'MARKET', status: 'FILLED',
    entryPrice: 138, exitPrice: 135,
    quantity: 1, leverage: 5,
    realizedPnl: -3.0,
    entryReason: 'BB_LOWER_BOUNCE', exitReason: 'STOP_LOSS',
    strategy: 'SOL 볼린저',
    createdAt: new Date(Date.now() - 21600_000).toISOString(),
  },
];
