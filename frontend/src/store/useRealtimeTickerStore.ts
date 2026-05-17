'use client';
import { create } from 'zustand';

export type ConnectionStatus = '연결중' | '연결됨' | '끊김' | '재연결중';
export type TradeSide = 'BUY' | 'SELL' | null;

interface RealtimeTickerState {
  symbol: string;
  lastPrice: string;
  markPrice: string;
  bestBid: string;
  bestAsk: string;
  priceChangePercent: string;
  highPrice24h: string;
  lowPrice24h: string;
  quoteVolume24h: string;
  tradeCount24h: number;
  lastTradeQty: string;
  lastTradeSide: TradeSide;
  previousPrice: string;
  connectionStatus: ConnectionStatus;
  lastUpdatedAt: number | null;

  setSymbol: (symbol: string) => void;
  updateMarkPrice: (data: { markPrice: string }) => void;
  updateAggTrade: (data: { price: string; qty: string; isBuyerMaker: boolean }) => void;
  updateBookTicker: (data: { bestBid: string; bestAsk: string }) => void;
  updateTicker24h: (data: {
    priceChangePercent: string;
    highPrice: string;
    lowPrice: string;
    quoteVolume: string;
    tradeCount: number;
  }) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
}

export const useRealtimeTickerStore = create<RealtimeTickerState>((set) => ({
  symbol: 'BTCUSDT',
  lastPrice: '-',
  markPrice: '-',
  bestBid: '-',
  bestAsk: '-',
  priceChangePercent: '0.00',
  highPrice24h: '-',
  lowPrice24h: '-',
  quoteVolume24h: '-',
  tradeCount24h: 0,
  lastTradeQty: '-',
  lastTradeSide: null,
  previousPrice: '-',
  connectionStatus: '연결중',
  lastUpdatedAt: null,

  setSymbol: (symbol) => set({ symbol }),

  updateMarkPrice: ({ markPrice }) =>
    set({ markPrice, lastUpdatedAt: Date.now() }),

  updateAggTrade: ({ price, qty, isBuyerMaker }) =>
    set((state) => ({
      previousPrice: state.lastPrice,
      lastPrice: price,
      lastTradeQty: qty,
      lastTradeSide: isBuyerMaker ? 'SELL' : 'BUY',
      lastUpdatedAt: Date.now(),
    })),

  updateBookTicker: ({ bestBid, bestAsk }) =>
    set({ bestBid, bestAsk }),

  updateTicker24h: ({ priceChangePercent, highPrice, lowPrice, quoteVolume, tradeCount }) =>
    set({
      priceChangePercent,
      highPrice24h: highPrice,
      lowPrice24h: lowPrice,
      quoteVolume24h: quoteVolume,
      tradeCount24h: tradeCount,
    }),

  setConnectionStatus: (status) => set({ connectionStatus: status }),
}));
