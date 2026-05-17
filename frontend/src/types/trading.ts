import type { EngineStatus } from '@/store/autoTradeStore';

// ── 대시보드 요약 ──────────────────────────────────────────────────────
export interface EngineSummary {
  status:          EngineStatus;
  tradingMode:     string;
  dailyPnl:        number;
  dailyTrades:     number;
  consecLossCount: number;
}
export interface DashboardSummary {
  engine:     EngineSummary;
  positions:  { count: number; totalUnrealizedPnl: number };
  strategies: { total: number; enabled: number };
  todayStats: { realizedPnl: number; trades: number; winRate: number };
}

// ── 전략 ──────────────────────────────────────────────────────────────
export interface Strategy {
  id:            string;
  name:          string;
  type:          string;
  symbol:        string;
  timeframe:     string;
  leverage:      number;
  enabled:       boolean;
  totalTrades:   number;
  winTrades:     number;
  totalPnl:      number;
  takeProfitPct: number;
  stopLossPct:   number;
  params:        Record<string, unknown>;
}

// ── API 설정 ──────────────────────────────────────────────────────────
export interface ApiConfig {
  apiKey?:      string;
  tradingMode?: string;
  isConnected:  boolean;
  hasSecret:    boolean;
  configured:   boolean;
}
