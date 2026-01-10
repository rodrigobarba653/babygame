'use client'

import type { RoomState } from '@/lib/realtime/types'
import Leaderboard from './Leaderboard'

interface ResultsProps {
  roomState: RoomState
  isHost?: boolean
  onContinue?: () => void
  onRevealGender?: () => void
  continueButtonText?: string
  title?: string
  subtitle?: string
}

export default function Results({ 
  roomState, 
  isHost = false,
  onContinue,
  onRevealGender,
  continueButtonText = 'Continue to Next Game',
  title = 'Game Results',
  subtitle = 'Final scores and standings'
}: ResultsProps) {
  // Determine winner
  const sortedPlayers = [...roomState.players].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    return a.joinedAt - b.joinedAt
  })
  const winner = sortedPlayers[0]

  return (
    <div className="max-w-4xl mx-auto px-4">
      <div className="bg-white rounded-lg shadow-xl p-4 sm:p-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-2 text-pink-600">{title}</h2>
        <p className="text-center text-gray-600 mb-6 sm:mb-8 text-sm sm:text-base">{subtitle}</p>
        <Leaderboard players={roomState.players} />

        {winner && onRevealGender && (
          <div className="mt-6 text-center">
            <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4 inline-block">
              <p className="text-lg font-semibold text-yellow-800">
                🏆 Winner: {winner.name}
              </p>
              <p className="text-sm text-yellow-600 mt-1">
                {winner.points} points
              </p>
            </div>
          </div>
        )}

        {isHost && (onContinue || onRevealGender) && (
          <div className="mt-8 text-center">
            {onRevealGender ? (
              <button
                onClick={onRevealGender}
                className="w-full sm:w-auto bg-pink-600 text-white px-6 sm:px-8 py-3 rounded-lg font-semibold text-base sm:text-lg hover:bg-pink-700 transition-colors min-h-[44px]"
              >
                {continueButtonText}
              </button>
            ) : (
              <button
                onClick={onContinue}
                className="w-full sm:w-auto bg-blue-600 text-white px-6 sm:px-8 py-3 rounded-lg font-semibold text-base sm:text-lg hover:bg-blue-700 transition-colors min-h-[44px]"
              >
                {continueButtonText}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

