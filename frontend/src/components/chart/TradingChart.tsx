'use client';
import type { Time } from 'lightweight-charts';
import { useEffect, useRef, useState } from 'react';
import { useChartStore } from '@/store/chartStore';
import { fetchKlines, KlineData } from '@/lib/futuresApi';
import { getMockCandles } from '@/mock/candles.mock';
import { useAccountStore } from '@/store/accountStore';

type DataSource = 'live' | 'mock' | 'loading' | 'error';

// ── lightweight-charts v4/v5 호환 최소 인터페이스 ──────────────────────
interface ISeries {
  setData(data: unknown[]): void;
  update(bar: unknown): void;
  createPriceLine(opts: Record<string, unknown>): unknown;
}
interface IChart {
  remove(): void;
  resize(w: number, h: number): void;
  timeScale(): { fitContent(): void };
  priceScale(id: string): { applyOptions(opts: Record<string, unknown>): void };
  addSeries(series: unknown, opts?: unknown): ISeries;
}
interface IChartV4 extends IChart {
  addCandlestickSeries(opts?: unknown): ISeries;
  addHistogramSeries(opts?: unknown): ISeries;
}

export function TradingChart() {
  const containerRef    = useRef<HTMLDivElement>(null);
  const chartRef        = useRef<IChart | null>(null);
  const wsRef           = useRef<WebSocket | null>(null);
  const candleSeriesRef = useRef<ISeries | null>(null);
  const mountedRef      = useRef(true);
  const reconnectRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { symbol, timeframe } = useChartStore();
  const { positions }         = useAccountStore();
  const [source, setSource]   = useState<DataSource>('loading');
  const [wsStatus, setWsStatus] = useState<'연결중' | '연결됨' | '끊김'>('연결중');

  useEffect(() => {
    if (!containerRef.current || typeof window === 'undefined') return;
    mountedRef.current = true;
    let cleanup: (() => void) | undefined;

    // ── WebSocket 연결 (useEffect 내부 정의 → cleanup 가능) ─────────
    const connectWs = (sym: string, interval: string, series: ISeries) => {
      const streamName = `${sym.toLowerCase()}@kline_${interval}`;

      const connect = () => {
        if (!mountedRef.current) return; // unmount 후 재연결 방지

        const ws = new WebSocket(`wss://fstream.binance.com/ws/${streamName}`);
        wsRef.current = ws;

        ws.onopen  = () => setWsStatus('연결됨');
        ws.onerror = () => setWsStatus('끊김');
        ws.onclose = () => {
          setWsStatus('끊김');
          if (mountedRef.current) {
            reconnectRef.current = setTimeout(connect, 3000);
          }
        };
        ws.onmessage = (evt) => {
          try {
            const msg = JSON.parse(evt.data as string) as Record<string, unknown>;
            if (msg['e'] !== 'kline') return;
            const k = msg['k'] as Record<string, string | number>;
            series.update({
              time:  Math.floor(Number(k['t']) / 1000) as unknown as Time,
              open:  parseFloat(String(k['o'])),
              high:  parseFloat(String(k['h'])),
              low:   parseFloat(String(k['l'])),
              close: parseFloat(String(k['c'])),
            });
          } catch {}
        };
      };

      connect();
    };

    const init = async () => {
      const lc = await import('lightweight-charts');
      const { createChart, CrosshairMode } = lc;

      if (chartRef.current)    { try { chartRef.current.remove(); } catch {} chartRef.current = null; }
      if (wsRef.current)       { wsRef.current.onclose = null; wsRef.current.close(); wsRef.current = null; }
      if (reconnectRef.current){ clearTimeout(reconnectRef.current); reconnectRef.current = null; }

      const rawChart = createChart(containerRef.current!, {
        localization: {
          locale: 'ko-KR',
          timeFormatter: (t: number) => new Date((t + 32400) * 1000).toISOString().substring(11, 16),
        },
        layout:          { background: { color: '#111827' }, textColor: '#9CA3AF' },
        grid:            { vertLines: { color: '#1F2937' }, horzLines: { color: '#1F2937' } },
        crosshair:       { mode: CrosshairMode.Normal },
        rightPriceScale: { borderColor: '#374151' },
        timeScale:       { borderColor: '#374151', timeVisible: true, secondsVisible: false },
        width:  containerRef.current!.clientWidth,
        height: 320,
      });

      // v4/v5 호환 시리즈 생성
      let candleSeries: ISeries;
      let volSeries: ISeries;
      const chart = rawChart as unknown as IChart;
      const chartV4 = rawChart as unknown as IChartV4;

      if (typeof chartV4.addCandlestickSeries === 'function') {
        candleSeries = chartV4.addCandlestickSeries({
          upColor: '#10B981', downColor: '#EF4444',
          borderUpColor: '#10B981', borderDownColor: '#EF4444',
          wickUpColor: '#10B981', wickDownColor: '#EF4444',
        });
        volSeries = chartV4.addHistogramSeries({
          color: '#4B5563', priceFormat: { type: 'volume' }, priceScaleId: 'volume',
        });
      } else {
        const lc5 = lc as typeof lc & { CandlestickSeries: unknown; HistogramSeries: unknown };
        candleSeries = chart.addSeries(lc5.CandlestickSeries, {
          upColor: '#10B981', downColor: '#EF4444',
          borderUpColor: '#10B981', borderDownColor: '#EF4444',
          wickUpColor: '#10B981', wickDownColor: '#EF4444',
        });
        volSeries = chart.addSeries(lc5.HistogramSeries, {
          color: '#4B5563', priceFormat: { type: 'volume' }, priceScaleId: 'volume',
        });
      }

      chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
      chartRef.current       = chart;
      candleSeriesRef.current = candleSeries;

      // 캔들 데이터 로드
      setSource('loading');
      let finalSource: DataSource = 'loading';
      let candles: KlineData[]    = [];

      try {
        candles     = await fetchKlines(symbol, timeframe, 500);
        setSource('live');
        finalSource = 'live';
      } catch {
        const mock = getMockCandles(symbol, timeframe);
        candles     = mock.map(m => ({ time: m.time, open: m.open, high: m.high, low: m.low, close: m.close, volume: m.volume }));
        setSource('mock');
        finalSource = 'mock';
      }

      candleSeries.setData(candles.map(c => ({
        time:  c.time as unknown as Time,
        open: c.open, high: c.high, low: c.low, close: c.close,
      })));
      volSeries.setData(candles.map(c => ({
        time:  c.time as unknown as Time,
        value: c.volume,
        color: c.close >= c.open ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)',
      })));

      // 포지션 라인 (PositionInfo 필드만 사용)
      const pos = positions.find(p => p.symbol === symbol);
      if (pos && typeof candleSeries.createPriceLine === 'function') {
        const ep = parseFloat(pos.entryPrice);
        const mp = parseFloat(pos.markPrice);
        if (ep > 0) candleSeries.createPriceLine({ price: ep, color: '#EAB308', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: '진입가' });
        if (mp > 0) candleSeries.createPriceLine({ price: mp, color: '#60A5FA', lineWidth: 1, lineStyle: 0, axisLabelVisible: true, title: '마크가' });
      }

      chart.timeScale().fitContent();

      if (finalSource !== 'mock') {
        connectWs(symbol, timeframe, candleSeries);
      }

      const observer = new ResizeObserver(() => {
        if (containerRef.current) chart.resize(containerRef.current.clientWidth, 320);
      });
      observer.observe(containerRef.current!);
      cleanup = () => observer.disconnect();
    };

    init();

    return () => {
      mountedRef.current = false;
      if (reconnectRef.current) { clearTimeout(reconnectRef.current); reconnectRef.current = null; }
      cleanup?.();
      if (wsRef.current)    { wsRef.current.onclose = null; wsRef.current.close(); wsRef.current = null; }
      if (chartRef.current) { try { chartRef.current.remove(); } catch {} chartRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, timeframe]);

  const badge = source === 'live'
    ? { text: 'LIVE DATA',    color: '#4ADE80', bg: 'rgba(74,222,128,0.1)' }
    : source === 'mock'
    ? { text: 'MOCK FALLBACK', color: '#F87171', bg: 'rgba(248,113,113,0.1)' }
    : { text: 'LOADING...',   color: '#9CA3AF', bg: 'rgba(156,163,175,0.1)' };

  const wsColor = wsStatus === '연결됨' ? '#4ADE80' : wsStatus === '연결중' ? '#EAB308' : '#F87171';

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 10, display: 'flex', gap: '6px', alignItems: 'center' }}>
        <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: badge.bg, color: badge.color, fontWeight: 'bold' }}>
          {badge.text}
        </span>
        {source === 'live' && (
          <span style={{ fontSize: '10px', color: wsColor }}>● WS {wsStatus}</span>
        )}
      </div>
      <div ref={containerRef} style={{ width: '100%' }} />
      <p style={{ fontSize: '10px', color: '#4B5563', padding: '4px 8px', margin: 0 }}>
        ※ Binance USDⓈ-M Futures 기준 | Spot 가격과 다를 수 있음
      </p>
    </div>
  );
}
