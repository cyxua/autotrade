'use client';
import { useState } from 'react';
import { useAccountStore } from '@/store/accountStore';
import { useAutoTradeStore } from '@/store/autoTradeStore';
import { useRiskStore } from '@/store/riskStore';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/utils';

export function PositionSummaryPanel() {
  const { positions, balance, isLoading, error } = useAccountStore();
  const { dailyPnl, consecLossCount } = useAutoTradeStore();
  const { maxDailyLossUsdt, consecutiveLossStop } = useRiskStore();
  const [closingSymbol, setClosingSymbol] = useState<string | null>(null);

  const fmtPrice = (v: string | number) => parseFloat(String(v)).toLocaleString(undefined, { maximumFractionDigits: 4 });
  const fmtPnl = (v: string | number) => {
    const n = parseFloat(String(v));
    return `${n >= 0 ? '+' : ''}${n.toFixed(2)} USDT`;
  };

  const handleClosePosition = async (symbol: string) => {
    if (!confirm(`${symbol} 포지션을 시장가로 청산하시겠습니까?`)) return;
    setClosingSymbol(symbol);
    try {
      await api.post('/engine/close-position', { symbol });
      alert(`✅ ${symbol} 청산 완료`);
    } catch (error: unknown) {
      alert(getApiErrorMessage(error, '청산 실패'));
    } finally {
      setClosingSymbol(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* 잔고 카드 */}
      <div style={{ background: '#111827', border: '1px solid #1F2937', borderRadius: '12px', padding: '16px' }}>
        <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '12px' }}>계좌 잔고 (USDT)</p>
        {isLoading && !balance ? (
          <p style={{ fontSize: '12px', color: '#4B5563' }}>조회 중...</p>
        ) : error && !balance ? (
          <p style={{ fontSize: '12px', color: '#F87171' }}>⚠ {error}</p>
        ) : balance ? (
          <>
            {[
              ['지갑 잔고', fmtPrice(balance.walletBalance)],
              ['사용 가능', fmtPrice(balance.availableBalance)],
            ].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', color: '#6B7280' }}>{l}</span>
                <span style={{ fontSize: '12px', color: '#D1D5DB', fontWeight: '500' }}>{v}</span>
              </div>
            ))}
            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #374151', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', color: '#6B7280' }}>미실현 손익</span>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: parseFloat(String(balance.crossUnPnl ?? 0)) >= 0 ? '#4ADE80' : '#F87171' }}>
                {fmtPnl(balance.crossUnPnl ?? 0)}
              </span>
            </div>
          </>
        ) : (
          <p style={{ fontSize: '12px', color: '#4B5563' }}>API 연결 후 표시</p>
        )}
      </div>

      {/* 현재 포지션 */}
      <div style={{ background: '#111827', border: '1px solid #1F2937', borderRadius: '12px', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
          <p style={{ fontSize: '12px', color: '#6B7280' }}>현재 포지션</p>
          <span style={{ fontSize: '11px', color: '#4B5563' }}>{positions.length}개</span>
        </div>

        {isLoading && positions.length === 0 ? (
          <p style={{ fontSize: '12px', color: '#4B5563' }}>조회 중...</p>
        ) : positions.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#4B5563', textAlign: 'center', padding: '12px 0' }}>포지션 없음</p>
        ) : (
          positions.map(p => {
            const pnl = parseFloat(p.unRealizedProfit);
            return (
              <div key={`${p.symbol}-${p.side}`} style={{ borderRadius: '8px', padding: '12px', background: '#1F2937', marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{p.symbol}</span>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: p.side === 'LONG' ? '#4ADE80' : '#F87171' }}>
                    {p.side} {p.leverage}x
                  </span>
                </div>
                {[
                  ['진입가', `$${fmtPrice(p.entryPrice)}`],
                  ['마크가', `$${fmtPrice(p.markPrice)}`],
                  ['청산가', `$${fmtPrice(p.liquidationPrice)}`],
                  ['마진', p.marginType],
                ].map(([l, v]) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', color: '#6B7280' }}>{l}</span>
                    <span style={{ fontSize: '11px', color: '#D1D5DB' }}>{v}</span>
                  </div>
                ))}
                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #374151', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', color: '#6B7280' }}>미실현 손익</span>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: pnl >= 0 ? '#4ADE80' : '#F87171' }}>
                    {fmtPnl(p.unRealizedProfit)}
                  </span>
                </div>
                <button
                  onClick={() => handleClosePosition(p.symbol)}
                  disabled={closingSymbol === p.symbol}
                  style={{
                    marginTop: '10px', width: '100%', padding: '8px',
                    background: closingSymbol === p.symbol ? '#374151' : '#7C3AED',
                    color: 'white', border: 'none', borderRadius: '6px',
                    fontSize: '12px', fontWeight: 'bold', cursor: closingSymbol === p.symbol ? 'not-allowed' : 'pointer',
                  }}
                >
                  {closingSymbol === p.symbol ? '청산 중...' : '✋ 수동 청산 (시장가)'}
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* 리스크 상태 */}
      <div style={{ background: '#111827', border: '1px solid #1F2937', borderRadius: '12px', padding: '16px' }}>
        <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '12px' }}>리스크 상태</p>
        {[
          { label: '1일 손실', value: `${(dailyPnl).toFixed(2)} USDT`, limit: maxDailyLossUsdt > 0 ? `/ ${maxDailyLossUsdt}` : '', warn: dailyPnl < -(maxDailyLossUsdt * 0.8) },
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
