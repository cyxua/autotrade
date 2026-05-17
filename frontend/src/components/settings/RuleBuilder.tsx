'use client';
import { StrategyRule, RuleType, makeDefaultRule } from '@/lib/strategyRules';
import { RuleCard } from './RuleCard';

interface Props {
  title:      string;
  rules:      StrategyRule[];
  showWeight: boolean;
  onChange:   (rules: StrategyRule[]) => void;
  warnUnused?:        boolean;
  excludeRuleTypes?: RuleType[];  // 선택 불가 rule types
}

export function RuleBuilder({ title, rules, showWeight, onChange, warnUnused, excludeRuleTypes }: Props) {
  const add    = () => onChange([...rules, makeDefaultRule('RSI_RANGE')]);
  const update = (i: number, r: StrategyRule) => onChange(rules.map((x, idx) => idx === i ? r : x));
  const remove = (i: number) => onChange(rules.filter((_, idx) => idx !== i));

  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: '#9CA3AF', fontWeight: 600 }}>{title}</span>
          {warnUnused && (
            <span style={{ fontSize: '10px', background: '#374151', color: '#F59E0B', borderRadius: '4px', padding: '2px 6px', border: '1px solid #F59E0B' }}>
              ⚠ 현재 미사용
            </span>
          )}
        </div>
        <button onClick={add}
          style={{ background: '#1F2937', border: '1px solid #374151', color: '#EAB308', borderRadius: '6px', padding: '4px 12px', cursor: 'pointer', fontSize: '12px' }}>
          + 조건 추가
        </button>
      </div>
      {rules.length === 0 && (
        <div style={{ textAlign: 'center', padding: '14px', color: '#4B5563', fontSize: '12px', border: '1px dashed #374151', borderRadius: '8px' }}>
          조건 없음
        </div>
      )}
      {rules.map((r, i) => (
        <RuleCard key={r.id} rule={r} showWeight={showWeight}
          excludeRuleTypes={excludeRuleTypes}
          onChange={u => update(i, u)} onDelete={() => remove(i)} />
      ))}
    </div>
  );
}
