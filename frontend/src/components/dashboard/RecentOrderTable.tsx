'use client';
import { useEffect, useState, useCallback } from 'react';
import { fetchOrders, OrderInfo } from '@/lib/futuresApi';
import { getApiErrorMessage } from '@/lib/utils';
import { useChartStore } from '@/store/chartStore';

type OrderSource = 'binance' | 'db' | '';

const STATUS_COLOR: Record<string, string> = {
  FILLED: '#4ADE80', CANCELED: '#6B7280',
  NEW: '#EAB308', PARTIALLY_FILLED: '#60A5FA', ERROR: '#F87171',
};

function fmtTime(ms: number) {
  return new Date(ms).toLocaleString('ko-KR', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Seoul',
  });
}

export function RecentOrderTable() {
  const { symbol } = useChartStore();
  const [orders, setOrders] = useState<OrderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [source, setSource] = useState<OrderSource>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await fetchOrders(symbol, 20);
      setOrders(result.data);
      setSource((result.source as OrderSource) ?? '');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, '주문 조회 실패'));
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ background: '#111827', border: '1px solid #1F2937', borderRadius: '12px', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #1F2937', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <p style={{ fontSize: '13px', fontWeight: '600', color: '#D1D5DB' }}>최근 주문</p>
          {source && (
            <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '4px', background: '#1F2937', color: '#6B7280' }}>
              {source === 'binance' ? 'Binance' : 'DB'}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: '#4B5563' }}>{symbol}</span>
          <button onClick={load} style={{ fontSize: '11px', color: '#EAB308', background: 'none', border: 'none', cursor: 'pointer' }}>↻ 새로고침</button>
          <a href="/orders" style={{ fontSize: '12px', color: '#EAB308', textDecoration: 'none' }}>전체 보기</a>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '24px', textAlign: 'center', color: '#4B5563', fontSize: '13px' }}>조회 중...</div>
      ) : error ? (
        <div style={{ padding: '16px', textAlign: 'center' }}>
          <p style={{ fontSize: '12px', color: '#F87171', marginBottom: '8px' }}>⚠ {error}</p>
          <p style={{ fontSize: '11px', color: '#4B5563' }}>API 연결 및 권한을 확인하세요.</p>
        </div>
      ) : orders.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', color: '#4B5563', fontSize: '13px' }}>최근 주문 없음</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: '#6B7280', borderBottom: '1px solid #1F2937' }}>
                {['시간(KST)','종목','방향','타입','평균가','수량','손익','상태'].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 'normal', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o, i) => {
                const pnl = parseFloat(o.realizedPnl ?? '0');
                return (
                  <tr key={`${o.orderId ?? i}`} style={{ borderBottom: '1px solid rgba(31,41,55,0.6)' }}>
                    <td style={{ padding: '8px 10px', color: '#6B7280', whiteSpace: 'nowrap' }}>{fmtTime(o.time ?? o.updateTime)}</td>
                    <td style={{ padding: '8px 10px', fontWeight: '500' }}>{o.symbol ?? symbol}</td>
                    <td style={{ padding: '8px 10px', color: o.side === 'BUY' ? '#4ADE80' : '#F87171', fontWeight: 'bold' }}>{o.side}</td>
                    <td style={{ padding: '8px 10px', color: '#9CA3AF' }}>{o.type}</td>
                    <td style={{ padding: '8px 10px' }}>{parseFloat(o.avgPrice ?? '0') > 0 ? parseFloat(o.avgPrice).toLocaleString(undefined, { maximumFractionDigits: 4 }) : '-'}</td>
                    <td style={{ padding: '8px 10px', color: '#D1D5DB' }}>{o.executedQty}</td>
                    <td style={{ padding: '8px 10px', color: pnl > 0 ? '#4ADE80' : pnl < 0 ? '#F87171' : '#6B7280', fontWeight: '500' }}>
                      {pnl !== 0 ? `${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}` : '-'}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{ fontSize: '11px', color: STATUS_COLOR[o.status] ?? '#9CA3AF' }}>{o.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
