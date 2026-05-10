'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useTradingModeStore } from '@/store/tradingModeStore';
import { useAutoTradeStore } from '@/store/autoTradeStore';
import { useApiConnectionStore } from '@/store/apiConnectionStore';
import { useRiskStore } from '@/store/riskStore';
import { LiveStartConfirmModal } from '@/components/modals/LiveStartConfirmModal';

export function AutoTradeToggle() {
  const { mode } = useTradingModeStore();
  const { status, setStatus } = useAutoTradeStore();
  const { isConnected, hasSecret } = useApiConnectionStore();
  const { maxLeverage, maxDailyLossUsdt, maxPositions } = useRiskStore();
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const isRunning = status === 'RUNNING';
  const isEmergency = status === 'EMERGENCY_STOPPED';

  const liveChecks = [
    { label: 'API 연결 성공', passed: isConnected },
    { label: 'Secret Key 저장 완료', passed: hasSecret },
    { label: '긴급 정지 상태 아님', passed: !isEmergency },
    { label: '1일 최대 손실 설정됨', passed: maxDailyLossUsdt > 0 },
    { label: '최대 레버리지 설정됨', passed: maxLeverage > 0 },
    { label: '최대 포지션 설정됨', passed: maxPositions > 0 },
  ];

  const handleToggle = async () => {
    if (isRunning) {
      setLoading(true);
      try {
        await api.post('/engine/stop');
        setStatus('STOPPED');
      } catch (e: any) {
        alert(e.response?.data?.error?.message ?? '중지 실패');
      } finally { setLoading(false); }
      return;
    }
    if (mode === 'LIVE') {
      setShowModal(true);
      return;
    }
    setLoading(true);
    try {
      await api.post('/engine/start');
      setStatus('RUNNING');
    } catch (e: any) {
      alert(e.response?.data?.error?.message ?? '시작 실패');
    } finally { setLoading(false); }
  };

  const handleLiveConfirm = async () => {
    setShowModal(false);
    setLoading(true);
    try {
      await api.post('/engine/start');
      setStatus('RUNNING');
    } catch (e: any) {
      alert(e.response?.data?.error?.message ?? '시작 실패');
    } finally { setLoading(false); }
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '13px', color: '#9CA3AF' }}>자동매매</span>
        <button onClick={handleToggle} disabled={loading || isEmergency}
          style={{
            position: 'relative', width: '52px', height: '26px',
            borderRadius: '999px', border: 'none',
            cursor: loading || isEmergency ? 'not-allowed' : 'pointer',
            background: isRunning ? '#16a34a' : '#4B5563',
            transition: 'background 0.2s',
            opacity: isEmergency ? 0.5 : 1,
          }}>
          <span style={{
            position: 'absolute', top: '3px',
            left: isRunning ? '29px' : '3px',
            width: '20px', height: '20px',
            borderRadius: '50%', background: 'white',
            transition: 'left 0.2s',
          }} />
        </button>
        {isEmergency && (
          <span style={{ fontSize: '11px', color: '#F87171' }}>긴급정지됨</span>
        )}
      </div>

      {showModal && (
        <LiveStartConfirmModal
          checks={liveChecks}
          onConfirm={handleLiveConfirm}
          onCancel={() => setShowModal(false)}
        />
      )}
    </>
  );
}
