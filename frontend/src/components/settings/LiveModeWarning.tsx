'use client';
import { useTradingModeStore } from '@/store/tradingModeStore';

export function LiveModeWarning({ compact = false }: { compact?: boolean }) {
  const { mode } = useTradingModeStore();
  if (mode !== 'LIVE') return null;

  return (
    <div style={{
      background: 'rgba(239,68,68,0.1)',
      border: '1px solid rgba(239,68,68,0.4)',
      borderRadius: compact ? '8px' : '12px',
      padding: compact ? '8px 12px' : '12px 16px',
      color: '#FCA5A5',
      fontSize: compact ? '12px' : '13px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    }}>
      ⚠️ 실거래 모드입니다. 실제 자산에 영향을 줄 수 있습니다.
    </div>
  );
}
