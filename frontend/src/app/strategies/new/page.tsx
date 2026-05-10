'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

const TYPES = [
  { value: 'MA_CROSS', label: 'EMA/SMA 크로스' },
  { value: 'RSI_EXTREME', label: 'RSI 과매수/과매도' },
  { value: 'BOLLINGER_BREAKOUT', label: '볼린저밴드 돌파' },
  { value: 'HIGH_LOW_BREAKOUT', label: '고점/저점 돌파' },
  { value: 'VOLUME_SPIKE', label: '거래량 급증' },
];

const DEFAULT_PARAMS: Record<string, any> = {
  MA_CROSS: { shortPeriod: 9, longPeriod: 21, maType: 'EMA' },
  RSI_EXTREME: { rsiPeriod: 14, oversoldLevel: 30, overboughtLevel: 70 },
  BOLLINGER_BREAKOUT: { bbPeriod: 20, bbStdDev: 2.0 },
  HIGH_LOW_BREAKOUT: { lookbackCandles: 20 },
  VOLUME_SPIKE: { volumeMultiplier: 3.0, avgVolumePeriod: 20 },
};

const inp = { width: '100%', background: '#1F2937', border: '1px solid #374151', borderRadius: '8px', padding: '10px 12px', color: '#F9FAFB', fontSize: '14px', outline: 'none' } as const;
const lbl = { fontSize: '12px', color: '#9CA3AF', display: 'block', marginBottom: '4px' } as const;
const sec = { background: '#111827', border: '1px solid #1F2937', borderRadius: '12px', padding: '20px', marginBottom: '16px' } as const;

