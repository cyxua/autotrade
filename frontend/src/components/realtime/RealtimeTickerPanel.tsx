'use client';
import { useEffect, useRef } from 'react';
import { useRealtimeTickerStore } from '@/store/useRealtimeTickerStore';
import { PriceFlash } from './PriceFlash';
import { ConnectionStatusBadge } from './ConnectionStatusBadge';
import { LivePriceRow } from './LivePriceRow';

interface Props { symbol: string; }

const WS_BASE = 'wss://fstream.binance.com/stream?streams=';

function fmt(v: string, decimals = 2) {
  const n = parseFloat(v);
  if (isNaN(n)) return '-';
  return n.toLocaleString('ko-KR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtVol(v: string) {
  const n = parseFloat(v);
  if (isNaN(n)) return '-';
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  return n.toFixed(2);
}

export function RealtimeTickerPanel({ symbol }: Props) {
  const {
    lastPrice, markPrice, bestBid, bestAsk,
    priceChangePercent, highPrice24h, lowPrice24h,
    quoteVolume24h, tradeCount24h, lastTradeQty, lastTradeSide,
    previousPrice,
    updateMarkPrice, updateAggTrade, updateBookTicker, updateTicker24h,
    setConnectionStatus, setSymbol,
  } = useRealtimeTickerStore();

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSymbol(symbol);
    const sym = symbol.toLowerCase();
    const streams = [
      `${sym}@markPrice@1s`,
      `${sym}@aggTrade`,
      `${sym}@bookTicker`,
      `${sym}@ticker`,
    ].join('/');

    const connect = () => {
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }

      setConnectionStatus('연결중');
      const ws = new WebSocket(`${WS_BASE}${streams}`);
      wsRef.current = ws;

      ws.onopen = () => setConnectionStatus('연결됨');

      ws.onmessage = (e) => {
        try {
          const { stream, data } = JSON.parse(e.data);
          if (!stream || !data) return;

          if (stream.includes('@markPrice')) {
            updateMarkPrice({ markPrice: data.p });
          } else if (stream.includes('@aggTrade')) {
            updateAggTrade({
              price: data.p,
              qty: data.q,
              isBuyerMaker: data.m,
            });
          } else if (stream.includes('@bookTicker')) {
            updateBookTicker({ bestBid: data.b, bestAsk: data.a });
          } else if (stream.includes('@ticker')) {
            updateTicker24h({
              priceChangePercent: data.P,
              highPrice: data.h,
              lowPrice: data.l,
              quoteVolume: data.q,
              tradeCount: data.n,
            });
          }
        } catch {}
      };

      ws.onclose = () => {
        setConnectionStatus('재연결중');
        reconnectRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => setConnectionStatus('끊김');
    };

    connect();

    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  const changeNum = parseFloat(priceChangePercent);
  const changeColor = changeNum >= 0 ? '#4ADE80' : '#F87171';
  const changePrefix = changeNum >= 0 ? '+' : '';

  return (
    <div style={{
      background: '#1F2937',
      border: '1px solid #374151',
      borderRadius: '8px',
      padding: '12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      minWidth: '200px',
    }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#F3F4F6' }}>{symbol}</span>
        <ConnectionStatusBadge />
      </div>

      {/* 현재가 */}
      <div style={{ borderBottom: '1px solid #374151', paddingBottom: '8px' }}>
        <PriceFlash value={fmt(lastPrice)} previousValue={fmt(previousPrice)} fontSize="20px" />
        <div style={{ marginTop: '2px' }}>
          <span suppressHydrationWarning style={{ fontSize: '12px', color: changeColor, fontWeight: 'bold' }}>
            {changePrefix}{changeNum.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* 마크 가격 */}
      <LivePriceRow label="마크 가격" value={fmt(markPrice)} color="#F3F4F6" />

      {/* 호가 */}
      <div style={{ background: '#111827', borderRadius: '6px', padding: '6px 8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
          <span style={{ color: '#6B7280' }}>매도(Ask)</span>
          <span suppressHydrationWarning style={{ color: '#F87171', fontWeight: 'bold' }}>{fmt(bestAsk)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
          <span style={{ color: '#6B7280' }}>매수(Bid)</span>
          <span suppressHydrationWarning style={{ color: '#4ADE80', fontWeight: 'bold' }}>{fmt(bestBid)}</span>
        </div>
      </div>

      {/* 최근 체결 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
        <span style={{ color: '#6B7280' }}>최근 체결</span>
        <span suppressHydrationWarning style={{ color: lastTradeSide === 'BUY' ? '#4ADE80' : '#F87171' }}>
          {lastTradeSide === 'BUY' ? '▲' : lastTradeSide === 'SELL' ? '▼' : '-'} {fmt(lastTradeQty, 4)}
        </span>
      </div>

      {/* 24시간 통계 */}
      <div style={{ borderTop: '1px solid #374151', paddingTop: '6px' }}>
        <LivePriceRow label="24h 고가" value={fmt(highPrice24h)} color="#4ADE80" />
        <LivePriceRow label="24h 저가" value={fmt(lowPrice24h)} color="#F87171" />
        <LivePriceRow label="24h 거래대금" value={fmtVol(quoteVolume24h)} suffix=" USDT" />
        <LivePriceRow label="24h 거래 횟수" value={tradeCount24h > 0 ? tradeCount24h.toLocaleString('ko-KR') : '-'} />
      </div>
    </div>
  );
}
