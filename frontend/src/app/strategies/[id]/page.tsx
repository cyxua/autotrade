'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api';

export default function EditStrategyPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState<any>(null);

  useEffect(() => {
    api.get(`/strategies/${id}`).then(r => setForm(r.data.data)).catch(() => router.push('/strategies'));
  }, [id]);

  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));
  const setParam = (k: string, v: any) => setForm((p: any) => ({ ...p, params: { ...p.params, [k]: v } }));

  const submit = async () => {
    setLoading(true);
    try {
      await api.put(`/strategies/${id}`, form);
      router.push('/strategies');
    } catch (e: any) {
      setMsg('❌ ' + (e.response?.data?.error?.message ?? '저장 실패'));
    } finally { setLoading(false); }
  };

  if (!form) return <div style={{ color: '#9CA3AF', padding: '48px', textAlign: 'center' }}>로딩 중...</div>;

  const inp = { width: '100%', background: '#1F2937', border: '1px solid #374151', borderRadius: '8px', padding: '10px 12px', color: '#F9FAFB', fontSize: '14px', outline: 'none' } as const;
  const lbl = { fontSize: '12px', color: '#9CA3AF', display: 'block', marginBottom: '4px' } as const;

  return (
    <div style={{ minHeight: '100vh', background: '#030712', padding: '24px' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '24px' }}>
          <a href="/strategies" style={{ color: '#EAB308', textDecoration: 'none' }}>← 전략 목록</a>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold' }}>전략 수정</h2>
        </div>

        <div style={{ background: '#111827', border: '1px solid #1F2937', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
          <h3 style={{ color: '#D1D5DB', marginBottom: '16px', fontSize: '15px' }}>기본 설정</h3>
          <div style={{ marginBottom: '12px' }}><label style={lbl}>전략 이름</label><input style={inp} value={form.name} onChange={e => set('name', e.target.value)} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div><label style={lbl}>대상 종목</label><input style={inp} value={form.symbol} onChange={e => set('symbol', e.target.value.toUpperCase())} /></div>
            <div><label style={lbl}>타임프레임</label>
              <select style={{ ...inp, cursor: 'pointer' }} value={form.timeframe} onChange={e => set('timeframe', e.target.value)}>
                {['m1','m5','m15','h1','h4'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><label style={lbl}>진입 금액 (USDT)</label><input style={inp} type="number" value={form.positionSizeUsdt} onChange={e => set('positionSizeUsdt', +e.target.value)} /></div>
            <div><label style={lbl}>레버리지</label><input style={inp} type="number" value={form.leverage} onChange={e => set('leverage', +e.target.value)} /></div>
            <div><label style={lbl}>익절 %</label><input style={inp} type="number" step="0.1" value={form.takeProfitPct} onChange={e => set('takeProfitPct', +e.target.value)} /></div>
            <div><label style={lbl}>손절 %</label><input style={inp} type="number" step="0.1" value={form.stopLossPct} onChange={e => set('stopLossPct', +e.target.value)} /></div>
          </div>
        </div>

        {form.params && Object.keys(form.params).length > 0 && (
          <div style={{ background: '#111827', border: '1px solid #422006', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
            <h3 style={{ color: '#EAB308', marginBottom: '16px', fontSize: '15px' }}>전략 파라미터</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {Object.entries(form.params).map(([k, v]) => (
                <div key={k}><label style={lbl}>{k}</label>
                  <input style={inp} value={v as any} onChange={e => setParam(k, isNaN(+e.target.value) ? e.target.value : +e.target.value)} />
                </div>
              ))}
            </div>
          </div>
        )}

        {msg && <div style={{ padding: '12px', borderRadius: '8px', marginBottom: '12px', background: '#1F2937', color: '#FCA5A5' }}>{msg}</div>}

        <div style={{ display: 'flex', gap: '12px' }}>
          <a href="/strategies" style={{ flex: 1, padding: '12px', background: '#374151', color: '#D1D5DB', borderRadius: '8px', textAlign: 'center', textDecoration: 'none', fontSize: '14px' }}>취소</a>
          <button onClick={submit} disabled={loading}
            style={{ flex: 2, padding: '12px', background: '#EAB308', color: '#111827', fontWeight: 'bold', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>
            {loading ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
