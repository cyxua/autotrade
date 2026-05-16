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
