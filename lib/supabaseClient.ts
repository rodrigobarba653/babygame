import { createBrowserClient } from '@supabase/ssr'
import { Database } from './database.types'

let client: ReturnType<typeof createBrowserClient<Database>> | null = null

// Placeholder values for build-time only - never used in actual runtime
const PLACEHOLDER_URL = 'https://placeholder-project.supabase.co'
const PLACEHOLDER_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const isServer = typeof window === 'undefined'

  // If env vars are missing, use placeholders to prevent build errors
  // This happens during build when env vars aren't set in Vercel
  // The actual client will be recreated in browser with real values
  if (!url || !key) {
    return createBrowserClient<Database>(PLACEHOLDER_URL, PLACEHOLDER_KEY)
  }

  // In browser, cache and return the client
  if (!isServer) {
    if (client) {
      return client
    }
    client = createBrowserClient<Database>(url, key)
    return client
  }

  // During SSR/build, create client with available env vars
  // (should have placeholders if env vars missing, handled above)
  return createBrowserClient<Database>(url, key)
}

