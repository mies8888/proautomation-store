import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'
import { NextResponse } from 'next/server'

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const protectedRoutes = ['/dashboard']
  const isOnDashboard = protectedRoutes.some(route => req.nextUrl.pathname.startsWith(route))
  const isOnAdmin = req.nextUrl.pathname.startsWith('/admin')
  const isApi = req.nextUrl.pathname.startsWith('/api')
  const method = req.method

  // CSRF / Origin Protection for Mutating API Routes
  if (isApi && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    const origin = req.headers.get('origin')
    const host = req.headers.get('host')
    
    if (origin) {
      try {
        const originUrl = new URL(origin)
        if (originUrl.host !== host) {
          return new NextResponse(JSON.stringify({ error: 'Invalid Origin - CSRF Protection' }), { 
            status: 403, 
            headers: { 'Content-Type': 'application/json' } 
          })
        }
      } catch (e) {
        return new NextResponse(JSON.stringify({ error: 'Bad Origin' }), { status: 403 })
      }
    }
  }

  if (isOnDashboard || isOnAdmin) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL('/login', req.nextUrl))
    }
    
    if (isOnAdmin && req.auth?.user?.role !== 'ADMIN' && req.auth?.user?.role !== 'SUPER_ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', req.nextUrl))
    }
    return NextResponse.next()
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
