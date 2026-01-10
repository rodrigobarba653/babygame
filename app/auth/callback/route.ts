import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  if (code) {
    const cookieStore = await cookies()
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error('Auth callback error:', error)
      return NextResponse.redirect(new URL('/login?error=auth_failed', origin))
    }

    // After successful session exchange, check for profile
    // Create a new client to check user/profile with fresh session
    const {
      data: { user },
    } = await supabase.auth.getUser()

    let redirectUrl = '/dashboard'
    
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single()

      if (!profile) {
        redirectUrl = '/profile'
      }
    }

    // Create redirect response and copy all cookies to it
    const response = NextResponse.redirect(new URL(redirectUrl, origin))
    cookieStore.getAll().forEach((cookie) => {
      response.cookies.set(cookie.name, cookie.value)
    })

    return response
  }

  return NextResponse.redirect(new URL('/login', origin))
}

