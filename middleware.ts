import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  // Create Supabase client that can update session cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
      global: {
        fetch: (url, options) => {
          return fetch(url, { ...options, cache: 'no-store' })
        }
      }
    }
  )

  // Refresh session — must be called before any redirect logic
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // --- PROTECTED ROUTES ---
  const isProtectedPath =
    pathname.startsWith('/dashboard') || pathname.startsWith('/order')

  if (!user && isProtectedPath) {
    // Unauthenticated → /login
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user) {
    // Fetch role for role-based redirect
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role ?? 'customer'

    // Customer trying to access /dashboard → /order
    if (role === 'customer' && pathname.startsWith('/dashboard')) {
      const url = request.nextUrl.clone()
      url.pathname = '/order'
      return NextResponse.redirect(url)
    }

    // Staff trying to access exact /dashboard → /dashboard/{role}
    if ((role === 'manager' || role === 'cook' || role === 'waiter') && pathname === '/dashboard') {
      const url = request.nextUrl.clone()
      url.pathname = `/dashboard/${role}`
      return NextResponse.redirect(url)
    }

    // Logged-in user hitting /login or /signup → redirect to correct home
    if (pathname === '/login' || pathname === '/signup') {
      const url = request.nextUrl.clone()
      if (role === 'owner') {
        url.pathname = '/dashboard'
      } else if (role === 'cook') {
        url.pathname = '/dashboard/cook'
      } else if (role === 'manager') {
        url.pathname = '/dashboard/manager'
      } else {
        url.pathname = '/order'
      }
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
