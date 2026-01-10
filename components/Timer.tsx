'use client'

import { useEffect, useState } from 'react'
import type { Timer as TimerType } from '@/lib/realtime/types'
import { formatTimeRemaining } from '@/lib/utils'

interface TimerProps {
  timer: TimerType | null
}

export default function Timer({ timer }: TimerProps) {
  const [remaining, setRemaining] = useState<number>(0)

  useEffect(() => {
    if (!timer) {
      setRemaining(0)
      return
    }

    const updateRemaining = () => {
      const elapsed = Date.now() - timer.startedAt
      const remainingMs = Math.max(0, timer.durationMs - elapsed)
      setRemaining(remainingMs)
    }

    updateRemaining()
    const interval = setInterval(updateRemaining, 100)

    return () => clearInterval(interval)
  }, [timer])

  if (!timer || remaining === 0) {
    return null
  }

  const seconds = Math.ceil(remaining / 1000)
  const isLow = seconds <= 5

  return (
    <div className={`text-center ${isLow ? 'text-red-600 animate-pulse' : 'text-gray-700'}`}>
      <div className={`text-4xl font-bold ${isLow ? 'text-red-600' : 'text-blue-600'}`}>
        {formatTimeRemaining(remaining)}
      </div>
    </div>
  )
}

