'use client';
import { mockOrders } from '@/mock/orders.mock';

export function RecentOrderTable() {
  const fmt = (iso: string) => new Date(iso).toLocaleString('ko-KR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });

  return (
    <div style={{ background: '#111827', border: '1px solid #1F2937', borderRadius: '12px', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #1F2937', display: 'flex', justifyContent: 'space-between' }}>
        <p style={{ fontSize: '13px', fontWeight: '600', color: '#D1D5DB' }}>최근 주문</p>
        <a href="/orders" style={{ fontSize: '12px', color: '#EAB308', textDecoration: 'none' }}>전체 보기</a>
      </div>
      <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ color: '#6B7280', borderBottom: '1px solid #1F2937' }}>
            {['시간','종목','방향','전략','손익','사유'].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 'normal' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {mockOrders.map(o => {
            const pnl = o.realizedPnl ?? 0;
            return (
              <tr key={o.id} style={{ borderBottom: '1px solid #1F2937' }}>
                <td style={{ padding: '8px 12px', color: '#6B7280' }}>{fmt(o.createdAt)}</td>
                <td style={{ padding: '8px 12px', fontWeight: '500' }}>{o.symbol}</td>
                <td style={{ padding: '8px 12px', color: o.side === 'LONG' ? '#4ADE80' : '#F87171', fontWeight: 'bold' }}>{o.side}</td>
                <td style={{ padding: '8px 12px', color: '#9CA3AF' }}>{o.strategy}</td>
                <td style={{ padding: '8px 12px', color: pnl > 0 ? '#4ADE80' : pnl < 0 ? '#F87171' : '#9CA3AF', fontWeight: '500' }}>
                  {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)} USDT
                </td>
                <td style={{ padding: '8px 12px', color: '#6B7280' }}>{o.exitReason ?? o.entryReason}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
