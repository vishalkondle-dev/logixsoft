import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE_NAMES = [
  'logix-dine.session_token',
  '__Secure-logix-dine.session_token',
  'better-auth.session_token',
  '__Secure-better-auth.session_token',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Allow homepage, static files, next.js internals, and public downloads
  if (
    pathname === '/' ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/download') ||
    pathname === '/favicon.ico' ||
    pathname === '/favicon.svg' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname === '/manifest.json' ||
    /\.(svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|css|js)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  // 2. All restaurant interaction routes require user authentication
  const hasSessionCookie = SESSION_COOKIE_NAMES.some((cookieName) => {
    const cookie = request.cookies.get(cookieName);
    return Boolean(cookie?.value);
  });

  if (!hasSessionCookie) {
    const loginUrl = new URL('/', request.url);
    loginUrl.searchParams.set('login', 'true');
    const nextPath = `${pathname}${request.nextUrl.search || ''}`;
    loginUrl.searchParams.set('next', nextPath);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
