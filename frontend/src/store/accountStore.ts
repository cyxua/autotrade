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
    const { addNotification } = useNotificationStore.getState();
    // get 함수로 이전 포지션 비교
    const prevPositions: any[] = (get as any)()?.positions ?? [];
    const prevMap = new Map(prevPositions.map((p: any) => [p.symbol, parseFloat(p.positionAmt ?? '0')]));

    positions.forEach((p: any) => {
      const curr = parseFloat(p.positionAmt ?? '0');
      const prev = prevMap.get(p.symbol) ?? 0;
      // 이전에 0이었는데 지금 0이 아닌 경우만 신규 진입
      if (prev === 0 && curr !== 0) {
        const side = curr > 0 ? 'LONG 🟢' : 'SHORT 🔴';
        addNotification('info', `포지션 진입: ${p.symbol}`,
          `${side} | 수량: ${Math.abs(curr)} | 진입가: $${parseFloat(p.entryPrice ?? '0').toFixed(4)}`);
      }
      // 포지션 청산 감지 (이전에 있었는데 지금 0)
      if (prev !== 0 && curr === 0) {
        addNotification('success', `포지션 청산: ${p.symbol}`,
          `청산 완료 | 진입가: $${parseFloat(p.entryPrice ?? '0').toFixed(4)}`);
      }
    });
    set({ positions });
  },
  setLoading: isLoading => set({ isLoading }),
  setError: error => set({ error }),
  setLastUpdated: () => set({ lastUpdated: new Date() }),
}));
