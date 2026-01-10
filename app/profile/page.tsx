'use client'

import { useState, FormEvent, useEffect } from 'react'
import { createClient } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import type { Relationship } from '@/lib/realtime/types'

const RELATIONSHIPS: Relationship[] = ['Mother', 'Father', 'Grandparent', 'Aunt/Uncle', 'Friend']

export default function ProfilePage() {
  const [name, setName] = useState('')
  const [relationship, setRelationship] = useState<Relationship>('Friend')
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState<{ isOpen: boolean; title: string; message: string; type?: 'info' | 'success' | 'error' | 'warning' }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  })
  const router = useRouter()
  const supabase = createClient()

  const showModal = (title: string, message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    setModal({ isOpen: true, title, message, type })
  }

  const closeModal = () => {
    setModal({ isOpen: false, title: '', message: '', type: 'info' })
  }

  useEffect(() => {
    const loadProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        if (data) {
          // Type assertion for selected fields
          const profileData = data as { name: string; relationship: string }
          setName(profileData.name)
          setRelationship(profileData.relationship as Relationship)
        }
      }
    }
    loadProfile()
  }, [supabase])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      // Type assertion for upsert operation - cast as any to bypass Supabase type inference issues
      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        name,
        relationship,
      } as any)

      if (error) throw error

      router.push('/dashboard')
    } catch (err: any) {
      console.error('Error saving profile:', err)
      showModal('Error', 'Failed to save profile. Please try again.', 'error')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-100 to-blue-100 px-4 py-8">
      <div className="bg-white rounded-lg shadow-xl p-6 sm:p-8 w-full max-w-md">
        <h1 className="text-2xl sm:text-3xl font-bold text-center mb-2 text-pink-600">
          Complete Your Profile
        </h1>
        <p className="text-center text-gray-600 mb-6 sm:mb-8 text-sm sm:text-base">Tell us a bit about yourself</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent min-h-[44px]"
              placeholder="Your name"
            />
          </div>

          <div>
            <label htmlFor="relationship" className="block text-sm font-medium text-gray-700 mb-2">
              Relationship
            </label>
            <select
              id="relationship"
              value={relationship}
              onChange={(e) => setRelationship(e.target.value as Relationship)}
              required
              className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent min-h-[44px]"
            >
              {RELATIONSHIPS.map((rel) => (
                <option key={rel} value={rel}>
                  {rel}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-pink-600 text-white py-3 px-4 rounded-lg font-semibold text-base hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
          >
            {loading ? 'Saving...' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}