export default function NewStrategyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({
    name: '', type: 'MA_CROSS', symbol: 'BTCUSDT', timeframe: 'm15',
    positionSizeUsdt: 50, leverage: 5, marginType: 'ISOLATED',
    allowLong: true, allowShort: true,
    takeProfitPct: 2.0, stopLossPct: 1.0, trailingStopPct: 0,
    maxPositions: 1, maxDailyLoss: 50, maxDailyTrades: 10, stopOnConsecLoss: 3,
    params: DEFAULT_PARAMS.MA_CROSS,
  });

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));
  const setType = (t: string) => setForm(p => ({ ...p, type: t, params: DEFAULT_PARAMS[t] }));
  const setParam = (k: string, v: any) => setForm(p => ({ ...p, params: { ...p.params, [k]: v } }));

  const submit = async () => {
    if (!form.name) { setMsg('❌ 전략 이름을 입력하세요.'); return; }
    setLoading(true);
    try {
      await api.post('/strategies', form);
      router.push('/strategies');
    } catch (e: any) {
      setMsg('❌ ' + (e.response?.data?.error?.message ?? '저장 실패'));
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#030712', padding: '24px' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '24px' }}>
          <a href="/strategies" style={{ color: '#EAB308', textDecoration: 'none' }}>← 전략 목록</a>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold' }}>전략 추가</h2>
        </div>

        {/* 기본 정보 */}
        <div style={sec}>
          <h3 style={{ color: '#D1D5DB', marginBottom: '16px', fontSize: '15px' }}>기본 정보</h3>
          <div style={{ marginBottom: '12px' }}>
            <label style={lbl}>전략 이름</label>
            <input style={inp} value={form.name} onChange={e => set('name', e.target.value)} placeholder="예: BTC EMA 크로스" />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={lbl}>전략 유형</label>
            <select style={{ ...inp, cursor: 'pointer' }} value={form.type} onChange={e => setType(e.target.value)}>
              {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>대상 종목</label>
              <input style={inp} value={form.symbol} onChange={e => set('symbol', e.target.value.toUpperCase())} />
            </div>
            <div>
              <label style={lbl}>타임프레임</label>
              <select style={{ ...inp, cursor: 'pointer' }} value={form.timeframe} onChange={e => set('timeframe', e.target.value)}>
                {['m1','m5','m15','h1','h4'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* 매매 설정 */}
        <div style={sec}>
          <h3 style={{ color: '#D1D5DB', marginBottom: '16px', fontSize: '15px' }}>매매 설정</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div><label style={lbl}>진입 금액 (USDT)</label><input style={inp} type="number" min="1" value={form.positionSizeUsdt} onChange={e => set('positionSizeUsdt', +e.target.value)} /></div>
            <div><label style={lbl}>레버리지</label><input style={inp} type="number" min="1" max="125" value={form.leverage} onChange={e => set('leverage', +e.target.value)} /></div>
            <div><label style={lbl}>마진 타입</label>
              <select style={{ ...inp, cursor: 'pointer' }} value={form.marginType} onChange={e => set('marginType', e.target.value)}>
                <option value="ISOLATED">격리 (ISOLATED)</option>
                <option value="CROSSED">교차 (CROSSED)</option>
              </select>
            </div>
            <div>
              <label style={lbl}>방향 허용</label>
              <div style={{ display: 'flex', gap: '16px', padding: '10px 0' }}>
                {[['allowLong','롱'], ['allowShort','숏']].map(([k,l]) => (
                  <label key={k} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px', color: '#D1D5DB' }}>
                    <input type="checkbox" checked={(form as any)[k]} onChange={e => set(k, e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#EAB308' }} />{l}
                  </label>
                ))}
              </div>
            </div>
            <div><label style={lbl}>익절 %</label><input style={inp} type="number" min="0.1" step="0.1" value={form.takeProfitPct} onChange={e => set('takeProfitPct', +e.target.value)} /></div>
            <div><label style={lbl}>손절 %</label><input style={inp} type="number" min="0.1" step="0.1" value={form.stopLossPct} onChange={e => set('stopLossPct', +e.target.value)} /></div>
          </div>
        </div>

        {/* 리스크 제한 */}
        <div style={sec}>
          <h3 style={{ color: '#D1D5DB', marginBottom: '16px', fontSize: '15px' }}>리스크 제한</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div><label style={lbl}>최대 동시 포지션</label><input style={inp} type="number" min="1" value={form.maxPositions} onChange={e => set('maxPositions', +e.target.value)} /></div>
            <div><label style={lbl}>1일 최대 손실 (USDT)</label><input style={inp} type="number" min="0" value={form.maxDailyLoss} onChange={e => set('maxDailyLoss', +e.target.value)} /></div>
            <div><label style={lbl}>1일 최대 거래 횟수</label><input style={inp} type="number" min="1" value={form.maxDailyTrades} onChange={e => set('maxDailyTrades', +e.target.value)} /></div>
            <div><label style={lbl}>연속 손실 중지 횟수</label><input style={inp} type="number" min="1" value={form.stopOnConsecLoss} onChange={e => set('stopOnConsecLoss', +e.target.value)} /></div>
          </div>
        </div>

        {/* 전략별 파라미터 */}
        <div style={{ ...sec, border: '1px solid #422006' }}>
          <h3 style={{ color: '#EAB308', marginBottom: '16px', fontSize: '15px' }}>전략 파라미터</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {Object.entries(form.params).map(([k, v]) => (
              <div key={k}>
                <label style={lbl}>{k}</label>
                <input style={inp} value={v as any}
                  onChange={e => setParam(k, isNaN(+e.target.value) ? e.target.value : +e.target.value)} />
              </div>
            ))}
          </div>
        </div>

        {msg && <div style={{ padding: '12px', borderRadius: '8px', marginBottom: '12px', background: '#1F2937', color: '#FCA5A5', fontSize: '14px' }}>{msg}</div>}

        <div style={{ display: 'flex', gap: '12px' }}>
          <a href="/strategies" style={{ flex: 1, padding: '12px', background: '#374151', color: '#D1D5DB', borderRadius: '8px', textAlign: 'center', textDecoration: 'none', fontSize: '14px' }}>취소</a>
          <button onClick={submit} disabled={loading}
            style={{ flex: 2, padding: '12px', background: '#EAB308', color: '#111827', fontWeight: 'bold', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', opacity: loading ? 0.6 : 1 }}>
            {loading ? '저장 중...' : '전략 저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
