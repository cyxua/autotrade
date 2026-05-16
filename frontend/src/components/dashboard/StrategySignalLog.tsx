'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';

interface BlockLog {
  id:         string;
  symbol:     string;
  strategyId: string | null;
  reason:     string;
  detail:     any;
  createdAt:  string;
}

const REASON_COLOR: Record<string, string> = {
  CONFLICTING_SIGNALS:         '#F59E0B',
  ENTRY_ORDER_UNPROTECTED:     '#EF4444',
  ENTRY_ORDER_STATUS_UNKNOWN:  '#EF4444',
  SL_ORDER_FAILED:             '#EF4444',
  TP_ORDER_FAILED:             '#F97316',
  POSITION_ALREADY_OPEN:       '#60A5FA',
  MAX_POSITIONS_REACHED:       '#60A5FA',
  DAILY_LOSS_EXCEEDED:         '#A78BFA',
  CONSEC_LOSS_EXCEEDED:        '#A78BFA',
  DAILY_TRADES_EXCEEDED:       '#9CA3AF',
  INSUFFICIENT_BALANCE:        '#FBBF24',
  MIN_NOTIONAL_NOT_MET:        '#FBBF24',
  MIN_NOTIONAL_AFTER_ROUNDING: '#FBBF24',
};

function summarizeDetail(detail: any): string {
  if (!detail) return '';
  if (typeof detail === 'string') return detail.slice(0, 60);
  const entries = Object.entries(detail).slice(0, 3);
  return entries.map(([k, v]) => `${k}:${v}`).join(' ');
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function StrategySignalLog() {
  const [logs, setLogs]       = useState<BlockLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get('/settings/risk/block-logs?limit=30');
      setLogs(r.data.data?.items ?? []);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div style={{ background: '#111827', border: '1px solid #1F2937', borderRadius: '12px', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #1F2937', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ fontSize: '13px', fontWeight: '600', color: '#D1D5DB' }}>리스크 차단 로그</p>
        {error && <span style={{ fontSize: '11px', color: '#EF4444' }}>⚠ API 오류</span>}
        {!error && !loading && (
          <span style={{ fontSize: '10px', color: '#4B5563' }}>15초마다 갱신</span>
        )}
      </div>

      <div style={{ padding: '8px', maxHeight: '280px', overflowY: 'auto' }}>
        {loading && (
          <p style={{ textAlign: 'center', color: '#4B5563', fontSize: '12px', padding: '16px' }}>로딩 중...</p>
        )}

        {!loading && logs.length === 0 && (
          <p style={{ textAlign: 'center', color: '#4B5563', fontSize: '12px', padding: '16px' }}>
            차단 이력 없음
          </p>
        )}

        {!loading && logs.map(log => {
          const color = REASON_COLOR[log.reason] ?? '#9CA3AF';
          return (
            <div key={log.id} style={{
              display: 'grid',
              gridTemplateColumns: '52px 70px 1fr auto',
              alignItems: 'center', gap: '8px',
              padding: '7px 8px', borderRadius: '6px', marginBottom: '3px',
              background: 'rgba(255,255,255,0.02)',
            }}>
              <span suppressHydrationWarning style={{ fontSize: '10px', color: '#6B7280' }}>
                {fmt(log.createdAt)}
              </span>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#D1D5DB' }}>
                {log.symbol}
              </span>
              <span style={{ fontSize: '11px', color, fontWeight: '600' }}>
                {log.reason}
                {log.detail && (
                  <span style={{ fontWeight: 'normal', color: '#6B7280', marginLeft: '6px', fontSize: '10px' }}>
                    {summarizeDetail(log.detail)}
                  </span>
                )}
              </span>
              {log.strategyId && (
                <span style={{ fontSize: '10px', color: '#4B5563', whiteSpace: 'nowrap' }}>
                  {log.strategyId.slice(0, 8)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
