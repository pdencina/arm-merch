import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED_ROUTES: Record<string, string[]> = {
  '/dashboard':        ['voluntario', 'admin', 'super_admin'],
  '/pos':              ['voluntario', 'admin', 'super_admin'],
  '/inventory':        ['admin', 'super_admin'],
  '/products':         ['admin', 'super_admin'],
  '/orders':           ['admin', 'super_admin'],
  '/reports':          ['admin', 'super_admin'],
  '/settings':         ['super_admin'],
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Si no hay variables de entorno, dejar pasar (evita crash en edge)
  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() { return request.cookies.getAll() },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options))
      },
    },
  })

  try {
    const { data: { user } } = await supabase.auth.getUser()

    // Sin sesión y ruta protegida → login
    const isProtected = Object.keys(PROTECTED_ROUTES).some(r => pathname.startsWith(r))
    if (!user && isProtected) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    // Con sesión en /login → dashboard
    if (user && pathname === '/login') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    // Verificar rol
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      const userRole = (profile as any)?.role ?? 'voluntario'

      for (const [route, allowedRoles] of Object.entries(PROTECTED_ROUTES)) {
        if (pathname.startsWith(route) && !allowedRoles.includes(userRole)) {
          const url = request.nextUrl.clone()
          url.pathname = '/dashboard'
          return NextResponse.redirect(url)
        }
      }
    }
  } catch {
    // Si falla por cualquier razón, dejar pasar sin crashear
    return NextResponse.next()
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
