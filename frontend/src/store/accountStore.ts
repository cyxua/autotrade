import { useNotificationStore } from './useNotificationStore';
import { create } from 'zustand';
import type { BalanceInfo, AccountInfo, PositionInfo } from '@/lib/futuresApi';

interface AccountState {
  balance: BalanceInfo | null;
  account: AccountInfo | null;
  positions: PositionInfo[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  setBalance: (b: BalanceInfo) => void;
  setAccount: (a: AccountInfo) => void;
  setPositions: (p: PositionInfo[]) => void;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
  setLastUpdated: () => void;
}

export const useAccountStore = create<AccountState>(set => ({
  balance: null,
  account: null,
  positions: [],
  isLoading: false,
  error: null,
  lastUpdated: null,
  setBalance: balance => set({ balance }),
  setAccount: account => set({ account }),
  setPositions: positions => set({ positions }),
  setLoading: isLoading => set({ isLoading }),
  setError: error => set({ error }),
  setLastUpdated: () => set({ lastUpdated: new Date() }),
}));
