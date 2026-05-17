'use client';
import { useState, useEffect, useRef } from 'react';
import { fetchSymbols, fetchTickers, SymbolInfo, TickerInfo } from '@/lib/futuresApi';
import { useChartStore } from '@/store/chartStore';

const FAVORITES_KEY = 'autotrade_favorites';
const RECENT_KEY = 'autotrade_recent';
const MAX_RECENT = 5;

export function SymbolSelector() {
  const { symbol, setSymbol } = useChartStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [symbols, setSymbols] = useState<SymbolInfo[]>([]);
  const [tickers, setTickers] = useState<Record<string, TickerInfo>>({});
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'search' | 'favorites' | 'volume'>('search');
  const inputRef = useRef<HTMLInputElement>(null);

  // localStorage 로드
  useEffect(() => {
    try {
      setFavorites(JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? '[]'));
      setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'));
    } catch {}
  }, []);

  // 종목 목록 & 티커 로드
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([fetchSymbols(), fetchTickers()])
      .then(([syms, ticks]) => {
        setSymbols(syms);
        const map: Record<string, TickerInfo> = {};
        ticks.forEach(t => { map[t.symbol] = t; });
        setTickers(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const selectSymbol = (s: string) => {
    setSymbol(s);
    setOpen(false);
    setQuery('');
    const newRecent = [s, ...recent.filter(r => r !== s)].slice(0, MAX_RECENT);
    setRecent(newRecent);
    localStorage.setItem(RECENT_KEY, JSON.stringify(newRecent));
  };

  const toggleFav = (s: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = favorites.includes(s) ? favorites.filter(f => f !== s) : [...favorites, s];
    setFavorites(next);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
  };

  const fmtVol = (v: string) => {
    const n = parseFloat(v);
    if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
    return `${(n / 1e3).toFixed(0)}K`;
  };

  const fmtPct = (p: string) => {
    const n = parseFloat(p);
    return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
  };

  // 필터링
  const q = query.toUpperCase();
  let filtered = symbols.filter(s =>
    s.symbol.includes(q) || s.baseAsset.includes(q)
  );

  if (tab === 'favorites') {
    filtered = symbols.filter(s => favorites.includes(s.symbol));
  } else if (tab === 'volume') {
    filtered = [...symbols].sort((a, b) =>
      parseFloat(tickers[b.symbol]?.quoteVolume ?? '0') - parseFloat(tickers[a.symbol]?.quoteVolume ?? '0')
    ).slice(0, 30);
  }

  const inp = { outline: 'none', background: 'transparent', color: '#F9FAFB', fontSize: '13px', border: 'none', flex: 1 } as const;
  const tabBtn = (active: boolean) => ({
    padding: '4px 10px', fontSize: '12px', border: 'none', cursor: 'pointer', borderRadius: '6px',
    background: active ? 'rgba(234,179,8,0.15)' : 'transparent',
    color: active ? '#EAB308' : '#6B7280',
  } as const);

  return (
    <div style={{ position: 'relative' }}>
      {/* 현재 종목 버튼 */}
      <button onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '6px 12px', background: '#1F2937', border: '1px solid #374151',
        borderRadius: '8px', color: '#F9FAFB', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold',
      }}>
        {symbol}
        <span style={{ color: '#9CA3AF', fontSize: '12px' }}>▼</span>
      </button>

      {/* 드롭다운 */}
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 200, marginTop: '4px',
          background: '#111827', border: '1px solid #374151', borderRadius: '12px',
          width: '360px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}>
          {/* 검색 입력 */}
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #1F2937', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#6B7280' }}>🔍</span>
            <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
              placeholder="BTCUSDT 또는 BTC 검색..."
              style={{ ...inp, width: '100%' }} />
            {query && <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer' }}>✕</button>}
          </div>

          {/* 탭 */}
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #1F2937', display: 'flex', gap: '4px' }}>
            <button style={tabBtn(tab === 'search')} onClick={() => setTab('search')}>전체</button>
            <button style={tabBtn(tab === 'favorites')} onClick={() => setTab('favorites')}>⭐ 즐겨찾기</button>
            <button style={tabBtn(tab === 'volume')} onClick={() => setTab('volume')}>거래량 상위</button>
          </div>

          {/* 최근 선택 (검색 탭 + 쿼리 없을 때) */}
          {tab === 'search' && !query && recent.length > 0 && (
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #1F2937' }}>
              <p style={{ fontSize: '11px', color: '#4B5563', marginBottom: '6px' }}>최근 선택</p>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {recent.map(s => (
                  <button key={s} onClick={() => selectSymbol(s)} style={{
                    padding: '3px 8px', background: '#1F2937', border: '1px solid #374151',
                    borderRadius: '6px', color: '#D1D5DB', fontSize: '12px', cursor: 'pointer',
                  }}>{s.replace('USDT','')}</button>
                ))}
              </div>
            </div>
          )}

          {/* 종목 목록 */}
          <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#4B5563', fontSize: '13px' }}>불러오는 중...</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#4B5563', fontSize: '13px' }}>검색 결과 없음</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ color: '#4B5563', borderBottom: '1px solid #1F2937' }}>
                    <th style={{ padding: '6px 12px', textAlign: 'left', fontWeight: 'normal' }}>종목</th>
                    <th style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 'normal' }}>현재가</th>
                    <th style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 'normal' }}>24h%</th>
                    <th style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 'normal' }}>거래대금</th>
                    <th style={{ padding: '6px 4px', textAlign: 'center', fontWeight: 'normal' }}>⭐</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => {
                    const t = tickers[s.symbol];
                    const pct = parseFloat(t?.priceChangePercent ?? '0');
                    const isSel = symbol === s.symbol;
                    return (
                      <tr key={s.symbol} onClick={() => selectSymbol(s.symbol)}
                        style={{ cursor: 'pointer', background: isSel ? 'rgba(234,179,8,0.08)' : 'transparent', borderBottom: '1px solid rgba(31,41,55,0.5)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                        onMouseLeave={e => (e.currentTarget.style.background = isSel ? 'rgba(234,179,8,0.08)' : 'transparent')}>
                        <td style={{ padding: '7px 12px' }}>
                          <span style={{ fontWeight: '600', color: isSel ? '#EAB308' : '#F9FAFB' }}>{s.baseAsset}</span>
                          <span style={{ color: '#4B5563' }}>/USDT</span>
                        </td>
                        <td style={{ padding: '7px 12px', textAlign: 'right', color: '#D1D5DB' }}>
                          {t ? parseFloat(t.lastPrice).toLocaleString(undefined, { maximumFractionDigits: 4 }) : '-'}
                        </td>
                        <td style={{ padding: '7px 12px', textAlign: 'right', color: pct >= 0 ? '#4ADE80' : '#F87171', fontWeight: '500' }}>
                          {t ? fmtPct(t.priceChangePercent) : '-'}
                        </td>
                        <td style={{ padding: '7px 12px', textAlign: 'right', color: '#6B7280' }}>
                          {t ? fmtVol(t.quoteVolume) : '-'}
                        </td>
                        <td style={{ padding: '7px 4px', textAlign: 'center' }}>
                          <button onClick={e => toggleFav(s.symbol, e)} style={{
                            background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px',
                            opacity: favorites.includes(s.symbol) ? 1 : 0.3,
                          }}>⭐</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* 닫기 */}
          <div style={{ padding: '8px 12px', borderTop: '1px solid #1F2937', textAlign: 'right' }}>
            <button onClick={() => setOpen(false)} style={{ fontSize: '12px', color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer' }}>닫기</button>
          </div>
        </div>
      )}
    </div>
  );
}
