'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { fmtUsdt } from '@/lib/utils';

const card = (label: string, value: string, color = '#F9FAFB', sub = '') => (
  <div key={label} style={{ background: '#111827', border: '1px solid #1F2937', borderRadius: '12px', padding: '16px' }}>
    <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>{label}</p>
    <p style={{ fontSize: '24px', fontWeight: 'bold', color }}>{value}</p>
    {sub && <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>{sub}</p>}
  </div>
);

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [engineStatus, setEngineStatus] = useState('STOPPED');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const load = async () => {
    try {
      const res = await api.get('/dashboard/summary');
      setData(res.data.data);
      setEngineStatus(res.data.data.engine.status);
    } catch { router.push('/login'); }
  };

  useEffect(() => { load(); const iv = setInterval(load, 15000); return () => clearInterval(iv); }, []);

  const toggleEngine = async () => {
    setLoading(true);
    try {
      if (engineStatus === 'RUNNING') {
        await api.post('/engine/stop');
        setEngineStatus('STOPPED');
        alert('자동매매가 중지되었습니다.');
      } else {
        await api.post('/engine/start');
        setEngineStatus('RUNNING');
        alert('자동매매가 시작되었습니다.');
      }
    } catch (e: any) {
      alert(e.response?.data?.error?.message ?? '오류가 발생했습니다.');
    } finally { setLoading(false); load(); }
  };

  const emergencyStop = async () => {
    if (!confirm('긴급 정지를 실행하시겠습니까?\n모든 미체결 주문이 취소됩니다.')) return;
    try {
      await api.post('/engine/emergency-stop', { closePositions: false });
      alert('🚨 긴급 정지 실행 완료');
      load();
    } catch (e: any) { alert(e.response?.data?.error?.message ?? '오류'); }
  };

  const logout = async () => {
    await api.post('/auth/logout').catch(() => {});
    router.push('/login');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#030712' }}>
      {/* 헤더 */}
      <div style={{ background: '#111827', borderBottom: '1px solid #1F2937', padding: '0 24px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontWeight: 'bold', color: '#EAB308', fontSize: '18px' }}>⚡ AutoTrade</span>
          <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '999px', background: '#172554', color: '#93C5FD', border: '1px solid #1e40af' }}>🔵 테스트넷</span>
          <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '999px', background: engineStatus === 'RUNNING' ? '#052e16' : '#1c1917', color: engineStatus === 'RUNNING' ? '#4ade80' : '#9CA3AF' }}>
            {engineStatus === 'RUNNING' ? '● 자동매매 ON' : '○ 자동매매 OFF'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <a href="/strategies" style={{ padding: '6px 12px', background: '#1F2937', borderRadius: '8px', color: '#D1D5DB', fontSize: '13px', textDecoration: 'none' }}>전략 관리</a>
          <a href="/settings" style={{ padding: '6px 12px', background: '#1F2937', borderRadius: '8px', color: '#D1D5DB', fontSize: '13px', textDecoration: 'none' }}>API 설정</a>
          <button onClick={logout} style={{ padding: '6px 12px', background: 'transparent', border: 'none', color: '#6B7280', fontSize: '13px', cursor: 'pointer' }}>로그아웃</button>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
        {/* 제어 버튼 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold' }}>대시보드</h2>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#9CA3AF' }}>자동매매</span>
            <button onClick={toggleEngine} disabled={loading}
              style={{ position: 'relative', width: '56px', height: '28px', borderRadius: '999px', border: 'none', cursor: 'pointer', background: engineStatus === 'RUNNING' ? '#16a34a' : '#4B5563', transition: 'background 0.2s' }}>
              <span style={{ position: 'absolute', top: '4px', left: engineStatus === 'RUNNING' ? '32px' : '4px', width: '20px', height: '20px', borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
            </button>
            <button onClick={emergencyStop}
              style={{ padding: '8px 16px', background: '#DC2626', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>
              🚨 긴급 정지
            </button>
          </div>
        </div>

        {/* 지표 카드 */}
        {data ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '16px' }}>
              {card('포지션 수', `${data.positions.count}개`, '#F9FAFB')}
              {card('미실현 손익', `${data.positions.totalUnrealizedPnl >= 0 ? '+' : ''}${fmtUsdt(data.positions.totalUnrealizedPnl)} USDT`, data.positions.totalUnrealizedPnl >= 0 ? '#4ADE80' : '#F87171')}
              {card('오늘 실현 손익', `${data.todayStats.realizedPnl >= 0 ? '+' : ''}${fmtUsdt(data.todayStats.realizedPnl)} USDT`, data.todayStats.realizedPnl >= 0 ? '#4ADE80' : '#F87171', `거래 ${data.todayStats.trades}회`)}
              {card('활성 전략', `${data.strategies.enabled} / ${data.strategies.total}`, '#F9FAFB', '개')}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              {card('오늘 거래 횟수', `${data.engine.dailyTrades}회`)}
              {card('연속 손실', `${data.engine.consecLossCount}회`, data.engine.consecLossCount > 0 ? '#F87171' : '#4ADE80')}
              {card('승률', `${data.todayStats.trades > 0 ? (data.todayStats.winRate * 100).toFixed(0) : 0}%`)}
            </div>
          </>
        ) : (
          <p style={{ color: '#6B7280', textAlign: 'center', padding: '64px' }}>데이터 로딩 중...</p>
        )}
      </div>
    </div>
  );
}
