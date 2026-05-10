'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAutoTradeStore } from '@/store/autoTradeStore';

export function EmergencyStopButton() {
  const [open, setOpen] = useState(false);
  const [closePos, setClosePos] = useState(false);
  const [loading, setLoading] = useState(false);
  const { setStatus } = useAutoTradeStore();

  const handle = async () => {
    setLoading(true);
    try {
      await api.post('/engine/emergency-stop', { closePositions: closePos });
      setStatus('EMERGENCY_STOPPED');
      setOpen(false);
      alert('🚨 긴급 정지 완료');
    } catch (e: any) {
      alert(e.response?.data?.error?.message ?? '오류');
    } finally { setLoading(false); }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} style={{
        padding: '8px 14px', background: '#DC2626', color: 'white',
        border: 'none', borderRadius: '8px', fontWeight: 'bold',
        cursor: 'pointer', fontSize: '13px',
      }}>🚨 긴급 정지</button>

      {open && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: '#111827', border: '1px solid rgba(239,68,68,0.5)',
            borderRadius: '16px', padding: '24px', width: '360px',
          }}>
            <h3 style={{ color: '#F87171', fontWeight: 'bold', marginBottom: '12px' }}>
              ⚠️ 긴급 정지 확인
            </h3>
            <p style={{ fontSize: '13px', color: '#D1D5DB', marginBottom: '16px' }}>
              자동매매를 즉시 중지하고 미체결 주문을 전부 취소합니다.
            </p>
            <label style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              marginBottom: '20px', cursor: 'pointer',
              fontSize: '13px', color: '#D1D5DB',
            }}>
              <input type="checkbox" checked={closePos}
                onChange={e => setClosePos(e.target.checked)}
                style={{ accentColor: '#EF4444', width: '16px', height: '16px' }} />
              현재 포지션도 시장가 청산
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setOpen(false)} style={{
                flex: 1, padding: '10px', background: '#374151',
                color: '#D1D5DB', border: 'none', borderRadius: '8px', cursor: 'pointer',
              }}>취소</button>
              <button onClick={handle} disabled={loading} style={{
                flex: 1, padding: '10px', background: '#DC2626',
                color: 'white', fontWeight: 'bold', border: 'none',
                borderRadius: '8px', cursor: 'pointer', opacity: loading ? 0.6 : 1,
              }}>
                {loading ? '처리중...' : '긴급 정지'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
