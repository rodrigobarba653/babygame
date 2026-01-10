import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // If environment variables are missing, allow request to pass through
  // This prevents middleware from crashing during deployment setup
  if (!url || !key) {
    console.error('Missing Supabase environment variables in middleware')
    return NextResponse.next()
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  try {
    const supabase = createServerClient(url, key, {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name, value, ...options })
        },
      },
    })

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const isLoginPage = request.nextUrl.pathname === '/login'
    const isProfilePage = request.nextUrl.pathname === '/profile'
    const isAuthCallback = request.nextUrl.pathname === '/auth/callback'

    // Don't interfere with auth callback - let it handle its own redirect
    if (isAuthCallback) {
      return response
    }

    // Redirect to login if not authenticated (except for login page)
    if (!user && !isLoginPage) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // If authenticated, check profile (but not on login or profile pages)
    if (user && !isLoginPage && !isProfilePage) {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single()

      // Redirect to profile if no profile exists (error means no profile found)
      if (error || !profile) {
        return NextResponse.redirect(new URL('/profile', request.url))
      }
    }

    return response
  } catch (error) {
    // If there's any error in middleware, log it and allow request to continue
    // This prevents middleware from crashing the entire app
    console.error('Middleware error:', error)
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api routes (handled separately)
     * - auth routes (handled separately)
     */
    '/((?!_next/static|_next/image|favicon.ico|api|auth).*)',
  ],
}
