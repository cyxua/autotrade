'use client';
import { useEffect, useRef, useState } from 'react';
import { useChartStore } from '@/store/chartStore';
import { fetchKlines, KlineData } from '@/lib/futuresApi';
import { getMockCandles } from '@/mock/candles.mock';
import { mockPositions } from '@/mock/positions.mock';
import { useAccountStore } from '@/store/accountStore';

type DataSource = 'live' | 'mock' | 'loading' | 'error';

export function TradingChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const candleSeriesRef = useRef<any>(null);
  const { symbol, timeframe } = useChartStore();
  const { positions } = useAccountStore();
  const [source, setSource] = useState<DataSource>('loading');
  const [wsStatus, setWsStatus] = useState<'연결중' | '연결됨' | '끊김'>('연결중');

  // 인터벌 매핑 (차트store → Binance)
  const toInterval = (tf: string) => tf; // '1m','5m','15m','1h','4h','1d' 그대로 사용

  useEffect(() => {
    if (!containerRef.current || typeof window === 'undefined') return;

    let cleanup: (() => void) | undefined;

    const init = async () => {
      const lc = await import('lightweight-charts');
      const { createChart, CrosshairMode } = lc;

      if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }

      const chart = createChart(containerRef.current!, {
      localization: {
        locale: 'ko-KR',
        timeFormatter: (t: number) => {
          const d = new Date((t + 32400) * 1000);
          return d.toISOString().substring(11, 16);
        },
      },
        layout: { background: { color: '#111827' }, textColor: '#9CA3AF' },
        grid: { vertLines: { color: '#1F2937' }, horzLines: { color: '#1F2937' } },
        crosshair: { mode: CrosshairMode.Normal },
        rightPriceScale: { borderColor: '#374151' },
        timeScale: { borderColor: '#374151', timeVisible: true, secondsVisible: false },
        width: containerRef.current!.clientWidth,
        height: 320,
      });

      // 시리즈 생성 (v4/v5 호환)
      let candleSeries: any, volSeries: any;
      if (typeof (chart as any).addCandlestickSeries === 'function') {
        candleSeries = (chart as any).addCandlestickSeries({
          upColor: '#10B981', downColor: '#EF4444',
          borderUpColor: '#10B981', borderDownColor: '#EF4444',
          wickUpColor: '#10B981', wickDownColor: '#EF4444',
        });
        volSeries = (chart as any).addHistogramSeries({
          color: '#4B5563', priceFormat: { type: 'volume' }, priceScaleId: 'volume',
        });
      } else {
        const { CandlestickSeries, HistogramSeries } = lc as any;
        candleSeries = chart.addSeries(CandlestickSeries, {
          upColor: '#10B981', downColor: '#EF4444',
          borderUpColor: '#10B981', borderDownColor: '#EF4444',
          wickUpColor: '#10B981', wickDownColor: '#EF4444',
        });
        volSeries = chart.addSeries(HistogramSeries, {
          color: '#4B5563', priceFormat: { type: 'volume' }, priceScaleId: 'volume',
        });
      }

      chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
      chartRef.current = chart;
      candleSeriesRef.current = candleSeries;

      // ── 실제 캔들 데이터 로드 ──────────────────────
      setSource('loading');
      let candles: KlineData[] = [];
      try {
        candles = await fetchKlines(symbol, toInterval(timeframe), 500);
        setSource('live');
      } catch (e) {
        // fallback: mock data
        const mock = getMockCandles(symbol, timeframe);
        candles = mock.map(m => ({ time: m.time, open: m.open, high: m.high, low: m.low, close: m.close, volume: m.volume }));
        setSource('mock');
      }

      candleSeries.setData(candles.map(c => ({ time: c.time as any, open: c.open, high: c.high, low: c.low, close: c.close })));
      volSeries.setData(candles.map(c => ({ time: c.time as any, value: c.volume, color: c.close >= c.open ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)' })));

      // ── 포지션 라인 (실제 positions 우선, fallback mock) ──
      const pos = positions.find(p => p.symbol === symbol) ?? mockPositions[0];
      if (pos && candleSeries.createPriceLine) {
        const ep = parseFloat((pos as any).entryPrice);
        const tp = parseFloat((pos as any).takeProfitPrice ?? '0');
        const sl = parseFloat((pos as any).stopLossPrice ?? '0');
        const mp = parseFloat((pos as any).markPrice ?? '0');
        if (ep > 0) candleSeries.createPriceLine({ price: ep, color: '#EAB308', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: '진입가' });
        if (tp > 0) candleSeries.createPriceLine({ price: tp, color: '#10B981', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'TP' });
        if (sl > 0) candleSeries.createPriceLine({ price: sl, color: '#EF4444', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'SL' });
        if (mp > 0) candleSeries.createPriceLine({ price: mp, color: '#60A5FA', lineWidth: 1, lineStyle: 0, axisLabelVisible: true, title: '마크가' });
      }

      chart.timeScale().fitContent();

      // ── WebSocket 실시간 캔들 ──────────────────────
      if (source !== 'mock') {
        connectWs(symbol, toInterval(timeframe), candleSeries);
      }

      // 리사이즈
      const observer = new ResizeObserver(() => {
        if (containerRef.current) chart.resize(containerRef.current.clientWidth, 320);
      });
      observer.observe(containerRef.current!);
      cleanup = () => observer.disconnect();
    };

    init();
    return () => {
      cleanup?.();
      if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    };
  }, [symbol, timeframe]);

  const connectWs = (sym: string, interval: string, candleSeries: any) => {
    const streamName = `${sym.toLowerCase()}@kline_${interval}`;

        const ws = new WebSocket(`wss://fstream.binance.com/ws/${streamName}`);
    wsRef.current = ws;

    ws.onopen = () => setWsStatus('연결됨');
    ws.onclose = () => {
        setWsStatus('끊김');
        setTimeout(() => {
          if (wsRef.current === ws) {
            const newWs = new WebSocket(`wss://fstream.binance.com/ws/${streamName}`);
            wsRef.current = newWs;
          }
        }, 3000);
      };
    ws.onerror = () => setWsStatus('끊김');

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.e !== 'kline') return;
        const k = msg.k;
        candleSeries.update({
          time: Math.floor(k.t / 1000) as any,
          open:  parseFloat(k.o),
          high:  parseFloat(k.h),
          low:   parseFloat(k.l),
          close: parseFloat(k.c),
        });
      } catch {}
    };
  };

  // 데이터 소스 배지
  const badge = source === 'live'
    ? { text: 'LIVE DATA', color: '#4ADE80', bg: 'rgba(74,222,128,0.1)' }
    : source === 'mock'
    ? { text: 'MOCK FALLBACK', color: '#F87171', bg: 'rgba(248,113,113,0.1)' }
    : { text: 'LOADING...', color: '#9CA3AF', bg: 'rgba(156,163,175,0.1)' };

  const wsColor = wsStatus === '연결됨' ? '#4ADE80' : wsStatus === '연결중' ? '#EAB308' : '#F87171';

  return (
    <div style={{ position: 'relative' }}>
      {/* 상태 배지 */}
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
