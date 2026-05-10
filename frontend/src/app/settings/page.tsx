'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

const inp = { width: '100%', background: '#1F2937', border: '1px solid #374151', borderRadius: '8px', padding: '10px 12px', color: '#F9FAFB', fontSize: '14px', outline: 'none' } as const;
const lbl = { fontSize: '12px', color: '#9CA3AF', display: 'block', marginBottom: '4px' } as const;

export default function SettingsPage() {
  const [cfg, setCfg] = useState<any>(null);
  const [apiKey, setApiKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [mode, setMode] = useState('TESTNET');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState('');
  const router = useRouter();

  useEffect(() => {
    api.get('/settings/api').then(r => {
      const d = r.data.data;
      setCfg(d);
      if (d.apiKey) setApiKey(d.apiKey);
      if (d.tradingMode) setMode(d.tradingMode);
    }).catch(() => router.push('/login'));
  }, []);

  const save = async () => {
    if (!apiKey || !secretKey) { setMsg('❌ API Key와 Secret Key를 모두 입력하세요.'); return; }
    setSaving(true);
    try {
      await api.post('/settings/api', { apiKey, secretKey, tradingMode: mode });
      setMsg('✅ 저장 완료! Secret Key는 암호화되어 저장됩니다.');
      setSecretKey('');
      const r = await api.get('/settings/api'); setCfg(r.data.data);
    } catch (e: any) { setMsg('❌ ' + (e.response?.data?.error?.message ?? '저장 실패')); }
    finally { setSaving(false); }
  };

  const test = async () => {
    setTesting(true);
    try {
      await api.post('/settings/api/test');
      setMsg('✅ API 연결 성공!');
      const r = await api.get('/settings/api'); setCfg(r.data.data);
    } catch (e: any) { setMsg('❌ ' + (e.response?.data?.error?.message ?? '연결 실패')); }
    finally { setTesting(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#030712', padding: '24px' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <a href="/dashboard" style={{ color: '#EAB308', textDecoration: 'none' }}>← 대시보드</a>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold' }}>API 설정</h2>
        </div>

        {cfg?.isConnected !== undefined && (
          <div style={{ padding: '12px 16px', borderRadius: '12px', marginBottom: '20px', background: cfg.isConnected ? '#052e16' : '#450a0a', border: `1px solid ${cfg.isConnected ? '#166534' : '#7f1d1d'}`, color: cfg.isConnected ? '#4ADE80' : '#FCA5A5' }}>
            {cfg.isConnected ? '✅ Binance API 연결됨' : '❌ API 미연결 — 연결 테스트를 실행하세요'}
          </div>
        )}

        <div style={{ background: '#111827', border: '1px solid #1F2937', borderRadius: '16px', padding: '24px', marginBottom: '16px' }}>
          <h3 style={{ marginBottom: '16px', color: '#D1D5DB' }}>Binance 테스트넷 API Key 등록</h3>
          <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '16px' }}>
            👉 <a href="https://testnet.binancefuture.com" target="_blank" style={{ color: '#EAB308' }}>testnet.binancefuture.com</a> 에서 발급
          </p>

          <div style={{ marginBottom: '12px' }}>
            <label style={lbl}>API Key</label>
            <input style={inp} value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="API Key 입력" />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={lbl}>Secret Key {cfg?.hasSecret && <span style={{ color: '#EAB308' }}>(저장됨 — 변경 시만 입력)</span>}</label>
            <input style={inp} type="password" value={secretKey} onChange={e => setSecretKey(e.target.value)} placeholder="Secret Key 입력" />
            <p style={{ fontSize: '11px', color: '#EF4444', marginTop: '4px' }}>⚠ Secret은 암호화 저장되며 다시 조회할 수 없습니다.</p>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={lbl}>모드</label>
            <select style={{ ...inp, cursor: 'pointer' }} value={mode} onChange={e => setMode(e.target.value)}>
              <option value="TESTNET">🔵 테스트넷 (권장)</option>
              <option value="LIVE">🔴 실거래 (위험)</option>
            </select>
          </div>

          {msg && <div style={{ padding: '10px 12px', borderRadius: '8px', marginBottom: '12px', background: '#1F2937', fontSize: '13px', color: msg.startsWith('✅') ? '#4ADE80' : '#FCA5A5' }}>{msg}</div>}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={save} disabled={saving} style={{ flex: 1, padding: '10px', background: '#EAB308', color: '#111827', fontWeight: 'bold', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
              {saving ? '저장 중...' : '저장'}
            </button>
            {cfg?.configured && (
              <button onClick={test} disabled={testing} style={{ padding: '10px 16px', background: '#1F2937', color: '#D1D5DB', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                {testing ? '테스트 중...' : '연결 테스트'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
