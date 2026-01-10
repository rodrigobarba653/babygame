'use client'

import { useState, useEffect } from 'react'
import type { RoomState } from '@/lib/realtime/types'
import Leaderboard from './Leaderboard'

interface RevealProps {
  roomState: RoomState
  userId: string
  sessionCode: string
}

export default function Reveal({ roomState, userId, sessionCode }: RevealProps) {
  const [revealText, setRevealText] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sortedPlayers = [...roomState.players].sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points
    }
    return a.joinedAt - b.joinedAt
  })

  const winner = sortedPlayers[0]
  const isWinner = winner && winner.userId === userId

  useEffect(() => {
    if (isWinner && !revealText && !loading && !error) {
      setLoading(true)
      fetch('/api/reveal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: sessionCode }),
      })
        .then((res) => {
          if (res.status === 403) {
            setError('You are not the winner')
            return null
          }
          if (!res.ok) {
            throw new Error('Failed to fetch reveal')
          }
          return res.json()
        })
        .then((data) => {
          if (data) {
            setRevealText(data.revealText)
          }
        })
        .catch((err) => {
          console.error('Error fetching reveal:', err)
          setError('Failed to load reveal')
        })
        .finally(() => {
          setLoading(false)
        })
    }
  }, [isWinner, revealText, loading, error, sessionCode])

  if (isWinner) {
    return (
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-xl p-4 sm:p-8">
          {loading && (
            <div className="text-center py-12">
              <div className="text-2xl text-gray-600">Loading reveal...</div>
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <div className="text-xl text-red-600">{error}</div>
            </div>
          )}

          {revealText && (
            <div className="text-center py-6 sm:py-12">
              <div className="text-4xl sm:text-6xl font-bold text-blue-600 mb-6 sm:mb-8 animate-bounce">
                {revealText}
              </div>
              <div className="text-xl sm:text-2xl text-gray-700 mb-6 sm:mb-8">
                Congratulations, {winner.name}! 🎉
              </div>
              <Leaderboard players={roomState.players} />
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4">
      <div className="bg-white rounded-lg shadow-xl p-4 sm:p-8">
        <div className="text-center py-6 sm:py-12">
          <div className="text-2xl sm:text-3xl font-bold text-gray-700 mb-4">
            You didn't win
          </div>
          <div className="text-lg sm:text-xl text-gray-600 mb-6 sm:mb-8">
            Only the winner can see the gender reveal.
          </div>
          <Leaderboard players={roomState.players} />
        </div>
      </div>
    </div>
  )
}

