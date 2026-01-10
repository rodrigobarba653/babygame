'use client'

import { useState, useEffect, FormEvent } from 'react'
import { createClient } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { generateSessionCode } from '@/lib/utils'
import Modal from '@/components/Modal'

export default function DashboardPage() {
  const [sessionCode, setSessionCode] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [activeSession, setActiveSession] = useState<{ code: string; status: string } | null>(null)
  const [modal, setModal] = useState<{ isOpen: boolean; title: string; message: string; type?: 'info' | 'success' | 'error' | 'warning' }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  })
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
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
        const { data } = await supabase.from('profiles').select('name').eq('id', user.id).single()
        if (data) {
          setName(data.name)
        }

        // Check for active session where user is host and status is 'trivia_complete'
        // Also check for any session where user is host and status is not 'ended'
        const { data: sessions } = await supabase
          .from('sessions')
          .select('code, status')
          .eq('host_id', user.id)
          .neq('status', 'ended')
          .order('created_at', { ascending: false })
          .limit(1)

        if (sessions && sessions.length > 0) {
          const session = sessions[0]
          // Only show if status is 'trivia_complete' (can continue to pictionary)
          if (session.status === 'trivia_complete') {
            setActiveSession(session)
          }
        }
      }
    }
    loadProfile()
  }, [supabase])

  const handleDeleteSession = async () => {
    if (!activeSession) return
    setShowDeleteConfirm(true)
  }

  const confirmDeleteSession = async () => {
    if (!activeSession) return
    setShowDeleteConfirm(false)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      
      if (!user) {
        showModal('Error', 'You must be logged in to delete a session.', 'error')
        return
      }

      // First, verify the session exists and user is the host
      const { data: sessionCheck } = await supabase
        .from('sessions')
        .select('code, host_id')
        .eq('code', activeSession.code)
        .single()

      if (!sessionCheck) {
        showModal('Error', 'Session not found.', 'error')
        return
      }

      if (sessionCheck.host_id !== user.id) {
        showModal('Error', 'You do not have permission to delete this session. Only the host can delete it.', 'error')
        return
      }

      const { error, data } = await supabase
        .from('sessions')
        .delete()
        .eq('code', activeSession.code)
        .eq('host_id', user.id)
        .select()

      if (error) {
        console.error('Error deleting session:', error)
        // Check if it's an RLS policy error
        if (error.message?.includes('policy') || error.message?.includes('permission')) {
          showModal('Error', 'Failed to delete session due to permissions. Please check your database RLS policies. Run the SQL in FIX_DELETE_POLICY.sql', 'error')
        } else {
          showModal('Error', `Failed to delete session: ${error.message}`, 'error')
        }
        return
      }

      // Verify deletion succeeded
      if (!data || data.length === 0) {
        // No rows deleted - RLS policy might have blocked it
        showModal(
          'Error',
          'Failed to delete session. Missing RLS DELETE policy.\n\n' +
          'To fix: Go to Supabase SQL Editor and run:\n\n' +
          'CREATE POLICY "Hosts can delete their sessions"\n' +
          'ON sessions FOR DELETE\n' +
          'USING (auth.uid() = host_id);\n\n' +
          '(Or check the FIX_DELETE_POLICY.sql file)',
          'error'
        )
        return
      }

      const deletedCode = activeSession.code
      setActiveSession(null)
      showModal('Success', `Session ${deletedCode} has been deleted successfully.`, 'success')
      
      // Reload profile to refresh session list
      const { data: sessions } = await supabase
        .from('sessions')
        .select('code, status')
        .eq('host_id', user.id)
        .neq('status', 'ended')
        .order('created_at', { ascending: false })
        .limit(1)

      if (sessions && sessions.length > 0 && sessions[0].status === 'trivia_complete') {
        setActiveSession(sessions[0])
      }
    } catch (err: any) {
      console.error('Error deleting session:', err)
      showModal('Error', 'Failed to delete session. Please try again.', 'error')
    }
  }

  const handleContinueToPictionary = async () => {
    if (!activeSession) return
    
    router.push(`/session/${activeSession.code}?startPictionary=true`)
  }

  const handleCreateSession = async () => {
    setCreating(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      let code = generateSessionCode()
      let attempts = 0
      let exists = true

      // Ensure unique code
      while (exists && attempts < 10) {
        const { data } = await supabase
          .from('sessions')
          .select('code')
          .eq('code', code)
          .single()

        if (!data) {
          exists = false
        } else {
          code = generateSessionCode()
          attempts++
        }
      }

      if (exists) {
        showModal('Error', 'Failed to generate unique session code. Please try again.', 'error')
        setCreating(false)
        return
      }

      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + 2)

      const { error } = await supabase.from('sessions').insert({
        code,
        host_id: user.id,
        expires_at: expiresAt.toISOString(),
        status: 'lobby',
      })

      if (error) throw error

      router.push(`/session/${code}`)
    } catch (err: any) {
      console.error('Error creating session:', err)
      showModal('Error', 'Failed to create session. Please try again.', 'error')
      setCreating(false)
    }
  }

  const handleJoinSession = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const code = sessionCode.toUpperCase().trim()
      
      if (code.length !== 4) {
        showModal('Invalid Code', 'Session code must be 4 letters.', 'warning')
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('sessions')
        .select('code, expires_at, status')
        .eq('code', code)
        .single()

      if (error || !data) {
        showModal('Session Not Found', 'Session not found. Please check the code and try again.', 'error')
        setLoading(false)
        return
      }

      const now = new Date()
      const expiresAt = new Date(data.expires_at)

      if (expiresAt < now || data.status === 'ended') {
        showModal('Session Expired', 'This session has expired or ended.', 'warning')
        setLoading(false)
        return
      }

      router.push(`/session/${code}`)
    } catch (err: any) {
      console.error('Error joining session:', err)
      showModal('Error', 'Failed to join session. Please try again.', 'error')
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      <Modal
        isOpen={modal.isOpen}
        onClose={closeModal}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Session"
        message={`Are you sure you want to delete session ${activeSession?.code}? This action cannot be undone.`}
        type="warning"
        showConfirm={false}
      >
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => setShowDeleteConfirm(false)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={confirmDeleteSession}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Delete
          </button>
        </div>
      </Modal>
      <div className="min-h-screen bg-gradient-to-br from-pink-100 to-blue-100 px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-pink-600 mb-2">
                Welcome{name ? `, ${name}` : ''}!
              </h1>
              <p className="text-gray-600 text-sm sm:text-base">Gender Reveal Party Game</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full sm:w-auto px-4 py-2 text-sm sm:text-base text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Logout
            </button>
          </div>

          <div className="space-y-6">
            {activeSession && (
              <div className="bg-blue-50 border-2 border-blue-400 rounded-lg p-6">
                <div className="text-center mb-4">
                  <h2 className="text-xl font-semibold mb-2 text-blue-800">Trivia Complete!</h2>
                  <p className="text-gray-700 mb-2">
                    Session: <span className="font-mono font-bold">{activeSession.code}</span>
                  </p>
                  <p className="text-gray-600 mb-4">
                    Ready to continue to Pictionary? Click the button below to start the second game.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={handleContinueToPictionary}
                    className="w-full sm:w-auto bg-blue-600 text-white px-6 sm:px-8 py-3 rounded-lg font-semibold text-base sm:text-lg hover:bg-blue-700 transition-colors min-h-[44px]"
                  >
                    Continue to Pictionary
                  </button>
                  <button
                    onClick={handleDeleteSession}
                    className="w-full sm:w-auto bg-red-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-600 transition-colors min-h-[44px]"
                    title="Delete this session permanently"
                  >
                    Delete Session
                  </button>
                </div>
              </div>
            )}

            <div className="border-2 border-dashed border-pink-300 rounded-lg p-6 text-center">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Create a Session</h2>
              <p className="text-gray-600 mb-4">
                Start a new game session as the host. You&apos;ll be able to control the game flow.
              </p>
              <button
                onClick={handleCreateSession}
                disabled={creating}
                className="bg-pink-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {creating ? 'Creating...' : 'Create Session'}
              </button>
            </div>

            <div className="border-t pt-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Join a Session</h2>
              <form onSubmit={handleJoinSession} className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={sessionCode}
                  onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                  placeholder="Enter 4-letter code (e.g., ABCD)"
                  maxLength={4}
                  required
                  className="flex-1 px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent uppercase min-h-[44px]"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full sm:w-auto bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
                >
                  {loading ? 'Joining...' : 'Join'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}

