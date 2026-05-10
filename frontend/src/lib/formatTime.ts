/**
 * 서버/클라이언트 로케일 불일치(Hydration Error) 방지를 위해
 * 로케일을 'ko-KR'로 고정한 시간 포맷 유틸
 */

export function formatTime(dateInput: string | number | Date): string {
  return new Date(dateInput).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

export function formatDateTime(dateInput: string | number | Date): string {
  return new Date(dateInput).toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

export function formatDate(dateInput: string | number | Date): string {
  return new Date(dateInput).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}
