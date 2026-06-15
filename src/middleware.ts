import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/login', '/forgot-password', '/reset-password', '/track']
const API_PUBLIC_ROUTES = ['/api/webhooks', '/api/sumup/webhook', '/api/sumup/solo-webhook']

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  const { pathname } = request.nextUrl

  // Skip auth check for public routes and webhooks
  const isPublic = PUBLIC_ROUTES.some((route) => pathname.startsWith(route))
  const isPublicApi = API_PUBLIC_ROUTES.some((route) => pathname.startsWith(route))

  if (isPublic || isPublicApi) {
    // Still refresh token for logged-in users on public pages
    await supabase.auth.getUser()
    return response
  }

  // Validate session — getUser() hits the auth server (no stale cache)
  const { data: { user }, error } = await supabase.auth.getUser()

  // Redirect unauthenticated users to login (except API routes)
  if (error || !user) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect authenticated users away from login
  if (pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|favicon.svg|products/|.well-known/).*)'],
}
