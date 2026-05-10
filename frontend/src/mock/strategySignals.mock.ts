export interface MockSignal {
  id: string;
  time: string;
  symbol: string;
  signal: 'LONG' | 'SHORT' | 'BLOCKED';
  reason: string;
  strategy: string;
  price: number;
  executed: boolean;
  blockReason?: string;
}

export const mockSignals: MockSignal[] = [
  {
    id: 's-001',
    time: new Date(Date.now() - 600_000).toISOString(),
    symbol: 'BTCUSDT', signal: 'LONG',
    reason: 'EMA_GOLDEN_CROSS',
    strategy: 'BTC EMA 크로스',
    price: 64200, executed: true,
  },
  {
    id: 's-002',
    time: new Date(Date.now() - 1800_000).toISOString(),
    symbol: 'ETHUSDT', signal: 'SHORT',
    reason: 'RSI_OVERBOUGHT_EXIT',
    strategy: 'ETH RSI',
    price: 3250, executed: true,
  },
  {
    id: 's-003',
    time: new Date(Date.now() - 3600_000).toISOString(),
    symbol: 'BNBUSDT', signal: 'BLOCKED',
    reason: 'VOLUME_SPIKE_BULL',
    strategy: '거래량 급증',
    price: 578, executed: false,
    blockReason: 'LEVERAGE_EXCEEDED',
  },
];
