'use client';
import { mockSignals } from '@/mock/strategySignals.mock';

export function StrategySignalLog() {
  const fmt = (iso: string) => new Date(iso).toLocaleString('ko-KR', { hour:'2-digit', minute:'2-digit', second:'2-digit' });

  return (
    <div style={{ background: '#111827', border: '1px solid #1F2937', borderRadius: '12px', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #1F2937' }}>
        <p style={{ fontSize: '13px', fontWeight: '600', color: '#D1D5DB' }}>전략 신호 로그</p>
      </div>
      <div style={{ padding: '8px' }}>
        {mockSignals.map(s => (
          <div key={s.id} style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '8px', borderRadius: '6px', marginBottom: '4px',
            background: s.signal === 'BLOCKED' ? 'rgba(239,68,68,0.05)' : 'rgba(74,222,128,0.05)',
          }}>
            <span suppressHydrationWarning style={{ fontSize: '10px', color: '#6B7280', width: '60px', flexShrink: 0 }}>{fmt(s.time)}</span>
            <span style={{
              fontSize: '11px', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px', flexShrink: 0,
              background: s.signal === 'LONG' ? 'rgba(74,222,128,0.15)' : s.signal === 'SHORT' ? 'rgba(248,113,113,0.15)' : 'rgba(156,163,175,0.15)',
              color: s.signal === 'LONG' ? '#4ADE80' : s.signal === 'SHORT' ? '#F87171' : '#9CA3AF',
            }}>{s.signal}</span>
            <span style={{ fontSize: '12px', color: '#D1D5DB', flex: 1 }}>{s.symbol} · {s.reason}</span>
            <span style={{ fontSize: '11px', color: '#6B7280' }}>{s.strategy}</span>
            {s.blockReason && <span style={{ fontSize: '11px', color: '#F87171' }}>❌ {s.blockReason}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
