export interface MockPosition {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  markPrice: number;
  quantity: number;
  leverage: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  takeProfitPrice: number;
  stopLossPrice: number;
  liquidationPrice: number;
  marginType: 'ISOLATED' | 'CROSSED';
  openedAt: string;
}

export const mockPositions: MockPosition[] = [
  {
    id: 'pos-001',
    symbol: 'BTCUSDT',
    side: 'LONG',
    entryPrice: 64200,
    markPrice: 65100,
    quantity: 0.01,
    leverage: 5,
    unrealizedPnl: 9.0,
    unrealizedPnlPct: 1.4,
    takeProfitPrice: 66000,
    stopLossPrice: 63000,
    liquidationPrice: 51800,
    marginType: 'ISOLATED',
    openedAt: new Date(Date.now() - 3600_000).toISOString(),
  },
];
