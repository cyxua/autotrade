import { create } from 'zustand';

interface RiskState {
  maxLeverage: number;
  maxDailyLossUsdt: number;
  maxPositions: number;
  consecutiveLossStop: number;
  isLoaded: boolean;
  setRisk: (data: Partial<RiskState>) => void;
}

export const useRiskStore = create<RiskState>(set => ({
  maxLeverage: 0,
  maxDailyLossUsdt: 0,
  maxPositions: 0,
  consecutiveLossStop: 0,
  isLoaded: false,
  setRisk: data => set(prev => ({ ...prev, ...data })),
}));
