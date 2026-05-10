import { create } from 'zustand';

interface ApiConnectionState {
  isConnected: boolean;
  hasSecret: boolean;
  apiKeyMasked: string;
  lastCheckedAt: string | null;
  setConnection: (data: Partial<ApiConnectionState>) => void;
}

export const useApiConnectionStore = create<ApiConnectionState>(set => ({
  isConnected: false,
  hasSecret: false,
  apiKeyMasked: '',
  lastCheckedAt: null,
  setConnection: data => set(prev => ({ ...prev, ...data })),
}));
