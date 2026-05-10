export interface MockCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function generateCandles(basePrice: number, count: number, intervalSec: number): MockCandle[] {
  const now = Math.floor(Date.now() / 1000);
  const candles: MockCandle[] = [];
  let price = basePrice;

  for (let i = count; i >= 0; i--) {
    const change = (Math.random() - 0.48) * basePrice * 0.012;
    const open = price;
    const close = Math.max(price + change, basePrice * 0.5);
    const high = Math.max(open, close) * (1 + Math.random() * 0.005);
    const low  = Math.min(open, close) * (1 - Math.random() * 0.005);
    const volume = basePrice * (50 + Math.random() * 200);
    candles.push({
      time: now - i * intervalSec,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume: parseFloat(volume.toFixed(2)),
    });
    price = close;
  }
  return candles;
}

const BASE_PRICES: Record<string, number> = {
  BTCUSDT: 65000, ETHUSDT: 3200, SOLUSDT: 140,
  BNBUSDT: 580, XRPUSDT: 0.52, DOGEUSDT: 0.15,
};

const INTERVAL_SECS: Record<string, number> = {
  '1m': 60, '5m': 300, '15m': 900,
  '1h': 3600, '4h': 14400, '1d': 86400,
};

export function getMockCandles(symbol: string, timeframe: string): MockCandle[] {
  const base = BASE_PRICES[symbol] ?? 100;
  const interval = INTERVAL_SECS[timeframe] ?? 900;
  return generateCandles(base, 150, interval);
}
