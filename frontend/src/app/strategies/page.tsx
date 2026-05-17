'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/utils';
import type { Strategy } from '@/types/trading';
import { fmtUsdt } from '@/lib/utils';

const TYPES: Record<string, string> = {
  MA_CROSS: 'EMA 크로스', RSI_EXTREME: 'RSI', BOLLINGER_BREAKOUT: '볼린저밴드',
  HIGH_LOW_BREAKOUT: '고점/저점 돌파', VOLUME_SPIKE: '거래량 급증',
};

export default function StrategiesPage() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const router = useRouter();

  const load = useCallback(() => {
    api.get('/strategies')
      .then(r => setStrategies(r.data.data as Strategy[]))
      .catch(() => router.push('/login'));
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (id: string) => {
    try {
      await api.patch(`/strategies/${id}/toggle`);
      load();
    } catch (error: unknown) { alert(getApiErrorMessage(error, '오류')); }
  };

  const del = async (id: string, name: string) => {
    if (!confirm(`"${name}" 전략을 삭제하시겠습니까?`)) return;
    try { await api.delete(`/strategies/${id}`); load(); }
    catch (error: unknown) { alert(getApiErrorMessage(error, '삭제 실패')); }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#030712', padding: '24px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <a href="/dashboard" style={{ color: '#EAB308', textDecoration: 'none' }}>← 대시보드</a>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold' }}>전략 관리</h2>
          </div>
          <a href="/strategies/new" style={{ padding: '8px 16px', background: '#EAB308', color: '#111827', fontWeight: 'bold', borderRadius: '8px', textDecoration: 'none', fontSize: '14px' }}>+ 전략 추가</a>
        </div>

        {strategies.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px', color: '#6B7280' }}>
            <p style={{ fontSize: '48px', marginBottom: '12px' }}>📊</p>
            <p>등록된 전략이 없습니다.</p>
            <a href="/strategies/new" style={{ color: '#EAB308' }}>전략 추가하기</a>
          </div>
        ) : strategies.map(s => {
          const winRate = s.totalTrades > 0 ? ((s.winTrades / s.totalTrades) * 100).toFixed(0) : '—';
          return (
            <div key={s.id} style={{ background: '#111827', border: `1px solid ${s.enabled ? '#166534' : '#1F2937'}`, borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <button onClick={() => toggle(s.id)}
                    style={{ width: '32px', height: '32px', borderRadius: '50%', border: 'none', cursor: 'pointer', background: s.enabled ? '#166534' : '#374151', color: s.enabled ? '#4ADE80' : '#9CA3AF', fontSize: '16px' }}>
                    ⏻
                  </button>
                  <div>
                    <p style={{ fontWeight: '600' }}>{s.name}</p>
                    <p style={{ fontSize: '12px', color: '#6B7280' }}>{TYPES[s.type]} · {s.symbol} · {s.timeframe} · 레버리지 {s.leverage}x</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <a href={`/strategies/${s.id}`} style={{ padding: '4px 10px', background: '#1F2937', color: '#D1D5DB', borderRadius: '6px', textDecoration: 'none', fontSize: '13px' }}>수정</a>
                  <button onClick={() => del(s.id, s.name)} style={{ padding: '4px 10px', background: '#450a0a', color: '#FCA5A5', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>삭제</button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #1F2937' }}>
                {[['총 거래', `${s.totalTrades}회`], ['승률', `${winRate}%`], ['누적 손익', `${fmtUsdt(s.totalPnl)} USDT`, s.totalPnl >= 0 ? '#4ADE80' : '#F87171'], ['TP/SL', `${s.takeProfitPct}% / ${s.stopLossPct}%`]].map(([l,v,c]) => (
                  <div key={l as string}>
                    <p style={{ fontSize: '11px', color: '#6B7280' }}>{l}</p>
                    <p style={{ fontSize: '13px', fontWeight: '500', color: (c as string) ?? '#F9FAFB', marginTop: '2px' }}>{v}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
