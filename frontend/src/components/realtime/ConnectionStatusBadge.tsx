'use client';
import { useRealtimeTickerStore } from '@/store/useRealtimeTickerStore';

export function ConnectionStatusBadge() {
  const status = useRealtimeTickerStore((s) => s.connectionStatus);

  const config = {
    연결됨:  { color: '#4ADE80', dot: '#4ADE80', label: '● 실시간' },
    연결중:  { color: '#F59E0B', dot: '#F59E0B', label: '◌ 연결중' },
    재연결중:{ color: '#F59E0B', dot: '#F59E0B', label: '↻ 재연결중' },
    끊김:   { color: '#F87171', dot: '#F87171', label: '✕ 연결끊김' },
  }[status];

  return (
    <span style={{
      fontSize: '10px',
      color: config.color,
      padding: '2px 6px',
      borderRadius: '4px',
      background: `${config.color}22`,
      fontWeight: 'bold',
    }}>
      {config.label}
    </span>
  );
}
