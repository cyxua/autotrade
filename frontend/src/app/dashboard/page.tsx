'use client';
mport { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { fetchBalance, fetchAccount, fetchPositions } from '@/lib/futuresApi';
import { useTradingModeStore } from '@/store/tradingModeStore';
import { useAutoTradeStore } from '@/store/autoTradeStore';
import { useApiConnectionStore } from '@/store/apiConnectionStore';
import { useRiskStore } from '@/store/riskStore';
import { useAccountStore } from '@/store/accountStore';
import { ModeBadge } from '@/components/layout/ModeBadge';
import { LiveModeWarning } from '@/components/settings/LiveModeWarning';
import { AutoTradeToggle } from '@/components/dashboard/AutoTradeToggle';
import { EmergencyStopButton } from '@/components/dashboard/EmergencyStopButton';
import { RealtimeTickerPanel } from '@/components/realtime/RealtimeTickerPanel';
import { TradingChartPanel } from '@/components/dashboard/TradingChartPanel';
import { PositionSummaryPanel } from '@/components/dashboard/PositionSummaryPanel';
import { RecentOrderTable } from '@/components/dashboard/RecentOrderTable';
import { StrategySignalLog } from '@/components/dashboard/StrategySignalLog';

function StatCard({ label, value, color = '#F9FAFB', sub = '', small = false }: {
  label: string; value: string; color?: string; sub?: string; small?: boolean;
}) {
  return (
    <div style={{ background: '#111827', border: '1px solid #1F2937', borderRadius: '10px', padding: '14px' }}>
      <p style={{ fontSize: '11px', color: '#6B7280', marginBottom: '4px' }}>{label}</p>
      <p style={{ fontSize: small ? '15px' : '18px', fontWeight: 'bold', color }}>{value}</p>
      {sub && <p style={{ fontSize: '11px', color: '#6B7280', marginTop: '2px' }}>{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<any>(null);
  const router = useRouter();
  const { setMode, mode } = useTradingModeStore();
  const { status, setStatus, setStats } = useAutoTradeStore();
  const { setConnection } = useApiConnectionStore();
  const { setRisk } = useRiskStore();
  const { setBalance, setAccount, setPositions, setLoading, setError, setLastUpdated } = useAccountStore();
  const { balance, account, positions } = useAccountStore();

  // ── 엔진/설정 데이터 ──────────────────────────────
  const loadSummary = async () => {
    try {
      const r = await api.get('/dashboard/summary');
      const d = r.data.data;
      setSummary(d);
      setStatus(d.engine.status);
      setStats({ dailyPnl: d.engine.dailyPnl, dailyTrades: d.engine.dailyTrades, consecLossCount: d.engine.consecLossCount });
      const apiR = await api.get('/settings/api');
      const cfg = apiR.data.data;
      if (cfg?.tradingMode) setMode(cfg.tradingMode);
      setConnection({ isConnected: cfg?.isConnected ?? false, hasSecret: cfg?.hasSecret ?? false });
      const riskR = await api.get('/settings/risk');
      const risk = riskR.data.data;
      if (risk) setRisk({ maxLeverage: risk.maxLeverage ?? 0, maxDailyLossUsdt: risk.maxDailyLossUsdt ?? 0, maxPositions: 1, consecutiveLossStop: risk.consecutiveLossStop ?? 0, isLoaded: true });
    } catch { router.push('/login'); }
  };

  // ── 실제 Binance 데이터 ───────────────────────────
  const loadBinanceData = async () => {
    setLoading(true);
    try {
      const [bal, acc, pos] = await Promise.all([
        fetchBalance().catch(() => null),
        fetchAccount().catch(() => null),
        fetchPositions().catch(() => []),
      ]);
      if (bal) setBalance(bal);
      if (acc) setAccount(acc);
      setPositions(pos as any);
      setLastUpdated();
      setError(null);
    } catch (e: any) {
      setError(e.message ?? 'Binance API 오류');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
    loadBinanceData();
    const iv1 = setInterval(loadSummary, 20_000);
    const iv2 = setInterval(loadBinanceData, 10_000);
    return () => { clearInterval(iv1); clearInterval(iv2); };
  }, []);

  const isLive = mode === 'LIVE';
  const totalWallet = account?.totalWalletBalance ?? summary?.account?.totalWalletBalance ?? '—';
  const available  = account?.availableBalance    ?? summary?.account?.availableBalance  ?? '—';
  const unrealized = account?.totalUnrealizedProfit ?? '—';
  const posCount   = positions.length || summary?.positions?.count || 0;
  const todayPnl   = summary?.todayStats?.realizedPnl ?? 0;
  const trades     = summary?.todayStats?.trades ?? 0;
  const winRate    = summary?.todayStats?.winRate ?? 0;
  const consecLoss = summary?.engine?.consecLossCount ?? 0;

  const fmtUsdt = (v: string | number) => {
    const n = parseFloat(String(v));
    if (isNaN(n)) return '—';
    return `${n >= 0 ? '+' : ''}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div style={{ minHeight: '100vh', background: '#030712' }}>
      {/* 헤더 */}
      <div style={{ background: '#111827', borderBottom: '1px solid #1F2937', padding: '0 20px', height: '52px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontWeight: 'bold', color: '#EAB308', fontSize: '17px' }}>⚡ AutoTrade</span>
        <ModeBadge />
        <span style={{ fontSize: '12px', color: status === 'RUNNING' ? '#4ADE80' : status === 'EMERGENCY_STOPPED' ? '#F87171' : '#6B7280' }}>
          {status === 'RUNNING' ? '● 자동매매 ON' : status === 'EMERGENCY_STOPPED' ? '⚠ 긴급정지' : '○ 자동매매 OFF'}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <a href="/strategies" style={{ padding: '5px 10px', background: '#1F2937', color: '#D1D5DB', borderRadius: '6px', fontSize: '12px', textDecoration: 'none' }}>전략 관리</a>
          <a href="/settings"   style={{ padding: '5px 10px', background: '#1F2937', color: '#D1D5DB', borderRadius: '6px', fontSize: '12px', textDecoration: 'none' }}>API 설정</a>
          <button onClick={() => api.post('/auth/logout').finally(() => router.push('/login'))}
            style={{ padding: '5px 10px', background: 'transparent', color: '#6B7280', border: 'none', fontSize: '12px', cursor: 'pointer' }}>로그아웃</button>
        </div>
      </div>

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '16px' }}>
        {isLive && <div style={{ marginBottom: '12px' }}><LiveModeWarning /></div>}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold' }}>대시보드</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AutoTradeToggle />
            <EmergencyStopButton />
          </div>
        </div>

        {/* 잔고 카드 (실제 API) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', marginBottom: '10px' }}>
          <StatCard label="총 지갑 잔고" value={`${parseFloat(totalWallet).toLocaleString(undefined,{maximumFractionDigits:2})} USDT`} />
          <StatCard label="사용 가능 잔고" value={`${parseFloat(available).toLocaleString(undefined,{maximumFractionDigits:2})} USDT`} />
          <StatCard label="미실현 손익" value={`${fmtUsdt(unrealized)} USDT`} color={parseFloat(String(unrealized)) >= 0 ? '#4ADE80' : '#F87171'} />
          <StatCard label="오픈 포지션" value={`${posCount}개`} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', marginBottom: '14px' }}>
          <StatCard label="오늘 실현 손익" value={`${fmtUsdt(todayPnl)} USDT`} color={todayPnl >= 0 ? '#4ADE80' : '#F87171'} sub={`거래 ${trades}회`} />
          <StatCard label="승률" value={`${trades > 0 ? (winRate * 100).toFixed(0) : 0}%`} />
          <StatCard label="연속 손실" value={`${consecLoss}회`} color={consecLoss > 0 ? '#F87171' : '#4ADE80'} />
          <StatCard label="오늘 거래 횟수" value={`${summary?.engine?.dailyTrades ?? 0}회`} />
        </div>

        {/* 차트 + 포지션 */}
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 280px', gap: '12px', marginBottom: '12px' }}>
          <RealtimeTickerPanel symbol={symbol ?? 'BTCUSDT'} />
          <TradingChartPanel />
          <PositionSummaryPanel />
        </div>

        {/* 주문 로그 + 신호 로그 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <RecentOrderTable />
          <StrategySignalLog />
        </div>
      </div>
    </div>
  );
}
