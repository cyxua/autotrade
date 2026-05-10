export function fmtUsdt(val: number, decimals = 2): string {
  return val.toLocaleString('ko-KR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
export function fmtPct(val: number): string {
  return `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`;
}
