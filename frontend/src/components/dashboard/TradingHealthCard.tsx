'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface HealthFlags {
  hasOpenPosition:       boolean;
  hasOpenAlgoOrders:     boolean;
  hasUnprotectedPosition:boolean;
  unprotectedPositions:  string[];
  hasCriticalRiskBlock:  boolean;
  criticalBlockReasons:  { reason: string; symbol: string; createdAt: string }[];
  isSafeToStartAutoTrade:  boolean;
  criticalWindowMinutes:   number;
  fetchErrors:             string[];
}
interface HealthData {
  engineState:      { status: string; dailyTrades: number; dailyPnl: number; consecLossCount: number; stopReason: string | null };
  currentPositions: { symbol: string; positionAmt: string; entryPrice: string; unrealizedProfit: string; leverage: string }[];
  openOrders:       { symbol: string; orderId: string | number; type: string; side: string }[];
  openAlgoOrders:   { symbol: string; algoId?: number; type: string; side: string; triggerPrice: string; algoStatus: string }[];
  recentRiskBlocks: { id: string; symbol: string; reason: string; detail: unknown; createdAt: string }[];
  healthFlags:      HealthFlags;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function TradingHealthCard() {
  const [data, setData]       = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [lastAt, setLastAt]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.get('/dashboard/trading-health');
      setData(r.data.data as HealthData);
      setLastAt(new Date().toLocaleTimeString('ko-KR'));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '조회 실패');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const flags = data?.healthFlags;

