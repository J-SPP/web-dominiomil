import { NextResponse } from 'next/server';
import { verifyJWT } from './lib/auth';

export async function proxy(request) {
  const { pathname } = request.nextUrl;

  // Protect /dashboard paths
  if (pathname.startsWith('/dashboard')) {
    const token = request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const payload = await verifyJWT(token);
    if (!payload) {
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete('token');
      return response;
    }
  }

  // If user is logged in, redirect them from login/signup to dashboard
  if (pathname === '/login' || pathname === '/signup') {
    const token = request.cookies.get('token')?.value;
    if (token) {
      const payload = await verifyJWT(token);
      if (payload) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/signup'],
};
