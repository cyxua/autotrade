import { create } from 'zustand';

export type TradingMode = 'TESTNET' | 'LIVE';

interface TradingModeState {
  mode: TradingMode;
  isLoaded: boolean;
  setMode: (mode: TradingMode) => void;
  setLoaded: (v: boolean) => void;
}

export const useTradingModeStore = create<TradingModeState>(set => ({
  mode: 'TESTNET',
  isLoaded: false,
  setMode: mode => set({ mode }),
  setLoaded: isLoaded => set({ isLoaded }),
}));
