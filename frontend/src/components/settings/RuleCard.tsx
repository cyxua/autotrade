'use client';
import { RULE_SCHEMA, StrategyRule, RuleType, makeDefaultRule } from '@/lib/strategyRules';

const inp: React.CSSProperties = { width: '100%', background: '#1F2937', border: '1px solid #374151', borderRadius: '6px', padding: '8px 10px', color: '#F9FAFB', fontSize: '13px', outline: 'none', boxSizing: 'border-box' };

interface Props {
  rule: StrategyRule;
  showWeight: boolean;
  onChange: (r: StrategyRule) => void;
  onDelete: () => void;
}

export function RuleCard({ rule, showWeight, onChange, onDelete }: Props) {
  const schema = RULE_SCHEMA[rule.type];

  // TEST_FORCE_ENTRY_ONCE 전용 카드 (파라미터 없음)
  if (rule.type === 'TEST_FORCE_ENTRY_ONCE') {
    return (
      <div style={{ background: '#1C1A00', border: '1px solid #EAB308', borderRadius: '10px', padding: '14px', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#EAB308' }}>🧪 테스트 전용: 1회 강제 진입</span>
          </div>
          <button onClick={onDelete} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '18px' }}>×</button>
        </div>
        <p style={{ fontSize: '11px', color: '#A3A300', marginTop: '8px', lineHeight: 1.5 }}>
          다음 엔진 스캔에서 1회 진입을 시도합니다.<br/>
          riskGuard(잔고·포지션·minNotional 등) 및 치명 리스크 로그 검사를 반드시 통과해야 합니다.<br/>
          진입 성공 후 전략이 자동으로 비활성화됩니다.
        </p>
        <p style={{ fontSize: '10px', color: '#6B7280', marginTop: '6px' }}>
          ※ 롱 진입 조건에 추가하면 LONG, 숏 진입 조건에 추가하면 SHORT로 진입합니다.
        </p>
      </div>
    );
  }

  const changeType = (type: RuleType) => {
    const next = makeDefaultRule(type);
    onChange({ ...next, id: rule.id, weight: rule.weight, enabled: rule.enabled });
  };

  const setParam = (k: string, v: string | number) =>
    onChange({ ...rule, params: { ...rule.params, [k]: v } });

  return (
    <div style={{ background: '#111827', border: `1px solid ${rule.enabled ? '#374151' : '#1F2937'}`, borderRadius: '10px', padding: '14px', marginBottom: '10px', opacity: rule.enabled ? 1 : 0.55 }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
        <select style={{ ...inp, flex: 2, cursor: 'pointer' }} value={rule.type}
          onChange={e => changeType(e.target.value as RuleType)}>
          {(Object.keys(RULE_SCHEMA) as RuleType[]).map(k => (
            <option key={k} value={k}>{RULE_SCHEMA[k].label}</option>
          ))}
        </select>
        {showWeight && (
          <input style={{ ...inp, width: '64px' }} type="number" min={1} max={10}
            title="가중치" value={rule.weight}
            onChange={e => onChange({ ...rule, weight: +e.target.value })} />
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '12px', color: '#9CA3AF', whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={rule.enabled}
            onChange={e => onChange({ ...rule, enabled: e.target.checked })}
            style={{ accentColor: '#EAB308' }} />
          활성
        </label>
        <button onClick={onDelete}
          style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '0 2px' }}>
          ×
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
        {Object.entries(schema.params).map(([k, meta]) => (
          <div key={k}>
            <label style={{ fontSize: '11px', color: '#6B7280', display: 'block', marginBottom: '3px' }}>{meta.label}</label>
            {meta.type === 'select' ? (
              <select style={{ ...inp, cursor: 'pointer' }}
                value={rule.params[k] ?? meta.default}
                onChange={e => setParam(k, e.target.value)}>
                {meta.options!.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <input style={inp} type="number"
                min={meta.min} max={meta.max} step={meta.step ?? 1}
                value={rule.params[k] as number ?? meta.default}
                onChange={e => setParam(k, isNaN(+e.target.value) ? e.target.value : +e.target.value)} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
