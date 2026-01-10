'use client'

import type { RoomState } from '@/lib/realtime/types'
import { getInitials } from '@/lib/utils'

interface LobbyProps {
  roomState: RoomState
  isHost: boolean
  onStartGame: () => void
}

export default function Lobby({ roomState, isHost, onStartGame }: LobbyProps) {
  const canStart = roomState.players.length >= 2 && roomState.players.length <= 10

  return (
    <div className="max-w-4xl mx-auto px-4">
      <div className="bg-white rounded-lg shadow-xl p-4 sm:p-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-2 text-pink-600">Game Lobby</h2>
        <p className="text-center text-gray-600 mb-4 sm:mb-6 text-sm sm:text-base">Session Code: <span className="font-mono font-bold text-base sm:text-lg">{roomState.code}</span></p>

        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">
            Players ({roomState.players.length}/10)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {roomState.players.map((player) => (
              <div
                key={player.userId}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="w-10 h-10 rounded-full bg-pink-400 flex items-center justify-center text-white font-semibold">
                  {getInitials(player.name)}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-800">{player.name}</div>
                  <div className="text-sm text-gray-500">{player.relationship}</div>
                </div>
                {roomState.hostId === player.userId && (
                  <span className="px-2 py-1 text-xs font-semibold bg-yellow-400 text-yellow-900 rounded">
                    Host
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {!canStart && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-yellow-800 text-center">
              {roomState.players.length < 2
                ? 'Waiting for more players (minimum 2 required)...'
                : 'Maximum 10 players allowed'}
            </p>
          </div>
        )}

        {isHost && (
          <div className="text-center">
            <button
              onClick={onStartGame}
              disabled={!canStart}
              className="w-full sm:w-auto bg-pink-600 text-white px-6 sm:px-8 py-3 rounded-lg font-semibold text-base sm:text-lg hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
            >
              Start Game
            </button>
          </div>
        )}

        {!isHost && (
          <div className="text-center text-gray-600">
            Waiting for host to start the game...
          </div>
        )}
      </div>
    </div>
  )
}

