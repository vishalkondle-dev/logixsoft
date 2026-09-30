import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED_PREFIXES = [
  '/pos',
  '/orders',
  '/tables',
  '/menu',
  '/reports',
  '/settings',
  '/customers',
  '/kitchen',
  '/waiter',
  '/rider',
  '/admin',
];

const SESSION_COOKIE_NAMES = [
  'logix-dine.session_token',
  '__Secure-logix-dine.session_token',
  'better-auth.session_token',
  '__Secure-better-auth.session_token',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isProtected) {
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
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/pos',
    '/pos/:path*',
    '/orders',
    '/orders/:path*',
    '/tables',
    '/tables/:path*',
    '/menu',
    '/menu/:path*',
    '/reports',
    '/reports/:path*',
    '/settings',
    '/settings/:path*',
    '/customers',
    '/customers/:path*',
    '/kitchen',
    '/kitchen/:path*',
    '/waiter',
    '/waiter/:path*',
    '/rider',
    '/rider/:path*',
    '/admin',
    '/admin/:path*',
  ],
};
