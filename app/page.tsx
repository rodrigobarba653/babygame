import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

export default async function Home() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    // If there's an auth error, redirect to login
    if (error || !user) {
      redirect('/login')
    }

    redirect('/dashboard')
  } catch (error) {
    // Log error for debugging (will show in Vercel logs)
    console.error('Home page error:', error)
    
    // Re-throw to show error page
    throw error
  }
}

