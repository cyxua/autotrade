'use client';
import { useChartStore, ChartSymbol, ChartTimeframe } from '@/store/chartStore';
import { TradingChart } from '@/components/chart/TradingChart';

const SYMBOLS: ChartSymbol[] = ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','DOGEUSDT'];
const TIMEFRAMES: ChartTimeframe[] = ['1m','5m','15m','1h','4h','1d'];

export function TradingChartPanel() {
  const { symbol, timeframe, setSymbol, setTimeframe } = useChartStore();

  const btn = (active: boolean) => ({
    padding: '4px 10px', fontSize: '12px',
    border: 'none', cursor: 'pointer', borderRadius: '6px',
    background: active ? 'rgba(234,179,8,0.15)' : 'transparent',
    color: active ? '#EAB308' : '#6B7280',
    fontWeight: active ? '600' : 'normal',
  } as const);

  return (
    <div style={{ background: '#111827', border: '1px solid #1F2937', borderRadius: '12px', overflow: 'hidden' }}>
      {/* 컨트롤 바 */}
      <div style={{
        padding: '10px 12px', borderBottom: '1px solid #1F2937',
        display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
      }}>
        {/* 종목 선택 */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {SYMBOLS.map(s => (
            <button key={s} onClick={() => setSymbol(s)} style={btn(symbol === s)}>
              {s.replace('USDT', '')}
            </button>
          ))}
        </div>

        <div style={{ width: '1px', height: '20px', background: '#1F2937' }} />

        {/* 타임프레임 선택 */}
        <div style={{ display: 'flex', gap: '2px' }}>
          {TIMEFRAMES.map(t => (
            <button key={t} onClick={() => setTimeframe(t)} style={btn(timeframe === t)}>{t}</button>
          ))}
        </div>

        <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#4B5563' }}>
          MOCK DATA
        </span>
      </div>

      {/* 차트 영역 */}
      <TradingChart />
    </div>
  );
}
