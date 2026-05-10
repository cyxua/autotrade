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
  setPositions: (positions) => {
    const prev = (useNotificationStore.getState as any)?.()?.addNotification;
    const addNotification = useNotificationStore.getState().addNotification;
    const prevPositions = (set as any)._store?.getState?.()?.positions ?? [];
    // 신규 포지션 감지
    positions.forEach((p: any) => {
      if (parseFloat(p.positionAmt) !== 0) {
        const side = parseFloat(p.positionAmt) > 0 ? 'LONG 🟢' : 'SHORT 🔴';
        addNotification('info', `포지션 진입: ${p.symbol}`,
          `${side} | 수량: ${Math.abs(parseFloat(p.positionAmt))} | 진입가: $${parseFloat(p.entryPrice).toFixed(4)}`);
      }
    });
    set({ positions });
  },
  setLoading: isLoading => set({ isLoading }),
  setError: error => set({ error }),
  setLastUpdated: () => set({ lastUpdated: new Date() }),
}));
