export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          name: string
          relationship: string
          created_at: string
        }
        Insert: {
          id: string
          name: string
          relationship: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          relationship?: string
          created_at?: string
        }
      }
      sessions: {
        Row: {
          code: string
          host_id: string
          created_at: string
          expires_at: string | null
          status: string
          winner_id: string | null
        }
        Insert: {
          code: string
          host_id: string
          created_at?: string
          expires_at?: string | null
          status?: string
          winner_id?: string | null
        }
        Update: {
          code?: string
          host_id?: string
          created_at?: string
          expires_at?: string | null
          status?: string
          winner_id?: string | null
        }
      }
    }
  }
}

