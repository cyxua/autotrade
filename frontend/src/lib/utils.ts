export function fmtUsdt(val: number, decimals = 2): string {
  return val.toLocaleString('ko-KR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
export function fmtPct(val: number): string {
  return `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`;
}

// Axios 에러에서 안전하게 메시지 추출
export function getApiErrorMessage(error: unknown, fallback = '오류가 발생했습니다.'): string {
  if (error !== null && typeof error === 'object') {
    const e = error as Record<string, unknown>;
    const res = e['response'] as Record<string, unknown> | undefined;
    const data = res?.['data'] as Record<string, unknown> | undefined;
    const errObj = data?.['error'] as Record<string, unknown> | undefined;
    const msg = errObj?.['message'];
    if (typeof msg === 'string') return msg;
    if (typeof e['message'] === 'string') return e['message'] as string;
  }
  return fallback;
}
