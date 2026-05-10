'use client';

interface Props {
  label: string;
  value: string;
  color?: string;
  suffix?: string;
}

export function LivePriceRow({ label, value, color = '#9CA3AF', suffix = '' }: Props) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '12px' }}>
      <span style={{ color: '#6B7280' }}>{label}</span>
      <span suppressHydrationWarning style={{ color, fontWeight: '500' }}>
        {value}{suffix}
      </span>
    </div>
  );
}
