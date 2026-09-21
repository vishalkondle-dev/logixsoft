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
    const hasSessionCookie = SESSION_COOKIE_NAMES.some((cookieName) =>
      request.cookies.has(cookieName)
    );

    if (!hasSessionCookie) {
      const loginUrl = new URL('/', request.url);
      loginUrl.searchParams.set('login', 'true');
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/pos/:path*',
    '/orders/:path*',
    '/tables/:path*',
    '/menu/:path*',
    '/reports/:path*',
    '/settings/:path*',
    '/customers/:path*',
    '/kitchen/:path*',
    '/admin/:path*',
  ],
};
