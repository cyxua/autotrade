'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useTradingModeStore } from '@/store/tradingModeStore';
import { useAutoTradeStore } from '@/store/autoTradeStore';
import { useApiConnectionStore } from '@/store/apiConnectionStore';
import { useRiskStore } from '@/store/riskStore';
import { ModeBadge } from '@/components/layout/ModeBadge';
import { LiveModeWarning } from '@/components/settings/LiveModeWarning';
import { AutoTradeToggle } from '@/components/dashboard/AutoTradeToggle';
import { EmergencyStopButton } from '@/components/dashboard/EmergencyStopButton';
import { TradingChartPanel } from '@/components/dashboard/TradingChartPanel';
import { PositionSummaryPanel } from '@/components/dashboard/PositionSummaryPanel';
import { RecentOrderTable } from '@/components/dashboard/RecentOrderTable';
import { StrategySignalLog } from '@/components/dashboard/StrategySignalLog';

interface Summary {
  engine: any;
  positions: any;
  strategies: any;
  todayStats: any;
}

function StatCard({ label, value, color = '#F9FAFB', sub = '' }: {
  label: string; value: string; color?: string; sub?: string;
}) {
  return (
    <div style={{ background: '#111827', border: '1px solid #1F2937', borderRadius: '10px', padding: '14px' }}>
      <p style={{ fontSize: '11px', color: '#6B7280', marginBottom: '4px' }}>{label}</p>
      <p style={{ fontSize: '20px', fontWeight: 'bold', color }}>{value}</p>
      {sub && <p style={{ fontSize: '11px', color: '#6B7280', marginTop: '2px' }}>{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const router = useRouter();
  const { setMode } = useTradingModeStore();
  const { mode } = useTradingModeStore();
  const { status, setStatus, setStats } = useAutoTradeStore();
  const { setConnection } = useApiConnectionStore();
  const { setRisk } = useRiskStore();

  const load = async () => {
    try {
      const r = await api.get('/dashboard/summary');
      const d = r.data.data;
      setSummary(d);
      setStatus(d.engine.status);
      setStats({ dailyPnl: d.engine.dailyPnl, dailyTrades: d.engine.dailyTrades, consecLossCount: d.engine.consecLossCount });

      // tradingMode를 DB에서 읽어 store에 저장 (핵심: 충돌 해결)
      const apiR = await api.get('/settings/api');
      const cfg = apiR.data.data;
      if (cfg?.tradingMode) setMode(cfg.tradingMode);
      setConnection({ isConnected: cfg?.isConnected ?? false, hasSecret: cfg?.hasSecret ?? false });

      const riskR = await api.get('/settings/risk');
      const risk = riskR.data.data;
      if (risk) setRisk({
        maxLeverage: risk.maxLeverage ?? 0,
        maxDailyLossUsdt: risk.maxDailyLossUsdt ?? 0,
        maxPositions: 1,
        consecutiveLossStop: risk.consecutiveLossStop ?? 0,
        isLoaded: true,
      });
    } catch {
      router.push('/login');
    }
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 20_000);
    return () => clearInterval(iv);
  }, []);

  const isLive = mode === 'LIVE';
  const pnl = summary?.positions?.totalUnrealizedPnl ?? 0;
  const todayPnl = summary?.todayStats?.realizedPnl ?? 0;

  return (
    <div style={{ minHeight: '100vh', background: '#030712' }}>
      {/* 헤더 */}
      <div style={{
        background: '#111827', borderBottom: '1px solid #1F2937',
        padding: '0 20px', height: '52px',
        display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        <span style={{ fontWeight: 'bold', color: '#EAB308', fontSize: '17px' }}>⚡ AutoTrade</span>
        <ModeBadge />
        <span style={{ fontSize: '12px', color: status === 'RUNNING' ? '#4ADE80' : status === 'EMERGENCY_STOPPED' ? '#F87171' : '#6B7280' }}>
          {status === 'RUNNING' ? '● 자동매매 ON' : status === 'EMERGENCY_STOPPED' ? '⚠ 긴급정지' : '○ 자동매매 OFF'}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <a href="/strategies" style={{ padding: '5px 10px', background: '#1F2937', color: '#D1D5DB', borderRadius: '6px', fontSize: '12px', textDecoration: 'none' }}>전략 관리</a>
          <a href="/settings" style={{ padding: '5px 10px', background: '#1F2937', color: '#D1D5DB', borderRadius: '6px', fontSize: '12px', textDecoration: 'none' }}>API 설정</a>
          <button onClick={() => api.post('/auth/logout').finally(() => router.push('/login'))}
            style={{ padding: '5px 10px', background: 'transparent', color: '#6B7280', border: 'none', fontSize: '12px', cursor: 'pointer' }}>
            로그아웃
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '16px' }}>
        {/* 실거래 경고 */}
        {isLive && <div style={{ marginBottom: '12px' }}><LiveModeWarning /></div>}

        {/* 타이틀 + 버튼 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold' }}>대시보드</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AutoTradeToggle />
            <EmergencyStopButton />
          </div>
        </div>

        {summary ? (
          <>
            {/* 요약 카드 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', marginBottom: '10px' }}>
              <StatCard label="포지션 수" value={`${summary.positions.count}개`} />
              <StatCard label="미실현 손익" value={`${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USDT`} color={pnl >= 0 ? '#4ADE80' : '#F87171'} />
              <StatCard label="오늘 실현 손익" value={`${todayPnl >= 0 ? '+' : ''}${todayPnl.toFixed(2)} USDT`} color={todayPnl >= 0 ? '#4ADE80' : '#F87171'} sub={`거래 ${summary.todayStats.trades}회`} />
              <StatCard label="활성 전략" value={`${summary.strategies.enabled} / ${summary.strategies.total}`} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginBottom: '14px' }}>
              <StatCard label="오늘 거래 횟수" value={`${summary.engine.dailyTrades}회`} />
              <StatCard label="연속 손실" value={`${summary.engine.consecLossCount}회`} color={summary.engine.consecLossCount > 0 ? '#F87171' : '#4ADE80'} />
              <StatCard label="승률" value={`${summary.todayStats.trades > 0 ? (summary.todayStats.winRate * 100).toFixed(0) : 0}%`} />
            </div>

            {/* 중앙: 차트 + 포지션 패널 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '12px', marginBottom: '12px' }}>
              <TradingChartPanel />
              <PositionSummaryPanel />
            </div>

            {/* 하단: 주문 로그 + 신호 로그 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <RecentOrderTable />
              <StrategySignalLog />
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '80px', color: '#4B5563' }}>로딩 중...</div>
        )}
      </div>
    </div>
  );
}
