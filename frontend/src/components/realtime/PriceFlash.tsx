'use client';
import { useEffect, useRef, useState } from 'react';

interface Props {
  value: string;
  previousValue: string;
  fontSize?: string;
  fontWeight?: string;
}

export function PriceFlash({ value, previousValue, fontSize = '20px', fontWeight = 'bold' }: Props) {
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const prevRef = useRef(previousValue);

  useEffect(() => {
    if (value === '-' || previousValue === '-') return;
    const curr = parseFloat(value);
    const prev = parseFloat(prevRef.current);
    if (isNaN(curr) || isNaN(prev) || curr === prev) return;

    setFlash(curr > prev ? 'up' : 'down');
    prevRef.current = value;
    const t = setTimeout(() => setFlash(null), 400);
    return () => clearTimeout(t);
  }, [value, previousValue]);

  const color = flash === 'up' ? '#4ADE80' : flash === 'down' ? '#F87171' : '#E5E7EB';

  return (
    <>
      <style>{`
        @keyframes flash-up   { 0%{background:#4ADE8044} 100%{background:transparent} }
        @keyframes flash-down { 0%{background:#F8717144} 100%{background:transparent} }
      `}</style>
      <span suppressHydrationWarning style={{
        fontSize,
        fontWeight,
        color,
        transition: 'color 0.3s',
        padding: '0 4px',
        borderRadius: '3px',
        animation: flash ? `flash-${flash} 0.4s ease-out` : undefined,
      }}>
        {value}
      </span>
    </>
  );
}
