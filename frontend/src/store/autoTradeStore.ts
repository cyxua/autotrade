import { create } from 'zustand';

export type EngineStatus =
  | 'RUNNING' | 'STOPPED' | 'EMERGENCY_STOPPED'
  | 'PAUSED_DAILY_LOSS' | 'PAUSED_CONSEC_LOSS';

interface AutoTradeState {
  status: EngineStatus;
  dailyPnl: number;
  dailyTrades: number;
  consecLossCount: number;
  setStatus: (status: EngineStatus) => void;
  setStats: (data: Partial<AutoTradeState>) => void;
}

export const useAutoTradeStore = create<AutoTradeState>(set => ({
  status: 'STOPPED',
  dailyPnl: 0,
  dailyTrades: 0,
  consecLossCount: 0,
  setStatus: status => set({ status }),
  setStats: data => set(prev => ({ ...prev, ...data })),
}));
