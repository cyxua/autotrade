'use client';
import { getApiErrorMessage } from '@/lib/utils';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAutoTradeStore } from '@/store/autoTradeStore';

interface StopResult {
  closePositionsRequested: boolean;
  positionsFound:         number;
  closeAttempts:          number;
  closeSuccess:           number;
  canceledNormalOrders:   number;
  canceledAlgoOrders:     number;
  cancelErrors:  { symbol: string; error: string }[];
  closeErrors:   { symbol: string; reason: string; message?: string; posAmt?: string }[];
  positionFetchError: string | null;
}

export function EmergencyStopButton() {
  const [open, setOpen]         = useState(false);
  const [closePos, setClosePos] = useState(true);   // 기본값 true
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<StopResult | null>(null);
  const { status, setStatus }   = useAutoTradeStore();

  const isEmergencyStopped = status === 'EMERGENCY_STOPPED';

  const handleStop = async () => {
    setLoading(true);
    try {
      const res = await api.post('/engine/emergency-stop', { closePositions: closePos });
      const r   = res.data.data as StopResult;
      setStatus('EMERGENCY_STOPPED');
      setOpen(false);
      setResult(r);
    } catch (error: unknown) {
      alert(getApiErrorMessage(error, '긴급 정지 오류'));
    } finally { setLoading(false); }
  };

  const handleReset = async () => {
    setLoading(true);
    try {
      await api.post('/engine/reset-emergency');
      setStatus('STOPPED');
      setResult(null);
    } catch (error: unknown) { alert(getApiErrorMessage(error, '오류')); }
    finally { setLoading(false); }
  };

  const hasErrors = result && (
    result.closeErrors.length > 0 ||
    result.cancelErrors.length > 0 ||
    (result.closePositionsRequested && result.closeSuccess < result.closeAttempts)
  );

  if (isEmergencyStopped) {
    return (
      <div>
        <button onClick={handleReset} disabled={loading} style={{
          padding: '8px 14px', background: '#16A34A', color: 'white',
          border: 'none', borderRadius: '8px', fontWeight: 'bold',
          cursor: 'pointer', fontSize: '13px', opacity: loading ? 0.6 : 1,
        }}>
          {loading ? '처리중...' : '✅ 긴급정지 해제'}
        </button>

        {/* 긴급 정지 결과 표시 */}
        {result && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              background: '#111827', border: `1px solid ${hasErrors ? 'rgba(239,68,68,0.6)' : 'rgba(74,222,128,0.4)'}`,
              borderRadius: '16px', padding: '24px', width: '440px', maxHeight: '80vh', overflowY: 'auto',
            }}>
              <h3 style={{ color: hasErrors ? '#F87171' : '#4ADE80', fontWeight: 'bold', marginBottom: '16px' }}>
                {hasErrors ? '⚠️ 긴급 정지 — 일부 실패' : '✅ 긴급 정지 완료'}
              </h3>

              {/* 요약 */}
              <div style={{ fontSize: '12px', color: '#9CA3AF', marginBottom: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <span>일반 주문 취소: <b style={{ color: '#D1D5DB' }}>{result.canceledNormalOrders}건</b></span>
                <span>Algo 주문 취소: <b style={{ color: '#D1D5DB' }}>{result.canceledAlgoOrders}건</b></span>
                {result.closePositionsRequested && (
                  <>
                    <span>포지션 발견: <b style={{ color: '#D1D5DB' }}>{result.positionsFound}개</b></span>
                    <span>청산 성공: <b style={{ color: result.closeSuccess === result.closeAttempts ? '#4ADE80' : '#F87171' }}>
                      {result.closeSuccess}/{result.closeAttempts}
                    </b></span>
                  </>
                )}
              </div>

              {/* 포지션 미청산 경고 */}
              {result.closeErrors.length > 0 && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                  <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#F87171', marginBottom: '8px' }}>⚠️ 포지션 청산 문제</p>
                  {result.closeErrors.map((e, i) => (
                    <div key={i} style={{ fontSize: '11px', color: '#FCA5A5', marginBottom: '4px' }}>
                      <b>{e.symbol}</b> — {e.reason}
                      {e.posAmt && <span style={{ color: '#9CA3AF' }}> (잔량: {e.posAmt})</span>}
                      {e.message && <div style={{ color: '#6B7280', marginTop: '2px' }}>{e.message}</div>}
                    </div>
                  ))}
                  <p style={{ fontSize: '11px', color: '#F87171', marginTop: '8px' }}>
                    → Binance 앱에서 수동으로 포지션을 확인하고 청산하세요.
                  </p>
                </div>
              )}

              {/* 취소 에러 */}
              {result.cancelErrors.length > 0 && (
                <div style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '8px', padding: '10px', marginBottom: '12px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 'bold', color: '#FBBF24', marginBottom: '6px' }}>주문 취소 일부 실패</p>
                  {result.cancelErrors.map((e, i) => (
                    <div key={i} style={{ fontSize: '10px', color: '#FCD34D' }}>{e.symbol}: {e.error}</div>
                  ))}
                </div>
              )}

              <button onClick={() => setResult(null)} style={{
                width: '100%', padding: '10px', background: '#374151',
                color: '#D1D5DB', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px',
              }}>닫기</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <button onClick={() => setOpen(true)} style={{
        padding: '8px 14px', background: '#DC2626', color: 'white',
        border: 'none', borderRadius: '8px', fontWeight: 'bold',
        cursor: 'pointer', fontSize: '13px',
      }}>🚨 긴급 정지</button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#111827', border: '1px solid rgba(239,68,68,0.5)', borderRadius: '16px', padding: '24px', width: '360px' }}>
            <h3 style={{ color: '#F87171', fontWeight: 'bold', marginBottom: '12px' }}>⚠️ 긴급 정지 확인</h3>
            <p style={{ fontSize: '13px', color: '#D1D5DB', marginBottom: '16px' }}>
              자동매매를 즉시 중지하고 미체결 주문(일반 + Algo TP/SL)을 전부 취소합니다.
            </p>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', cursor: 'pointer', fontSize: '13px', color: '#D1D5DB' }}>
              <input type="checkbox" checked={closePos} onChange={e => setClosePos(e.target.checked)}
                style={{ accentColor: '#EF4444', width: '16px', height: '16px' }} />
              현재 포지션도 시장가 청산 <span style={{ color: '#EAB308', fontSize: '11px' }}>(권장)</span>
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setOpen(false)} style={{ flex: 1, padding: '10px', background: '#374151', color: '#D1D5DB', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>취소</button>
              <button onClick={handleStop} disabled={loading} style={{ flex: 1, padding: '10px', background: '#DC2626', color: 'white', fontWeight: 'bold', border: 'none', borderRadius: '8px', cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
                {loading ? '처리중...' : '긴급 정지'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
