export type Relationship = 'Mother' | 'Father' | 'Grandparent' | 'Aunt/Uncle' | 'Friend'

export interface Player {
  userId: string
  name: string
  relationship: Relationship
  points: number
  joinedAt: number
}

export interface Timer {
  startedAt: number
  durationMs: number
}

export interface TriviaState {
  questionIndex: number
  publicQuestion: {
    text: string
    options: string[]
  }
  answers: Record<string, number>
  answerCounts?: number
  correctIndex?: number // Only set during reveal phase
}

export interface PictionaryState {
  turnOrder: string[]
  turnIndex: number
  drawerUserId: string
  promptMasked: string
  promptFull: string
  guesses: Array<{ userId: string; text: string }>
  closestWinnerId?: string // 2 points
  funniestWinnerId?: string // 1 point
}

export type GamePhase =
  | 'lobby'
  | 'trivia_question'
  | 'trivia_reveal'
  | 'trivia_complete'
  | 'pictionary_draw'
  | 'pictionary_guess'
  | 'pictionary_reveal'
  | 'pictionary_congrats'
  | 'results'
  | 'reveal'

export interface RoomState {
  code: string
  hostId: string
  phase: GamePhase
  players: Player[]
  timer: Timer | null
  trivia?: TriviaState
  pictionary?: PictionaryState
}

// Broadcast message types
export type BroadcastMessage =
  | { type: 'ROOM_STATE'; payload: RoomState }
  | { type: 'TRIVIA_ANSWER'; payload: { userId: string; questionIndex: number; optionIndex: number } }
  | { type: 'GUESS_SUBMIT'; payload: { userId: string; text: string } }
  | { type: 'PICK_WINNER'; payload: { drawerUserId: string; winnerUserId: string; awardType: 'closest' | 'funniest' } }
  | { type: 'STROKE_BATCH'; payload: { drawerUserId: string; points: Array<{ x: number; y: number }>; color: string; width: number; isStart?: boolean; isEnd?: boolean } }
  | { type: 'CLEAR_CANVAS' }

