import { NextRequest, NextResponse } from 'next/server';

export function checkCsrf(req: NextRequest): NextResponse | null {
  const method = req.method;
  if (!['POST', 'PATCH', 'DELETE'].includes(method)) {
    return null;
  }

  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  const host = req.headers.get('host');

  if (!host) {
    return NextResponse.json({ error: 'Missing host header' }, { status: 403 });
  }

  if (origin) {
    try {
      const originUrl = new URL(origin);
      if (originUrl.host !== host) {
        return NextResponse.json({ error: 'CSRF token mismatch' }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: 'Invalid Origin header' }, { status: 403 });
    }
  } else if (referer) {
    try {
      const refererUrl = new URL(referer);
      if (refererUrl.host !== host) {
        return NextResponse.json({ error: 'CSRF token mismatch' }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: 'Invalid Referer header' }, { status: 403 });
    }
  } else {
    return NextResponse.json({ error: 'Missing Origin and Referer headers' }, { status: 403 });
  }

  return null;
}
