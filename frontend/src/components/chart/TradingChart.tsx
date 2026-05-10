'use client';
import { useEffect, useRef } from 'react';
import { useChartStore } from '@/store/chartStore';
import { getMockCandles } from '@/mock/candles.mock';
import { mockPositions } from '@/mock/positions.mock';

export function TradingChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const { symbol, timeframe } = useChartStore();

  useEffect(() => {
    if (!containerRef.current || typeof window === 'undefined') return;

    const run = async () => {
      const { createChart, CrosshairMode } = await import('lightweight-charts');

      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }

      const chart = createChart(containerRef.current!, {
        layout: { background: { color: '#111827' }, textColor: '#9CA3AF' },
        grid: { vertLines: { color: '#1F2937' }, horzLines: { color: '#1F2937' } },
        crosshair: { mode: CrosshairMode.Normal },
        rightPriceScale: { borderColor: '#374151' },
        timeScale: { borderColor: '#374151', timeVisible: true, secondsVisible: false },
        width: containerRef.current!.clientWidth,
        height: 320,
      });

      // 캔들 시리즈
      const candleSeries = chart.addCandlestickSeries({
        upColor: '#10B981', downColor: '#EF4444',
        borderUpColor: '#10B981', borderDownColor: '#EF4444',
        wickUpColor: '#10B981', wickDownColor: '#EF4444',
      });

      // 거래량 시리즈
      const volSeries = chart.addHistogramSeries({
        color: '#4B5563',
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      });
      chart.priceScale('volume').applyOptions({
        scaleMargins: { top: 0.85, bottom: 0 },
      });

      chartRef.current = chart;

      // Mock 데이터 설정
      const candles = getMockCandles(symbol, timeframe);
      candleSeries.setData(
        candles.map(c => ({ time: c.time as any, open: c.open, high: c.high, low: c.low, close: c.close }))
      );
      volSeries.setData(
        candles.map(c => ({
          time: c.time as any,
          value: c.volume,
          color: c.close >= c.open ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)',
        }))
      );

      // 포지션 라인 (TP / SL / 진입가)
      const pos = mockPositions[0];
      if (pos) {
        candleSeries.createPriceLine({ price: pos.entryPrice, color: '#EAB308', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: '진입가' });
        candleSeries.createPriceLine({ price: pos.takeProfitPrice, color: '#10B981', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'TP' });
        candleSeries.createPriceLine({ price: pos.stopLossPrice, color: '#EF4444', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'SL' });
      }

      chart.timeScale().fitContent();

      // 반응형 리사이즈
      const observer = new ResizeObserver(() => {
        if (containerRef.current) chart.resize(containerRef.current.clientWidth, 320);
      });
      observer.observe(containerRef.current!);

      return () => observer.disconnect();
    };

    run();
    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [symbol, timeframe]);

  return <div ref={containerRef} style={{ width: '100%' }} />;
}
