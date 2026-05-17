'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/utils';

export default function LoginPage() {
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/login', { email, password });
      router.push('/dashboard');
    } catch (error: unknown) {
      setError(getApiErrorMessage(error, '로그인에 실패했습니다.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: '#EAB308' }}>⚡ AutoTrade</h1>
          <p style={{ color: '#6B7280', marginTop: '8px', fontSize: '14px' }}>Binance Futures 자동매매</p>
        </div>

        <form onSubmit={submit} style={{ background: '#111827', border: '1px solid #1F2937', borderRadius: '16px', padding: '24px' }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', color: '#9CA3AF', display: 'block', marginBottom: '4px' }}>이메일</label>
            <input
              type="email" required value={email}
              onChange={e => setEmail(e.target.value)}
              style={{ width: '100%', background: '#1F2937', border: '1px solid #374151', borderRadius: '8px', padding: '10px 12px', color: '#F9FAFB', fontSize: '14px', outline: 'none' }}
            />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', color: '#9CA3AF', display: 'block', marginBottom: '4px' }}>비밀번호</label>
            <input
              type="password" required value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Admin1234!"
              style={{ width: '100%', background: '#1F2937', border: '1px solid #374151', borderRadius: '8px', padding: '10px 12px', color: '#F9FAFB', fontSize: '14px', outline: 'none' }}
            />
          </div>

          {error && (
            <div style={{ background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: '8px', padding: '10px 12px', marginBottom: '16px', color: '#FCA5A5', fontSize: '14px' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{ width: '100%', padding: '10px', background: '#EAB308', color: '#111827', fontWeight: 'bold', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '14px', opacity: loading ? 0.6 : 1 }}>
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: '#4B5563', fontSize: '12px', marginTop: '16px' }}>
          ⚠ 이 시스템은 개인 관리용입니다. 투자 손실에 주의하세요.
        </p>
      </div>
    </div>
  );
}