  const safeColor  = flags?.isSafeToStartAutoTrade ? '#4ADE80' : '#F87171';
  const safeText   = flags?.isSafeToStartAutoTrade ? '✅ 자동매매 시작 가능' : '⚠️ 자동매매 시작 불가';
  const safeBorder = flags?.isSafeToStartAutoTrade ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.4)';

  return (
    <div style={{ background: '#111827', border: `1px solid ${safeBorder}`, borderRadius: '12px', overflow: 'hidden' }}>
      {/* 헤더 */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #1F2937', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ fontSize: '13px', fontWeight: '600', color: '#D1D5DB' }}>거래 상태 점검</p>
          {lastAt && <p style={{ fontSize: '10px', color: '#4B5563', marginTop: '2px' }}>마지막 조회: {lastAt}</p>}
        </div>
        <button onClick={load} disabled={loading} style={{ background: '#1F2937', border: '1px solid #374151', color: '#EAB308', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '11px', opacity: loading ? 0.6 : 1 }}>
          {loading ? '조회 중...' : '↻ 새로고침'}
        </button>
      </div>

      <div style={{ padding: '12px 16px' }}>
        {/* API 오류 */}
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px', fontSize: '12px', color: '#F87171' }}>
            ⚠️ 조회 오류: {error}
          </div>
        )}

        {/* 자동매매 가능 여부 */}
        <div style={{ background: flags?.isSafeToStartAutoTrade ? 'rgba(74,222,128,0.08)' : 'rgba(239,68,68,0.08)', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px', textAlign: 'center' }}>
          <p style={{ fontSize: '14px', fontWeight: 'bold', color: safeColor }}>{data ? safeText : '—'}</p>
        </div>

        {/* fetch 오류 */}
        {(flags?.fetchErrors?.length ?? 0) > 0 && (
          <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '6px', padding: '8px', marginBottom: '10px' }}>
            <p style={{ fontSize: '11px', color: '#FBBF24', fontWeight: '600', marginBottom: '4px' }}>Binance API 오류</p>
            {flags!.fetchErrors.map((e, i) => <p key={i} style={{ fontSize: '10px', color: '#FCD34D' }}>{e}</p>)}
          </div>
        )}

        {/* 요약 수치 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
          {[
            { label: '열린 포지션', value: data?.currentPositions.length ?? '—', warn: (data?.currentPositions.length ?? 0) > 0 },
            { label: '일반 미체결 주문', value: data?.openOrders.length ?? '—', warn: (data?.openOrders.length ?? 0) > 0 },
            { label: 'Algo TP/SL 주문', value: data?.openAlgoOrders.length ?? '—', warn: false },
            { label: '연속 손실', value: data ? `${data.engineState.consecLossCount}회` : '—', warn: (data?.engineState.consecLossCount ?? 0) > 0 },
          ].map(({ label, value, warn }) => (
            <div key={label} style={{ background: '#1F2937', borderRadius: '6px', padding: '8px', textAlign: 'center' }}>
              <p style={{ fontSize: '10px', color: '#6B7280', marginBottom: '3px' }}>{label}</p>
              <p style={{ fontSize: '16px', fontWeight: 'bold', color: warn ? '#F87171' : '#D1D5DB' }}>{value}</p>
            </div>
          ))}
        </div>

        {/* 미보호 포지션 경고 */}
        {flags?.hasUnprotectedPosition && (
          <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '8px', padding: '10px', marginBottom: '10px' }}>
            <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#F87171', marginBottom: '4px' }}>⚠️ SL 미보호 포지션</p>
            {flags.unprotectedPositions.map(sym => (
              <p key={sym} style={{ fontSize: '11px', color: '#FCA5A5' }}>• {sym} — STOP_MARKET Algo 주문 없음</p>
            ))}
            <p style={{ fontSize: '10px', color: '#F87171', marginTop: '6px' }}>→ Binance API에서 수동 SL 주문을 설정하거나 포지션을 청산하세요.</p>
          </div>
        )}

        {/* 열린 포지션 목록 */}
        {(data?.currentPositions.length ?? 0) > 0 && (
          <div style={{ marginBottom: '10px' }}>
            <p style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: '600', marginBottom: '6px' }}>열린 포지션</p>
            {data!.currentPositions.map(p => {
              const pnl = parseFloat(p.unrealizedProfit);
              return (
                <div key={p.symbol} style={{ background: '#1F2937', borderRadius: '6px', padding: '8px', marginBottom: '4px', fontSize: '11px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 'bold', color: '#EAB308' }}>{p.symbol}</span>
                    <span style={{ color: pnl >= 0 ? '#4ADE80' : '#F87171', fontWeight: 'bold' }}>
                      {pnl >= 0 ? '+' : ''}{pnl.toFixed(4)} USDT
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6B7280', marginTop: '2px' }}>
                    <span>진입가: {p.entryPrice}</span>
                    <span>수량: {p.positionAmt}</span>
                    <span>레버리지: {p.leverage}x</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Algo 주문 목록 */}
        {(data?.openAlgoOrders.length ?? 0) > 0 && (
          <div style={{ marginBottom: '10px' }}>
            <p style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: '600', marginBottom: '6px' }}>Algo TP/SL 주문</p>
            {data!.openAlgoOrders.map((o, i) => (
              <div key={o.algoId ?? i} style={{ background: '#1F2937', borderRadius: '6px', padding: '8px', marginBottom: '4px', fontSize: '11px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 'bold', color: (o.type === 'TAKE_PROFIT_MARKET' || o.type === 'TAKE_PROFIT') ? '#4ADE80' : '#F87171' }}>
                    {o.symbol} {(o.type === 'TAKE_PROFIT_MARKET' || o.type === 'TAKE_PROFIT') ? 'TP' : 'SL'}
                  </span>
                  <span style={{ color: '#9CA3AF' }}>{o.algoStatus}</span>
                </div>
                <div style={{ color: '#6B7280', marginTop: '2px' }}>
                  트리거: {o.triggerPrice} | side: {o.side}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 치명 리스크 로그 */}
        {flags?.hasCriticalRiskBlock && (
          <div style={{ marginBottom: '10px' }}>
            <p style={{ fontSize: '11px', color: '#F87171', fontWeight: '600', marginBottom: '6px' }}>⚠️ 치명 리스크 로그</p>
            <p style={{ fontSize: '10px', color: '#6B7280', marginBottom: '4px' }}>※ 최근 {data?.healthFlags?.criticalWindowMinutes ?? 60}분 이내 기준</p>
            {flags.criticalBlockReasons.map((b, i) => (
              <div key={i} style={{ background: 'rgba(239,68,68,0.08)', borderRadius: '6px', padding: '6px 8px', marginBottom: '3px', fontSize: '10px' }}>
                <span style={{ color: '#F87171', fontWeight: 'bold' }}>{b.reason}</span>
                <span style={{ color: '#9CA3AF', marginLeft: '8px' }}>{b.symbol}</span>
                <span style={{ color: '#4B5563', marginLeft: '8px' }}>{fmt(b.createdAt)}</span>
              </div>
            ))}
          </div>
        )}

        {/* 최근 리스크 로그 (일반) */}
        {!flags?.hasCriticalRiskBlock && (data?.recentRiskBlocks.length ?? 0) > 0 && (
          <div>
            <p style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: '600', marginBottom: '6px' }}>최근 리스크 로그</p>
            {data!.recentRiskBlocks.slice(0, 5).map(b => (
              <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#6B7280', marginBottom: '2px' }}>
                <span style={{ color: '#9CA3AF' }}>{b.symbol}</span>
                <span>{b.reason}</span>
                <span>{fmt(b.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
