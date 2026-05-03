import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/login', '/forgot-password', '/reset-password']

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

  // Use getSession() - reads from cookies without external call
  // This avoids race condition right after login
  const { data: { session } } = await supabase.auth.getSession()

  const isPublic = PUBLIC_ROUTES.some(r => request.nextUrl.pathname.startsWith(r))
  const isApi    = request.nextUrl.pathname.startsWith('/api/')
  const isAsset  = request.nextUrl.pathname.startsWith('/_next') ||
                   request.nextUrl.pathname.match(/\.(svg|ico|png|jpg|webp|css|js)$/)

  // If asset or API, always pass through
  if (isAsset || isApi) return response

  // If not logged in and not on a public route, redirect to login
  if (!session && !isPublic) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  // If logged in and trying to access login, redirect to POS
  if (session && request.nextUrl.pathname === '/login') {
    return NextResponse.redirect(new URL('/pos', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|favicon.svg).*)'],
}
