'use client';
import { useState } from 'react';
import { useNotificationStore, Notification } from '@/store/useNotificationStore';

const icons = { success: '✅', error: '🔴', warning: '⚠️', info: '🔵' };

function NotifRow({ n }: { n: Notification }) {
  return (
    <div style={{
      padding: '10px 12px',
      borderBottom: '1px solid #1F2937',
      background: n.read ? 'transparent' : '#1a2535',
      display: 'flex', gap: '8px',
    }}>
      <span>{icons[n.type]}</span>
      <div style={{ flex: 1 }}>
        <div style={{ color: '#F3F4F6', fontSize: '12px', fontWeight: 'bold' }}>{n.title}</div>
        <div style={{ color: '#9CA3AF', fontSize: '11px', marginTop: '2px' }}>{n.message}</div>
        <div suppressHydrationWarning style={{ color: '#6B7280', fontSize: '10px', marginTop: '3px' }}>
          {new Date(n.timestamp).toLocaleString('ko-KR', { hour12: true })}
        </div>
      </div>
    </div>
  );
}

export function NotificationPanel() {
  const [open, setOpen] = useState(false);
  const { notifications, markAllRead, clearAll } = useNotificationStore();
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <>
      {/* 벨 버튼 */}
      <button onClick={() => { setOpen(!open); if (!open) markAllRead(); }}
        style={{
          position: 'relative', background: '#1F2937', border: '1px solid #374151',
          borderRadius: '6px', padding: '6px 10px', cursor: 'pointer',
          color: '#F3F4F6', fontSize: '16px',
        }}>
        🔔
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: '-6px', right: '-6px',
            background: '#F87171', color: 'white', borderRadius: '50%',
            width: '18px', height: '18px', fontSize: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 'bold',
          }}>{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {/* 드롭다운 패널 */}
      {open && (
        <div style={{
          position: 'fixed', top: '50px', right: '16px', zIndex: 9998,
          width: '320px', maxHeight: '480px',
          background: '#111827', border: '1px solid #374151', borderRadius: '8px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid #374151',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ color: '#F3F4F6', fontWeight: 'bold', fontSize: '14px' }}>
              🔔 알림 내역 ({notifications.length})
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={clearAll}
                style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: '11px' }}>
                전체 삭제
              </button>
              <button onClick={() => setOpen(false)}
                style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: '16px' }}>
                ✕
              </button>
            </div>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0
              ? <div style={{ padding: '24px', textAlign: 'center', color: '#6B7280', fontSize: '13px' }}>알림이 없습니다</div>
              : notifications.map((n) => <NotifRow key={n.id} n={n} />)
            }
          </div>
        </div>
      )}
    </>
  );
}
