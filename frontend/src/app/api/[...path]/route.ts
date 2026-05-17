import { NextRequest, NextResponse } from 'next/server';

const BACKEND = 'http://127.0.0.1:4000';

async function handler(req: NextRequest, { params }: { params: { path: string[] } }) {
  const path = params.path.join('/');
  const url  = `${BACKEND}/api/${path}${req.nextUrl.search}`;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const cookie = req.headers.get('cookie');
  if (cookie) headers['cookie'] = cookie;

  const body = req.method !== 'GET' && req.method !== 'HEAD'
    ? await req.text() : undefined;

  try {
    const res  = await fetch(url, { method: req.method, headers, body });
    const data = await res.text();
    const response = new NextResponse(data, { status: res.status });

    const contentType = res.headers.get('content-type');
    if (contentType) response.headers.set('content-type', contentType);

    // Node 18+: getSetCookie() — as unknown 경유로 any 회피
    const rawHeaders = res.headers as unknown as { getSetCookie?: () => string[] };
    if (typeof rawHeaders.getSetCookie === 'function') {
      rawHeaders.getSetCookie().forEach(c => response.headers.append('set-cookie', c));
    } else {
      const setCookie = res.headers.get('set-cookie');
      if (setCookie) response.headers.set('set-cookie', setCookie);
    }
    return response;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '프록시 오류';
    return NextResponse.json({ success: false, error: { message: msg } }, { status: 500 });
  }
}

export const GET    = handler;
export const POST   = handler;
export const PUT    = handler;
export const DELETE = handler;
export const PATCH  = handler;
