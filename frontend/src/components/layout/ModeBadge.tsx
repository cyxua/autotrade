'use client';
import { useTradingModeStore } from '@/store/tradingModeStore';

export function ModeBadge() {
  const { mode } = useTradingModeStore();
  const isLive = mode === 'LIVE';

  return (
    <span style={{
      fontSize: '12px', fontWeight: 'bold',
      padding: '4px 10px', borderRadius: '999px',
      background: isLive ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)',
      color: isLive ? '#F87171' : '#93C5FD',
      border: `1px solid ${isLive ? 'rgba(239,68,68,0.4)' : 'rgba(59,130,246,0.4)'}`,
    }}>
      {isLive ? '🔴 실거래' : '🔵 테스트넷'}
    </span>
  );
}
