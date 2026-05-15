import { create } from 'zustand';

export type ChartSymbol = string;  // 모든 심볼 허용 (BILLUSDT 등 포함)
export type ChartTimeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

interface ChartState {
  symbol: ChartSymbol;
  timeframe: ChartTimeframe;
  setSymbol: (s: ChartSymbol) => void;
  setTimeframe: (t: ChartTimeframe) => void;
}

export const useChartStore = create<ChartState>(set => ({
  symbol: 'BTCUSDT',
  timeframe: '15m',
  setSymbol: symbol => set({ symbol }),
  setTimeframe: timeframe => set({ timeframe }),
}));
