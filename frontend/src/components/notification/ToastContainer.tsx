'use client';
import { useNotificationStore, Notification } from '@/store/useNotificationStore';

const icons = { success: '✅', error: '🔴', warning: '⚠️', info: '🔵' };
const colors = {
  success: { bg: '#064e3b', border: '#4ADE80', text: '#4ADE80' },
  error:   { bg: '#450a0a', border: '#F87171', text: '#F87171' },
  warning: { bg: '#422006', border: '#FBBF24', text: '#FBBF24' },
  info:    { bg: '#0c1a3a', border: '#60A5FA', text: '#60A5FA' },
};

function Toast({ n }: { n: Notification }) {
  const removeToast = useNotificationStore((s) => s.removeToast);
  const c = colors[n.type];

  return (
    <div style={{
      background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: '8px', padding: '12px 16px',
      display: 'flex', gap: '10px', alignItems: 'flex-start',
      boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
      animation: 'slideIn 0.3s ease-out',
      minWidth: '280px', maxWidth: '360px',
    }}>
      <span style={{ fontSize: '18px' }}>{icons[n.type]}</span>
      <div style={{ flex: 1 }}>
        <div style={{ color: c.text, fontWeight: 'bold', fontSize: '13px' }}>{n.title}</div>
        <div style={{ color: '#D1D5DB', fontSize: '12px', marginTop: '2px' }}>{n.message}</div>
        <div suppressHydrationWarning style={{ color: '#6B7280', fontSize: '10px', marginTop: '4px' }}>
          {new Date(n.timestamp).toLocaleTimeString('ko-KR', { hour12: true })}
        </div>
      </div>
      <button onClick={() => removeToast(n.id)}
        style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: '16px', padding: '0' }}>
        ✕
      </button>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useNotificationStore((s) => s.toasts);

  return (
    <>
      <style>{`
        @keyframes slideIn { from { transform: translateX(100%); opacity:0 } to { transform: translateX(0); opacity:1 } }
      `}</style>
      <div style={{
        position: 'fixed', bottom: '24px', right: '24px',
        zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '8px',
      }}>
        {toasts.map((n) => <Toast key={n.id} n={n} />)}
      </div>
    </>
  );
}
