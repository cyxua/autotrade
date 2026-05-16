'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { EvalMode, StrategyRule, StrategyParams, DEFAULT_PARAMS } from '@/lib/strategyRules';
import { RuleBuilder } from '@/components/settings/RuleBuilder';

const inp: React.CSSProperties = { width: '100%', background: '#1F2937', border: '1px solid #374151', borderRadius: '8px', padding: '10px 12px', color: '#F9FAFB', fontSize: '14px', outline: 'none', boxSizing: 'border-box' };
const lbl: React.CSSProperties = { fontSize: '12px', color: '#9CA3AF', display: 'block', marginBottom: '4px' };
const sec: React.CSSProperties = { background: '#111827', border: '1px solid #1F2937', borderRadius: '12px', padding: '20px', marginBottom: '16px' };

export default function NewStrategyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({
    name: '', symbol: 'BTCUSDT', timeframe: 'm15',
    positionSizeUsdt: 50, leverage: 5, marginType: 'ISOLATED',
    allowLong: true, allowShort: true,
    takeProfitPct: 2.0, stopLossPct: 1.0, trailingStopPct: 0,
    maxPositions: 1, maxDailyLoss: 50, maxDailyTrades: 10, stopOnConsecLoss: 3,
    params: { ...DEFAULT_PARAMS } as StrategyParams,
  });

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));
  const setParam = (k: keyof StrategyParams, v: any) =>
    setForm(p => ({ ...p, params: { ...p.params, [k]: v } }));

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

  const showWeight = form.params.evalMode === 'SCORE';
  const evalLabels: Record<EvalMode, string> = { ALL: '전체 충족', ANY: '하나 충족', SCORE: '점수제' };

  return (
    <div style={{ minHeight: '100vh', background: '#030712', padding: '24px' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '24px' }}>
          <a href="/strategies" style={{ color: '#EAB308', textDecoration: 'none' }}>← 전략 목록</a>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#F9FAFB' }}>전략 추가</h2>
        </div>

        {/* 기본 정보 */}
        <div style={sec}>
          <h3 style={{ color: '#D1D5DB', marginBottom: '16px', fontSize: '15px' }}>기본 정보</h3>
          <div style={{ marginBottom: '12px' }}>
            <label style={lbl}>전략 이름</label>
            <input style={inp} value={form.name} onChange={e => set('name', e.target.value)} placeholder="예: BTC RSI 전략" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div><label style={lbl}>대상 종목</label><input style={inp} value={form.symbol} onChange={e => set('symbol', e.target.value.toUpperCase())} /></div>
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
            <div>
              <label style={lbl}>마진 타입</label>
              <select style={{ ...inp, cursor: 'pointer' }} value={form.marginType} onChange={e => set('marginType', e.target.value)}>
                <option value="ISOLATED">격리 (ISOLATED)</option>
                <option value="CROSSED">교차 (CROSSED)</option>
              </select>
            </div>
            <div><label style={lbl}>익절 %</label><input style={inp} type="number" min="0.1" step="0.1" value={form.takeProfitPct} onChange={e => set('takeProfitPct', +e.target.value)} /></div>
            <div><label style={lbl}>손절 %</label><input style={inp} type="number" min="0.1" step="0.1" value={form.stopLossPct} onChange={e => set('stopLossPct', +e.target.value)} /></div>
            <div><label style={lbl}>트레일링 스탑 %</label><input style={inp} type="number" min="0" step="0.1" value={form.trailingStopPct} onChange={e => set('trailingStopPct', +e.target.value)} /></div>
          </div>
          <div>
            <label style={lbl}>방향 허용</label>
            <div style={{ display: 'flex', gap: '16px', padding: '10px 0' }}>
              {([['allowLong','롱'],['allowShort','숏']] as const).map(([k,l]) => (
                <label key={k} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px', color: '#D1D5DB' }}>
                  <input type="checkbox" checked={(form as any)[k]} onChange={e => set(k, e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#EAB308' }} />{l}
                </label>
              ))}
            </div>
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

        {/* 진입 조건 */}
        <div style={{ ...sec, border: '1px solid #422006' }}>
          <h3 style={{ color: '#EAB308', marginBottom: '16px', fontSize: '15px' }}>진입 조건</h3>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              {(['ALL','ANY','SCORE'] as EvalMode[]).map(m => (
                <button key={m} onClick={() => setParam('evalMode', m)}
                  style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold',
                    background: form.params.evalMode === m ? '#EAB308' : '#374151',
                    color: form.params.evalMode === m ? '#111827' : '#9CA3AF' }}>
                  {evalLabels[m]}
                </button>
              ))}
            </div>
            {showWeight && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '12px', color: '#9CA3AF' }}>최소 점수</label>
                <input style={{ ...inp, width: '72px' }} type="number" min={0} max={100}
                  value={form.params.minScore} onChange={e => setParam('minScore', +e.target.value)} />
              </div>
            )}
          </div>
          <RuleBuilder title="롱 진입 조건" rules={form.params.longEntryRules} showWeight={showWeight} onChange={r => setParam('longEntryRules', r)} />
          <RuleBuilder title="숏 진입 조건" rules={form.params.shortEntryRules} showWeight={showWeight} onChange={r => setParam('shortEntryRules', r)} />
        </div>

        {/* 청산/차단 */}
        <div style={{ ...sec, border: '1px solid #1E3A5F' }}>
          <h3 style={{ color: '#60A5FA', marginBottom: '16px', fontSize: '15px' }}>청산 / 차단 조건</h3>
          <RuleBuilder title="청산 조건" rules={form.params.exitRules} showWeight={false} onChange={r => setParam('exitRules', r)} />
          <RuleBuilder title="차단 조건" rules={form.params.blockRules} showWeight={false} onChange={r => setParam('blockRules', r)} />
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
