'use client';
import { useState } from 'react';

interface Props {
  onConfirm: () => void;
  onCancel: () => void;
  checks: { label: string; passed: boolean }[];
}

const CONFIRM_TEXT = 'LIVE START';

export function LiveStartConfirmModal({ onConfirm, onCancel, checks }: Props) {
  const [input, setInput] = useState('');
  const [agreed, setAgreed] = useState(false);
  const allPassed = checks.every(c => c.passed);
  const canStart = allPassed && agreed && input === CONFIRM_TEXT;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
    }}>
      <div style={{
        background: '#111827', border: '1px solid rgba(239,68,68,0.5)',
        borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '440px',
        boxShadow: '0 0 40px rgba(239,68,68,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <span style={{ fontSize: '24px' }}>🚨</span>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#F87171' }}>실거래 자동매매 시작</h2>
            <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>실제 자산 손실이 발생할 수 있습니다.</p>
          </div>
        </div>

        <div style={{ background: '#1F2937', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
          <p style={{ fontSize: '12px', color: '#9CA3AF', marginBottom: '10px' }}>시작 조건 확인</p>
          {checks.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{ fontSize: '14px' }}>{c.passed ? '✅' : '❌'}</span>
              <span style={{ fontSize: '13px', color: c.passed ? '#D1D5DB' : '#F87171' }}>{c.label}</span>
            </div>
          ))}
        </div>

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '16px', cursor: 'pointer' }}>
          <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
            style={{ marginTop: '2px', width: '16px', height: '16px', accentColor: '#EF4444', cursor: 'pointer' }} />
          <span style={{ fontSize: '13px', color: '#D1D5DB', lineHeight: '1.5' }}>
            실거래 자동매매의 위험성을 충분히 이해했으며, 발생하는 모든 손실에 대한 책임은 본인에게 있음을 동의합니다.
          </span>
        </label>

        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontSize: '12px', color: '#9CA3AF', marginBottom: '6px' }}>
            시작하려면 아래에 <span style={{ color: '#EAB308', fontWeight: 'bold' }}>{CONFIRM_TEXT}</span> 를 입력하세요.
          </p>
          <input value={input} onChange={e => setInput(e.target.value)}
            placeholder={CONFIRM_TEXT}
            style={{
              width: '100%', background: '#1F2937',
              border: `1px solid ${input === CONFIRM_TEXT ? '#EF4444' : '#374151'}`,
              borderRadius: '8px', padding: '10px 12px',
              color: '#F9FAFB', fontSize: '14px', outline: 'none',
              fontFamily: 'monospace', letterSpacing: '2px',
            }} />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: '11px', background: '#374151', color: '#D1D5DB',
            border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px',
          }}>취소</button>
          <button onClick={onConfirm} disabled={!canStart} style={{
            flex: 2, padding: '11px', fontWeight: 'bold', border: 'none',
            borderRadius: '8px', fontSize: '14px',
            cursor: canStart ? 'pointer' : 'not-allowed',
            background: canStart ? '#DC2626' : '#374151',
            color: canStart ? 'white' : '#6B7280',
          }}>
            🚀 실거래 시작
          </button>
        </div>
      </div>
    </div>
  );
}
