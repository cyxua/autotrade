'use client';
import { useChartStore, ChartTimeframe } from '@/store/chartStore';
import { TradingChart } from '@/components/chart/TradingChart';
import { SymbolSelector } from '@/components/chart/SymbolSelector';

const TIMEFRAMES: ChartTimeframe[] = ['1m','5m','15m','1h','4h','1d'];

export function TradingChartPanel() {
  const { timeframe, setTimeframe } = useChartStore();

  const btn = (active: boolean) => ({
    padding: '4px 10px', fontSize: '12px', border: 'none', cursor: 'pointer', borderRadius: '6px',
    background: active ? 'rgba(234,179,8,0.15)' : 'transparent',
    color: active ? '#EAB308' : '#6B7280',
    fontWeight: active ? '600' : 'normal',
  } as const);

  return (
    <div style={{ background: '#111827', border: '1px solid #1F2937', borderRadius: '12px', overflow: 'hidden' }}>
      <div style={{ padding: '10px 12px', borderBottom: '1px solid #1F2937', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        {/* 검색 가능한 종목 선택 */}
        <SymbolSelector />

        <div style={{ width: '1px', height: '20px', background: '#1F2937' }} />

        {/* 타임프레임 선택 */}
        <div style={{ display: 'flex', gap: '2px' }}>
          {TIMEFRAMES.map(t => (
            <button key={t} onClick={() => setTimeframe(t)} style={btn(timeframe === t)}>{t}</button>
          ))}
        </div>
      </div>
      <TradingChart />
    </div>
  );
}
