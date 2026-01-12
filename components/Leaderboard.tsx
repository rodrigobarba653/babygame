'use client'

import type { Player } from '@/lib/realtime/types'

interface LeaderboardProps {
  players: Player[]
}

export default function Leaderboard({ players }: LeaderboardProps) {
  const sortedPlayers = [...players].sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points
    }
    return a.joinedAt - b.joinedAt
  })

  return (
    <div className="bg-white rounded-lg shadow-lg p-4">
      <h3 className="text-lg font-semibold mb-3 text-gray-900">Leaderboard</h3>
      <div className="space-y-2">
        {sortedPlayers.map((player, index) => (
          <div
            key={player.userId}
            className={`flex items-center justify-between p-2 rounded ${
              index === 0 ? 'bg-yellow-100 border-2 border-yellow-400' : 'bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  index === 0
                    ? 'bg-yellow-400 text-yellow-900'
                    : 'bg-blue-400 text-blue-900'
                }`}
              >
                {index + 1}
              </div>
              <div>
                <div className="font-medium text-gray-900">{player.name}</div>
                <div className="text-xs text-gray-600">{player.relationship}</div>
              </div>
            </div>
            <div className="font-bold text-lg text-gray-900">{player.points} pts</div>
          </div>
        ))}
      </div>
    </div>
  )
}

