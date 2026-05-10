'use client';
import { mockPositions } from '@/mock/positions.mock';
import { useRiskStore } from '@/store/riskStore';
import { useAutoTradeStore } from '@/store/autoTradeStore';

export function PositionSummaryPanel() {
  const { dailyPnl, consecLossCount } = useAutoTradeStore();
  const { maxDailyLossUsdt, consecutiveLossStop } = useRiskStore();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ background: '#111827', border: '1px solid #1F2937', borderRadius: '12px', padding: '16px' }}>
        <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '12px' }}>현재 포지션</p>
        {mockPositions.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#4B5563', textAlign: 'center', padding: '16px 0' }}>포지션 없음</p>
        ) : mockPositions.map(p => (
          <div key={p.id} style={{ borderRadius: '8px', padding: '12px', background: '#1F2937' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{p.symbol}</span>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: p.side === 'LONG' ? '#4ADE80' : '#F87171' }}>{p.side} {p.leverage}x</span>
            </div>
            {[['진입가', `$${p.entryPrice.toLocaleString()}`], ['현재가', `$${p.markPrice.toLocaleString()}`], ['TP', `$${p.takeProfitPrice.toLocaleString()}`], ['SL', `$${p.stopLossPrice.toLocaleString()}`]].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '11px', color: '#6B7280' }}>{l}</span>
                <span style={{ fontSize: '11px', color: '#D1D5DB' }}>{v}</span>
              </div>
            ))}
            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #374151', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', color: '#6B7280' }}>미실현 손익</span>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: p.unrealizedPnl >= 0 ? '#4ADE80' : '#F87171' }}>
                {p.unrealizedPnl >= 0 ? '+' : ''}{p.unrealizedPnl.toFixed(2)} USDT
              </span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: '#111827', border: '1px solid #1F2937', borderRadius: '12px', padding: '16px' }}>
        <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '12px' }}>리스크 상태</p>
        {[
          { label: '1일 손실', value: `${dailyPnl.toFixed(2)} USDT`, limit: maxDailyLossUsdt > 0 ? `/ ${maxDailyLossUsdt}` : '', warn: dailyPnl < -(maxDailyLossUsdt * 0.8) },
          { label: '연속 손실', value: `${consecLossCount}회`, limit: consecutiveLossStop > 0 ? `/ ${consecutiveLossStop}회` : '', warn: consecLossCount >= consecutiveLossStop * 0.7 },
        ].map(r => (
          <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: '#9CA3AF' }}>{r.label}</span>
            <span style={{ fontSize: '12px', color: r.warn ? '#F87171' : '#D1D5DB' }}>
              {r.value} <span style={{ color: '#4B5563' }}>{r.limit}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
