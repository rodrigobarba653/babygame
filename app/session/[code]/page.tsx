'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabaseClient'
import type {
  RoomState,
  Player,
  PictionaryState,
} from '@/lib/realtime/types'
import { TRIVIA_QUESTIONS, NUM_TRIVIA_QUESTIONS } from '@/data/trivia'
import { PICTIONARY_PROMPTS } from '@/data/prompts'
import Lobby from '@/components/Lobby'
import Trivia from '@/components/Trivia'
import Pictionary from '@/components/Pictionary'
import Results from '@/components/Results'
import Reveal from '@/components/Reveal'
import Leaderboard from '@/components/Leaderboard'
import Timer from '@/components/Timer'
import Modal from '@/components/Modal'

export default function SessionPage() {
  const params = useParams()
  const router = useRouter()
  const code = params.code as string
  const supabase = createClient()

  const [roomState, setRoomState] = useState<RoomState | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [isHost, setIsHost] = useState(false)
  const [hostDisconnected, setHostDisconnected] = useState(false)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const [hasReceivedState, setHasReceivedState] = useState(false)
  const [sessionStatus, setSessionStatus] = useState<string | null>(null)
  const [modal, setModal] = useState<{ isOpen: boolean; title: string; message: string; type?: 'info' | 'success' | 'error' | 'warning' }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  })

  const showModal = (title: string, message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    setModal({ isOpen: true, title, message, type })
  }

  const closeModal = () => {
    setModal({ isOpen: false, title: '', message: '', type: 'info' })
  }

  // Store functions in refs to avoid circular dependencies
  const startPictionaryRef = useRef<(() => void) | null>(null)
  const startPictionaryTurnRef = useRef<((turnIndex: number, turnOrder: string[]) => void) | null>(null)
  const startPictionaryGuessRef = useRef<(() => void) | null>(null)
  const startPictionaryRevealRef = useRef<(() => void) | null>(null)

  // Check if we should start pictionary (from dashboard button - legacy support)
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const shouldStart = searchParams.get('startPictionary') === 'true'
    if (shouldStart && isHost && roomState?.phase === 'results' && startPictionaryRef.current) {
      // Small delay to ensure state is ready
      setTimeout(() => {
        startPictionaryRef.current?.()
        // Remove query param
        window.history.replaceState({}, '', window.location.pathname)
      }, 500)
    }
  }, [isHost, roomState?.phase])


  const channelRef = useRef<any>(null)
  const hostStateRef = useRef<RoomState | null>(null)
  const triviaAnswersRef = useRef<Record<string, Record<number, number>>>({})
  const pictionaryGuessesRef = useRef<Array<{ userId: string; text: string }>>([])
  const pictionaryPromptsRef = useRef<string[]>([])
  const pictionaryTurnIndexRef = useRef(0)
  const currentDrawerRef = useRef<string | null>(null)
  const advancePictionaryTurnRef = useRef<(() => void) | null>(null)
  const revealAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const guessTimerRef = useRef<NodeJS.Timeout | null>(null)
  const handleTriviaRevealRef = useRef<((questionIndex: number) => void) | null>(null)
  const startTriviaQuestionRef = useRef<((questionIndex: number) => void) | null>(null)
  const completeTriviaRef = useRef<(() => void) | null>(null)
  const [receivedStrokes, setReceivedStrokes] = useState<Array<{ points: Array<{ x: number; y: number }>; color: string; width: number }>>([])

  // Broadcast room state function - defined before useEffect that uses it
  const broadcastRoomState = useCallback((state: RoomState) => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'ROOM_STATE',
        payload: state,
      })
    }
    setRoomState(state)
  }, [])

  // Initialize session
  useEffect(() => {
    const initSession = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      setUserId(user.id)

          // Check session exists and is valid
          const { data: session, error } = await supabase
            .from('sessions')
            .select('code, host_id, expires_at, status, winner_id')
            .eq('code', code.toUpperCase())
            .single()

          if (error || !session) {
            showModal('Session Not Found', 'Session not found. Redirecting to dashboard...', 'error')
            setTimeout(() => router.push('/dashboard'), 2000)
            return
          }

          // Type assertion for selected fields
          const sessionData = session as { code: string; host_id: string; expires_at: string | null; status: string; winner_id: string | null }

          const now = new Date()
          const expiresAt = new Date(sessionData.expires_at || 0)

          // Store session status to track game completion
          setSessionStatus(sessionData.status)

          // Only block access if session is expired (allow access even if ended - we want to show results/reveal)
          if (expiresAt < now && sessionData.status !== 'ended') {
            showModal('Session Expired', 'This session has expired. Redirecting to dashboard...', 'warning')
            setTimeout(() => router.push('/dashboard'), 2000)
            return
          }

          setIsHost(sessionData.host_id === user.id)

          // Store session data in a variable accessible in closures
          const sessionHostId = sessionData.host_id
          const sessionStatus = sessionData.status

      // Get profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, relationship')
        .eq('id', user.id)
        .single()

      if (!profile) {
        router.push('/profile')
        return
      }

      // Type assertion for selected fields
      const profileData = profile as { name: string; relationship: string }

      // Join Realtime channel
      const channel = supabase.channel(`room:${code.toUpperCase()}`, {
        config: {
          presence: {
            key: user.id,
          },
        },
      })

      // Track presence
      channel
        .on('presence', { event: 'sync' }, () => {
          const presenceState = channel.presenceState()
          const players: Player[] = Object.entries(presenceState).map(([id, presences]: [string, any]) => {
            const presence = Array.isArray(presences) ? presences[0] : presences
            return {
              userId: id,
              name: presence.name || 'Unknown',
              relationship: presence.relationship || 'Friend',
              points: presence.points || 0,
              joinedAt: presence.joinedAt || Date.now(),
            }
          })

          if (isHost && hostStateRef.current) {
            // Update players in host state - preserve points from existing state when players re-enter
            const updatedState = {
              ...hostStateRef.current,
              players: players.map((p) => {
                const existing = hostStateRef.current?.players.find((ep) => ep.userId === p.userId)
                if (existing) {
                  // Player re-entered: preserve their points and join time, update name/relationship if changed
                  return {
                    ...existing,
                    name: p.name, // Update name in case it changed
                    relationship: p.relationship, // Update relationship in case it changed
                  }
                }
                // New player joining
                return p
              }),
            }
            hostStateRef.current = updatedState
            broadcastRoomState(updatedState)
            
            // If host was reconnecting, now we have synced state from presence
            if (isReconnecting) {
              setIsReconnecting(false)
              setHasReceivedState(true)
            }
          } else if (!isHost) {
            // Non-host: update local state from presence
              setRoomState((prev) => {
              if (!prev) {
                return {
                  code: code.toUpperCase(),
                  hostId: sessionHostId,
                  phase: 'lobby',
                  players,
                  timer: null,
                }
              }
              // For non-host, merge with existing state to preserve points
              const mergedState = {
                ...prev,
                players: players.map((p) => {
                  const existing = prev.players.find((ep) => ep.userId === p.userId)
                  if (existing) {
                    // Player re-entered: preserve their points from room state
                    return {
                      ...existing,
                      name: p.name, // Update name/relationship from presence
                      relationship: p.relationship,
                    }
                  }
                  return p
                }),
              }
              
              // Check if host is present
              const hostPresent = players.some((p) => p.userId === sessionHostId)
              if (hostPresent && isReconnecting) {
                // Host is present, but wait for state broadcast before allowing entry
                return mergedState
              }
              
              return mergedState
            })
          }

          // Check if host is still present - only set disconnected if we're sure host is gone
          // (not during initial sync or if host just reconnected)
          const hostPresent = players.some((p) => p.userId === sessionHostId)
          // Only mark as disconnected if host was present before but now isn't
          // This prevents false positives during initial sync or reconnection
          if (!hostPresent && !isHost && hostStateRef.current) {
            // Double check - only disconnect if host was definitely there before
            const hostWasThere = hostStateRef.current.players.some((p) => p.userId === sessionHostId)
            if (hostWasThere) {
              // Add a small delay to avoid race conditions during presence sync
              setTimeout(() => {
                const stillNoHost = !channel.presenceState()[sessionHostId]
                if (stillNoHost) {
                  setHostDisconnected(true)
                }
              }, 2000) // 2 second grace period
            }
          }
        })
        .on('presence', { event: 'join' }, () => {
          // Handle player join - presence sync already handles this
        })
        .on('presence', { event: 'leave' }, ({ key }) => {
          // Handle player leave - if host leaves, other players should see host disconnected
          if (isHost && hostStateRef.current) {
            // Host: remove player from state if they truly left (not just reconnecting)
            const updatedState = {
              ...hostStateRef.current,
              players: hostStateRef.current.players.filter((p) => p.userId !== key),
            }
            hostStateRef.current = updatedState
            broadcastRoomState(updatedState)
          } else if (!isHost) {
            // Non-host: update local state to remove left players
            setRoomState((prev) => {
              if (!prev) return prev
              return {
                ...prev,
                players: prev.players.filter((p) => p.userId !== key),
              }
            })
          }
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            // Track self - use existing points if player is re-entering
            const existingPlayer = hostStateRef.current?.players.find((p) => p.userId === user.id)
            await channel.track({
              userId: user.id,
              name: profileData.name,
              relationship: profileData.relationship,
              points: existingPlayer?.points ?? 0, // Preserve points if re-entering
              joinedAt: existingPlayer?.joinedAt ?? Date.now(), // Preserve original join time
            })

            // Store channel reference
            channelRef.current = channel

            // Initialize room state (check sessionHostId directly instead of isHost state)
            const userIsHost = sessionHostId === user.id
            
            // Check if this is a re-entry (sessionStatus has progressed beyond lobby)
            // Note: 'trivia_complete' status means trivia finished but can still continue to pictionary
            const isReEntry = sessionStatus !== 'lobby' && sessionStatus !== 'trivia_complete' && sessionStatus !== 'ended'
            
            if (isReEntry) {
              // Show waiting room for re-entry
              setIsReconnecting(true)
            }
            
            // If session is in trivia_complete, restore to results phase (trivia finished, can continue to pictionary)
            const initialPhase = sessionStatus === 'trivia_complete' ? 'results' : 'lobby'
            
            if (userIsHost) {
              // Host: if re-entering during active game, wait for state sync
              if (isReEntry) {
                // Don&apos;t initialize state yet, wait for broadcast or presence sync
                setHasReceivedState(false)
              } else {
                // Normal entry or trivia_complete - initialize state
                const initialState: RoomState = {
                  code: code.toUpperCase(),
                  hostId: user.id,
                  phase: initialPhase,
                  players: [
                    {
                      userId: user.id,
                      name: profileData.name,
                      relationship: profileData.relationship as any,
                      points: 0, // Points will be restored from presence if available
                      joinedAt: Date.now(),
                    },
                  ],
                  timer: null,
                }
                hostStateRef.current = initialState
                setRoomState(initialState)
                if (initialPhase === 'lobby') {
                  broadcastRoomState(initialState)
                }
              }
            } else {
              // Non-host: always wait for host's state broadcast on re-entry
              if (isReEntry) {
                setHasReceivedState(false)
              }
            }
          }
        })

      // Listen for broadcasts
      channel.on('broadcast', { event: 'ROOM_STATE' }, ({ payload }) => {
        const receivedState = payload as RoomState
        // Use sessionHostId and user.id from closure
        const currentUserIsHost = sessionHostId === user.id
        
        // If we were reconnecting, now we have state - allow entry
        if (isReconnecting) {
          setIsReconnecting(false)
          setHasReceivedState(true)
          
          // Update hostStateRef if host is reconnecting
          if (currentUserIsHost) {
            hostStateRef.current = receivedState
          }
        }
        
        // Host also needs to update its UI from broadcasted state to stay consistent
        setRoomState(receivedState)
        // Update hostStateRef for host if it's the host's own broadcast
        if (currentUserIsHost) {
          hostStateRef.current = receivedState
        }
        
        // If we're in results phase and both trivia and pictionary are undefined,
        // the game is complete - update session status
        if (receivedState.phase === 'results' && !receivedState.trivia && !receivedState.pictionary) {
          // Check if session status is already 'ended' - if so, keep it
          // Otherwise fetch current status from database
          void (async () => {
            try {
              const { data: sessionData } = await supabase
                .from('sessions')
                .select('status')
                .eq('code', code.toUpperCase())
                .single()
              
              // Type assertion for selected field
              const sessionStatusData = sessionData as { status: string } | null
              if (sessionStatusData?.status === 'ended') {
                setSessionStatus('ended')
              }
            } catch {
              // Ignore errors
            }
          })()
        }
        // Update current drawer ref for pictionary
        if (receivedState.pictionary?.drawerUserId) {
          currentDrawerRef.current = receivedState.pictionary.drawerUserId
        }
        // Clear strokes if drawer changes or new turn
        if (
          receivedState.phase === 'pictionary_draw' &&
          receivedState.pictionary?.drawerUserId !== currentDrawerRef.current
        ) {
          setReceivedStrokes([])
        }
      })

      channel.on('broadcast', { event: 'TRIVIA_ANSWER' }, ({ payload }) => {
        if (isHost) {
          const { userId: answerUserId, questionIndex, optionIndex } = payload as any
          
          // Store answer
          if (!triviaAnswersRef.current[answerUserId]) {
            triviaAnswersRef.current[answerUserId] = {}
          }
          triviaAnswersRef.current[answerUserId][questionIndex] = optionIndex

          // Update state (skip if this is the host's own answer - already processed)
          if (hostStateRef.current && hostStateRef.current.trivia && answerUserId !== user.id) {
            const updatedState = {
              ...hostStateRef.current,
              trivia: {
                ...hostStateRef.current.trivia,
                answers: {
                  ...hostStateRef.current.trivia.answers,
                  [answerUserId]: optionIndex,
                },
              },
            }
            hostStateRef.current = updatedState
            setRoomState(updatedState)
            broadcastRoomState(updatedState)
          }
        }
      })

      channel.on('broadcast', { event: 'GUESS_SUBMIT' }, ({ payload }) => {
        if (isHost) {
          const { userId: guessUserId, text } = payload as any
          const guess = { userId: guessUserId, text }
          if (!pictionaryGuessesRef.current.find((g) => g.userId === guessUserId)) {
            pictionaryGuessesRef.current.push(guess)

            // Update state
            if (hostStateRef.current && hostStateRef.current.pictionary) {
              const drawerUserId = hostStateRef.current.pictionary.drawerUserId
              
              // Count non-drawer players (all players except the drawer)
              const nonDrawerPlayers = hostStateRef.current.players.filter(
                (p) => p.userId !== drawerUserId
              )
              
              // Count real guesses (excluding dummy guesses added later)
              const realGuesses = pictionaryGuessesRef.current.filter(
                (g) => !g.userId.startsWith('dummy-')
              )

              const updatedState = {
                ...hostStateRef.current,
                pictionary: {
                  ...hostStateRef.current.pictionary,
                  guesses: [...pictionaryGuessesRef.current],
                },
              }
              hostStateRef.current = updatedState
              setRoomState(updatedState)
              broadcastRoomState(updatedState)

              // If all non-drawer players have guessed, move to reveal phase immediately
              if (
                hostStateRef.current.phase === 'pictionary_guess' &&
                realGuesses.length >= nonDrawerPlayers.length &&
                startPictionaryRevealRef.current
              ) {
                // Clear the timeout if it exists
                if (guessTimerRef.current) {
                  clearTimeout(guessTimerRef.current)
                  guessTimerRef.current = null
                }
                // Move to reveal phase immediately
                if (startPictionaryRevealRef.current) {
                  startPictionaryRevealRef.current()
                }
              }
            }
          }
        }
      })

      channel.on('broadcast', { event: 'PICK_WINNER' }, ({ payload }) => {
        console.log('PICK_WINNER broadcast received', { isHost, payload, currentUserId: user.id })
        
        // Process on host side only (host is authoritative)
        // Check if current user is host using sessionHostId (more reliable than isHost state)
        const currentUserIsHost = sessionHostId === user.id
        
        if (!currentUserIsHost) {
          console.log('Non-host received PICK_WINNER broadcast, ignoring (waiting for ROOM_STATE sync)')
          return
        }
        
        // Current user is host, proceed with processing
        const { drawerUserId, winnerUserId, awardType } = payload as any
        console.log('Host processing PICK_WINNER', { 
          drawerUserId, 
          winnerUserId, 
          awardType,
          currentDrawer: hostStateRef.current?.pictionary?.drawerUserId,
          phase: hostStateRef.current?.phase,
          hasHostStateRef: !!hostStateRef.current
        })
        
        // Verify we have the right state
        if (!hostStateRef.current) {
          console.error('Host processing PICK_WINNER but hostStateRef is null')
          return
        }
        
        // Verify the drawer ID matches and we're in the right phase
        const drawerMatches = hostStateRef.current.pictionary?.drawerUserId === drawerUserId;
        const phaseMatches = hostStateRef.current.phase === 'pictionary_reveal';
        
        console.log('Host: Checking conditions', {
          drawerMatches,
          phaseMatches,
          stateDrawerId: hostStateRef.current.pictionary?.drawerUserId,
          payloadDrawerId: drawerUserId,
          currentPhase: hostStateRef.current.phase
        });
        
        if (drawerMatches && phaseMatches) {
          console.log('Host: Conditions met, updating state...')
          
          // Don&apos;t award points to dummy guesses
          if (winnerUserId.startsWith('dummy-')) {
            // Still update the UI state but don&apos;t award points
            const updatedPictionary: PictionaryState = {
              ...hostStateRef.current.pictionary!,
              ...(awardType === 'closest' 
                ? { closestWinnerId: winnerUserId }
                : { funniestWinnerId: winnerUserId }
              ),
            }
            const newState: RoomState = {
              ...hostStateRef.current,
              pictionary: updatedPictionary,
            }
            hostStateRef.current = newState
            setRoomState(newState)
            console.log('Host: Broadcasting updated state (dummy guess)', newState)
            broadcastRoomState(newState)
            
            // Check if both winners selected and last round - auto advance
            if (newState.pictionary) {
              const bothWinnersSelected = newState.pictionary.closestWinnerId && newState.pictionary.funniestWinnerId;
              const currentTurnIndex = newState.pictionary.turnIndex;
              const turnOrder = newState.pictionary.turnOrder;
              const maxTurns = Math.min(5, turnOrder.length);
              const isLastRound = currentTurnIndex + 1 >= maxTurns;
              
              if (bothWinnersSelected && isLastRound && advancePictionaryTurnRef.current) {
                // Auto-advance to results after 10 seconds if button not clicked
                // Clear any existing timer
                if (revealAdvanceTimerRef.current) {
                  clearTimeout(revealAdvanceTimerRef.current);
                }
                revealAdvanceTimerRef.current = setTimeout(() => {
                  advancePictionaryTurnRef.current?.();
                  revealAdvanceTimerRef.current = null;
                }, 10000);
              }
            }
            
            return
          }

          // Award points based on award type (only for real players)
          const pointsToAward = awardType === 'closest' ? 2 : 1
          const updatedPlayers = hostStateRef.current.players.map((p) =>
            p.userId === winnerUserId ? { ...p, points: p.points + pointsToAward } : p
          )

          const updatedPictionary: PictionaryState = {
            ...hostStateRef.current.pictionary!,
            ...(awardType === 'closest' 
              ? { closestWinnerId: winnerUserId }
              : { funniestWinnerId: winnerUserId }
            ),
          }

          const newState: RoomState = {
            ...hostStateRef.current,
            players: updatedPlayers,
            pictionary: updatedPictionary,
          }
          hostStateRef.current = newState
          setRoomState(newState)
          console.log('Host: Broadcasting updated state (real player)', newState)
          broadcastRoomState(newState)
          
          // Check if both winners selected and last round - auto advance
          if (newState.pictionary) {
            const bothWinnersSelected = newState.pictionary.closestWinnerId && newState.pictionary.funniestWinnerId;
            const currentTurnIndex = newState.pictionary.turnIndex;
            const turnOrder = newState.pictionary.turnOrder;
            const maxTurns = Math.min(5, turnOrder.length);
            const isLastRound = currentTurnIndex + 1 >= maxTurns;
            
            if (bothWinnersSelected && isLastRound && advancePictionaryTurnRef.current) {
              setTimeout(() => {
                advancePictionaryTurnRef.current?.();
              }, 3000);
            }
          }
        } else {
          console.log('Host: Conditions NOT met', {
            drawerMatches: hostStateRef.current.pictionary?.drawerUserId === drawerUserId,
            phaseMatches: hostStateRef.current.phase === 'pictionary_reveal',
            currentPhase: hostStateRef.current.phase,
            currentDrawer: hostStateRef.current.pictionary?.drawerUserId
          })
        }
      })

      channel.on('broadcast', { event: 'STROKE_BATCH' }, ({ payload }) => {
        const { drawerUserId, points, color, width } = payload as any
        // Only process strokes if they're from the current drawer
        if (currentDrawerRef.current === drawerUserId) {
          setReceivedStrokes((prev) => [...prev, { points, color, width }])
        }
      })

      channel.on('broadcast', { event: 'CLEAR_CANVAS' }, () => {
        setReceivedStrokes([])
      })

      // Channel reference is set in subscribe callback
    }

    initSession()

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe()
      }
    }
  }, [code, router, supabase, isHost, broadcastRoomState, isReconnecting])

  const startGame = useCallback(() => {
    if (!isHost || !hostStateRef.current) return

    // Shuffle prompts
    const prompts = [...PICTIONARY_PROMPTS].sort(() => Math.random() - 0.5)
    pictionaryPromptsRef.current = prompts
    pictionaryTurnIndexRef.current = 0

    // Start first trivia question
    const question = TRIVIA_QUESTIONS[0]
    const newState: RoomState = {
      ...hostStateRef.current,
      phase: 'trivia_question',
      trivia: {
        questionIndex: 0,
        publicQuestion: {
          text: question.text,
          options: question.options,
        },
        answers: {},
        correctIndex: undefined, // Clear for new question
      },
      timer: {
        startedAt: Date.now(),
        durationMs: 15000,
      },
    }
    hostStateRef.current = newState
    triviaAnswersRef.current = {} // Clear all answers at game start
    setRoomState(newState)
    broadcastRoomState(newState)

    // Move to reveal after 15s
    setTimeout(() => {
      if (handleTriviaRevealRef.current) {
        handleTriviaRevealRef.current(0)
      }
    }, 15000)
  }, [isHost, broadcastRoomState])

  const handleTriviaReveal = useCallback((questionIndex: number) => {
    if (!isHost || !hostStateRef.current) return

    const question = TRIVIA_QUESTIONS[questionIndex]
    const correctIdx = question.correctIndex

    // Update scores - treat host as a player (check all players including host)
    const updatedPlayers = hostStateRef.current.players.map((player) => {
      // Get answer from ref (where all answers are stored)
      const answer = triviaAnswersRef.current[player.userId]?.[questionIndex]
      // Check if answer matches correct index (treat host same as others)
      if (answer !== undefined && answer === correctIdx) {
        return { ...player, points: player.points + 1 }
      }
      return player
    })

    const revealState: RoomState = {
      ...hostStateRef.current,
      phase: 'trivia_reveal',
      players: updatedPlayers,
      trivia: {
        ...hostStateRef.current.trivia!,
        correctIndex: correctIdx, // Broadcast correct answer so everyone (including host) can see it
        answers: Object.fromEntries(
          hostStateRef.current.players.map((p) => [
            p.userId,
            triviaAnswersRef.current[p.userId]?.[questionIndex] ?? -1,
          ])
        ),
      },
      timer: {
        startedAt: Date.now(),
        durationMs: 3000,
      },
    }
        hostStateRef.current = revealState
        setRoomState(revealState) // Update host's local state immediately
    broadcastRoomState(revealState)

    // Move to next question or complete trivia
    setTimeout(() => {
      if (questionIndex < NUM_TRIVIA_QUESTIONS - 1) {
        if (startTriviaQuestionRef.current) {
          startTriviaQuestionRef.current(questionIndex + 1)
        }
      } else {
        // Trivia complete - redirect to dashboard
        if (completeTriviaRef.current) {
          completeTriviaRef.current()
        }
      }
    }, 3000)
  }, [isHost, broadcastRoomState])

  // Store handleTriviaReveal in ref for use in other callbacks
  useEffect(() => {
    handleTriviaRevealRef.current = handleTriviaReveal
  }, [handleTriviaReveal])

  const startTriviaQuestion = useCallback((questionIndex: number) => {
    if (!isHost || !hostStateRef.current) return

    const question = TRIVIA_QUESTIONS[questionIndex]
    const newState: RoomState = {
      ...hostStateRef.current,
      phase: 'trivia_question',
      trivia: {
        questionIndex,
        publicQuestion: {
          text: question.text,
          options: question.options,
        },
        answers: {},
        correctIndex: undefined, // Clear correct index for new question
      },
      timer: {
        startedAt: Date.now(),
        durationMs: 15000,
      },
    }
          hostStateRef.current = newState
          triviaAnswersRef.current = {} // Clear all answers (including host's)
    setRoomState(newState) // Update host's local state
    broadcastRoomState(newState)

    setTimeout(() => {
      if (handleTriviaRevealRef.current) {
        handleTriviaRevealRef.current(questionIndex)
      }
    }, 15000)
  }, [isHost, broadcastRoomState])

  // Store startTriviaQuestion in ref for use in other callbacks
  useEffect(() => {
    startTriviaQuestionRef.current = startTriviaQuestion
  }, [startTriviaQuestion])

  const completeTrivia = useCallback(async () => {
    if (!isHost || !hostStateRef.current) return

    const completeState: RoomState = {
      ...hostStateRef.current,
      phase: 'results',
      timer: null,
      trivia: undefined,
    }
    hostStateRef.current = completeState
    setRoomState(completeState)
    broadcastRoomState(completeState)

    // Update session status
    // Type assertion for update operation - cast as any to bypass Supabase type inference issues
    await (supabase.from('sessions') as any)
      .update({ status: 'trivia_complete' })
      .eq('code', code.toUpperCase())
    
    // Update local session status
    setSessionStatus('trivia_complete')
  }, [isHost, code, supabase, broadcastRoomState])

  // Store completeTrivia in ref for use in other callbacks
  useEffect(() => {
    completeTriviaRef.current = completeTrivia
  }, [completeTrivia])

  const startPictionaryTurn = useCallback((turnIndex: number, turnOrder: string[]) => {
    if (!isHost || !hostStateRef.current) return

    // Clear guesses and canvas when new turn starts
    pictionaryGuessesRef.current = []
    setReceivedStrokes([])
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'CLEAR_CANVAS',
        payload: {},
      })
    }

    if (turnIndex >= Math.min(5, turnOrder.length)) {
      // End game, show results
      const resultsState: RoomState = {
        ...hostStateRef.current,
        phase: 'results',
        timer: null,
        pictionary: undefined,
        trivia: undefined,
      }
      hostStateRef.current = resultsState
      broadcastRoomState(resultsState)

      // Determine winner
      const sortedPlayers = [...resultsState.players].sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        return a.joinedAt - b.joinedAt
      })
      const winner = sortedPlayers[0]

      // Update session
      // Type assertion for update operation - cast as any to bypass Supabase type inference issues
      void (supabase.from('sessions') as any)
        .update({
          status: 'ended',
          winner_id: winner.userId,
          expires_at: new Date().toISOString(),
        })
        .eq('code', code.toUpperCase())

      setTimeout(() => {
        const revealState: RoomState = {
          ...resultsState,
          phase: 'reveal',
        }
        hostStateRef.current = revealState
        broadcastRoomState(revealState)
      }, 5000)

      return
    }

    const drawerUserId = turnOrder[turnIndex]
    currentDrawerRef.current = drawerUserId
    const prompt = pictionaryPromptsRef.current[turnIndex % pictionaryPromptsRef.current.length]
    pictionaryGuessesRef.current = []

    const drawState: RoomState = {
      ...hostStateRef.current,
      phase: 'pictionary_draw',
      pictionary: {
        turnOrder,
        turnIndex,
        drawerUserId,
        promptMasked: '_'.repeat(prompt.length),
        promptFull: prompt,
        guesses: [],
      },
      timer: {
        startedAt: Date.now(),
        durationMs: 20000,
      },
    }
    hostStateRef.current = drawState
    broadcastRoomState(drawState)

    setTimeout(() => {
      // Use ref to avoid dependency issue
      if (startPictionaryGuessRef.current) {
        startPictionaryGuessRef.current()
      }
    }, 20000)
  }, [isHost, code, supabase, broadcastRoomState])

  const startPictionary = useCallback(() => {
    if (!isHost || !hostStateRef.current) return

    const turnOrder = hostStateRef.current.players.map((p) => p.userId)
    pictionaryPromptsRef.current = [...PICTIONARY_PROMPTS].sort(() => Math.random() - 0.5)
    pictionaryTurnIndexRef.current = 0

    // Use ref to avoid dependency issue
    if (startPictionaryTurnRef.current) {
      startPictionaryTurnRef.current(0, turnOrder)
    }
  }, [isHost])

  // Update refs when functions are defined
  useEffect(() => {
    startPictionaryTurnRef.current = startPictionaryTurn
    startPictionaryRef.current = startPictionary
  }, [startPictionaryTurn, startPictionary])

  const startPictionaryGuess = useCallback(() => {
    if (!isHost || !hostStateRef.current) return

    const guessState: RoomState = {
      ...hostStateRef.current,
      phase: 'pictionary_guess',
      timer: {
        startedAt: Date.now(),
        durationMs: 15000,
      },
    }
    hostStateRef.current = guessState
    broadcastRoomState(guessState)

    // Clear any existing timer
    if (guessTimerRef.current) {
      clearTimeout(guessTimerRef.current)
    }

    // Set timeout to move to reveal if not all players guess
    guessTimerRef.current = setTimeout(() => {
      if (startPictionaryRevealRef.current && hostStateRef.current?.phase === 'pictionary_guess') {
        startPictionaryRevealRef.current()
      }
      guessTimerRef.current = null
    }, 15000)
  }, [isHost, broadcastRoomState])

  // Update guess ref after function is defined
  useEffect(() => {
    startPictionaryGuessRef.current = startPictionaryGuess
  }, [startPictionaryGuess])

  const startPictionaryReveal = useCallback(() => {
    if (!isHost || !hostStateRef.current) return

    // Get current guesses
    const currentGuesses = hostStateRef.current.pictionary?.guesses || []
    
    // Hardcoded dummy guesses to ensure at least 3 options
    const dummyGuesses = [
      { userId: 'dummy-1', text: 'A random guess' },
      { userId: 'dummy-2', text: 'Something else' },
      { userId: 'dummy-3', text: 'Not sure what this is' },
    ]

    // If we have less than 3 real guesses, add dummy guesses
    let allGuesses = [...currentGuesses]
    if (currentGuesses.length < 3) {
      const neededDummies = 3 - currentGuesses.length
      allGuesses = [...currentGuesses, ...dummyGuesses.slice(0, neededDummies)]
    }

    const revealState: RoomState = {
      ...hostStateRef.current,
      phase: 'pictionary_reveal',
      pictionary: {
        ...hostStateRef.current.pictionary!,
        guesses: allGuesses,
      },
      timer: null, // No timer for reveal phase
    }
    hostStateRef.current = revealState
    broadcastRoomState(revealState)
  }, [isHost, broadcastRoomState])

  // Update reveal ref after function is defined
  useEffect(() => {
    startPictionaryRevealRef.current = startPictionaryReveal
  }, [startPictionaryReveal])

  const advancePictionaryTurn = useCallback(async () => {
    if (!isHost || !hostStateRef.current || !hostStateRef.current.pictionary) return

    const nextIndex = hostStateRef.current.pictionary.turnIndex + 1
    const turnOrder = hostStateRef.current.pictionary.turnOrder
    const maxTurns = Math.min(5, turnOrder.length)
    
    // Check if next turn would exceed max turns
    if (nextIndex >= maxTurns) {
      // End game, show results
      const resultsState: RoomState = {
        ...hostStateRef.current,
        phase: 'results',
        timer: null,
        pictionary: undefined,
        trivia: undefined,
      }
      hostStateRef.current = resultsState
      setRoomState(resultsState)
      broadcastRoomState(resultsState)

      // Determine winner
      const sortedPlayers = [...resultsState.players].sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        return a.joinedAt - b.joinedAt
      })
      const winner = sortedPlayers[0]

      // Update session with winner
      // Type assertion for update operation - cast as any to bypass Supabase type inference issues
      const { error: updateError } = await (supabase.from('sessions') as any)
        .update({
          status: 'ended',
          winner_id: winner.userId,
          expires_at: new Date().toISOString(),
        })
        .eq('code', code.toUpperCase())

      if (updateError) {
        console.error('Error updating session with winner:', updateError)
      } else {
        // Update local session status
        setSessionStatus('ended')
        console.log('Session updated with winner:', winner.userId, 'Winner name:', winner.name)
      }

      return
    }
    
    startPictionaryTurn(nextIndex, turnOrder)
  }, [isHost, startPictionaryTurn, code, supabase, broadcastRoomState])

  // Update advance ref after function is defined
  useEffect(() => {
    advancePictionaryTurnRef.current = advancePictionaryTurn
  }, [advancePictionaryTurn])

  const handleContinueToNextRound = useCallback(() => {
    if (!isHost || !hostStateRef.current || !hostStateRef.current.pictionary) return
    
    // Check if this is the last round
    const currentTurnIndex = hostStateRef.current.pictionary.turnIndex
    const turnOrder = hostStateRef.current.pictionary.turnOrder
    const maxTurns = Math.min(5, turnOrder.length)
    const isLastRound = currentTurnIndex + 1 >= maxTurns
    
    // Advance to next turn (or results if last round)
    if (hostStateRef.current.pictionary.closestWinnerId && hostStateRef.current.pictionary.funniestWinnerId) {
      if (isLastRound) {
        // For last round, advancePictionaryTurn will automatically go to results
        // But we can also add a small delay to show the winner announcement
        setTimeout(() => {
          advancePictionaryTurn()
        }, 2000) // Show winner announcement for 2 seconds
      } else {
        advancePictionaryTurn()
      }
    }
  }, [isHost, advancePictionaryTurn])

  const handleRevealGender = useCallback(async () => {
    if (!isHost || !hostStateRef.current) return
    
    // Clear auto-advance timer if user clicks button
    if (revealAdvanceTimerRef.current) {
      clearTimeout(revealAdvanceTimerRef.current)
      revealAdvanceTimerRef.current = null
    }
    
    // Determine winner
    const sortedPlayers = [...hostStateRef.current.players].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      return a.joinedAt - b.joinedAt
    })
    const winner = sortedPlayers[0]

    // Update session with winner and set status to 'ended'
    // Type assertion for update operation - cast as any to bypass Supabase type inference issues
    const { error: updateError } = await (supabase.from('sessions') as any)
      .update({ 
        winner_id: winner.userId,
        status: 'ended'
      })
      .eq('code', code.toUpperCase())

    if (updateError) {
      console.error('Error updating session with winner:', updateError)
      // Still proceed to reveal phase even if update fails
    } else {
      // Update local session status
      setSessionStatus('ended')
      console.log('Session updated with winner:', winner.userId, 'Winner name:', winner.name)
    }

    // Move to reveal phase
    const revealState: RoomState = {
      ...hostStateRef.current,
      phase: 'reveal',
    }
    hostStateRef.current = revealState
    setRoomState(revealState)
    broadcastRoomState(revealState)
  }, [isHost, code, supabase, broadcastRoomState])

  const handleTriviaAnswer = useCallback((questionIndex: number, optionIndex: number) => {
    if (!userId || !channelRef.current) return

    // Store answer in ref for scoring (important for host too!)
    if (!triviaAnswersRef.current[userId]) {
      triviaAnswersRef.current[userId] = {}
    }
    triviaAnswersRef.current[userId][questionIndex] = optionIndex

    // If host, update state immediately before broadcasting
    if (isHost && hostStateRef.current && hostStateRef.current.trivia) {
      const updatedState = {
        ...hostStateRef.current,
        trivia: {
          ...hostStateRef.current.trivia,
          answers: {
            ...hostStateRef.current.trivia.answers,
            [userId]: optionIndex,
          },
        },
      }
      hostStateRef.current = updatedState
      setRoomState(updatedState)
      
      // Then broadcast (others will update via broadcast handler)
      broadcastRoomState(updatedState)
    }

    // Broadcast the answer (host's own broadcast will be ignored in handler since we already processed it)
    channelRef.current.send({
      type: 'broadcast',
      event: 'TRIVIA_ANSWER',
      payload: { userId, questionIndex, optionIndex },
    })
  }, [userId, isHost, broadcastRoomState])

  const handleGuessSubmit = useCallback((text: string) => {
    if (!userId || !channelRef.current) return

    // If host is submitting a guess, process it directly (Supabase doesn't echo broadcasts to sender)
    // Otherwise, just broadcast and let the host process it
    if (isHost && hostStateRef.current && hostStateRef.current.pictionary) {
      const guess = { userId, text }
      
      // Check if guess already exists
      if (!pictionaryGuessesRef.current.find((g) => g.userId === userId)) {
        pictionaryGuessesRef.current.push(guess)

        const drawerUserId = hostStateRef.current.pictionary.drawerUserId
        
        // Count non-drawer players (all players except the drawer)
        const nonDrawerPlayers = hostStateRef.current.players.filter(
          (p) => p.userId !== drawerUserId
        )
        
        // Count real guesses (excluding dummy guesses added later)
        const realGuesses = pictionaryGuessesRef.current.filter(
          (g) => !g.userId.startsWith('dummy-')
        )

        const updatedState = {
          ...hostStateRef.current,
          pictionary: {
            ...hostStateRef.current.pictionary,
            guesses: [...pictionaryGuessesRef.current],
          },
        }
        hostStateRef.current = updatedState
        setRoomState(updatedState)
        broadcastRoomState(updatedState)

        // If all non-drawer players have guessed, move to reveal phase immediately
        if (
          hostStateRef.current.phase === 'pictionary_guess' &&
          realGuesses.length >= nonDrawerPlayers.length &&
          startPictionaryRevealRef.current
        ) {
          // Clear the timeout if it exists
          if (guessTimerRef.current) {
            clearTimeout(guessTimerRef.current)
            guessTimerRef.current = null
          }
          // Move to reveal phase immediately
          if (startPictionaryRevealRef.current) {
            startPictionaryRevealRef.current()
          }
        }
      }
      
      // Also broadcast for consistency (though host already processed)
      try {
        channelRef.current.send({
          type: 'broadcast',
          event: 'GUESS_SUBMIT',
          payload: { userId, text },
        })
      } catch (error) {
        console.error('Error sending GUESS_SUBMIT broadcast:', error)
      }
    } else {
      // Non-host: just broadcast, host will process it
      channelRef.current.send({
        type: 'broadcast',
        event: 'GUESS_SUBMIT',
        payload: { userId, text },
      })
    }
  }, [userId, isHost, broadcastRoomState])

  const handlePickWinner = useCallback((winnerUserId: string, awardType: 'closest' | 'funniest') => {
    console.log("=== handlePickWinner called in SessionPage ===");
    console.log("winnerUserId:", winnerUserId);
    console.log("awardType:", awardType);
    console.log("userId:", userId);
    console.log("isHost:", isHost);
    console.log("channelRef.current exists:", !!channelRef.current);
    
    if (!userId || !channelRef.current) {
      console.error('handlePickWinner: Missing userId or channelRef', {
        hasUserId: !!userId,
        hasChannelRef: !!channelRef.current
      });
      return;
    }

    // Check if current user is the drawer using the latest state
    const currentState = roomState || hostStateRef.current;
    
    if (!currentState?.pictionary) {
      console.error('handlePickWinner: No pictionary state');
      return;
    }
    
    // Verify user is the drawer
    if (currentState.pictionary.drawerUserId !== userId) {
      console.error('handlePickWinner: User is not the drawer', { 
        drawerUserId: currentState.pictionary.drawerUserId, 
        userId 
      });
      return;
    }
    
    if (currentState.phase !== 'pictionary_reveal') {
      console.error('handlePickWinner: Not in reveal phase', { phase: currentState.phase });
      return;
    }
    
    // Use the drawer's userId (the current user who clicked)
    const drawerUserId = userId;
    
    // If the host is the drawer, process directly (Supabase doesn't echo broadcasts to sender)
    // Otherwise, just broadcast and let the host process it
    if (isHost && hostStateRef.current) {
      console.log('Host is drawer, processing directly...');
      
      // Don't award points to dummy guesses
      if (winnerUserId.startsWith('dummy-')) {
        const updatedPictionary: PictionaryState = {
          ...hostStateRef.current.pictionary!,
          ...(awardType === 'closest' 
            ? { closestWinnerId: winnerUserId }
            : { funniestWinnerId: winnerUserId }
          ),
        };
        const newState: RoomState = {
          ...hostStateRef.current,
          pictionary: updatedPictionary,
        };
        hostStateRef.current = newState;
        setRoomState(newState);
        console.log('Host: Directly updated state (dummy guess)', newState);
        broadcastRoomState(newState);
        return;
      }

      // Award points based on award type (only for real players)
      const pointsToAward = awardType === 'closest' ? 2 : 1;
      const updatedPlayers = hostStateRef.current.players.map((p) =>
        p.userId === winnerUserId ? { ...p, points: p.points + pointsToAward } : p
      );

      const updatedPictionary: PictionaryState = {
        ...hostStateRef.current.pictionary!,
        ...(awardType === 'closest' 
          ? { closestWinnerId: winnerUserId }
          : { funniestWinnerId: winnerUserId }
        ),
      };

      const newState: RoomState = {
        ...hostStateRef.current,
        players: updatedPlayers,
        pictionary: updatedPictionary,
      };
      hostStateRef.current = newState;
      setRoomState(newState);
      console.log('Host: Directly updated state (real player)', newState);
      broadcastRoomState(newState);
      
      // Check if both winners are selected AND this is the last round
      if (newState.pictionary) {
        const bothWinnersSelected = newState.pictionary.closestWinnerId && newState.pictionary.funniestWinnerId;
        const currentTurnIndex = newState.pictionary.turnIndex;
        const turnOrder = newState.pictionary.turnOrder;
        const maxTurns = Math.min(5, turnOrder.length);
        const isLastRound = currentTurnIndex + 1 >= maxTurns;
        
        if (bothWinnersSelected && isLastRound && advancePictionaryTurnRef.current) {
          // Auto-advance to results after 10 seconds if button not clicked
          // Clear any existing timer
          if (revealAdvanceTimerRef.current) {
            clearTimeout(revealAdvanceTimerRef.current);
          }
          revealAdvanceTimerRef.current = setTimeout(() => {
            advancePictionaryTurnRef.current?.();
            revealAdvanceTimerRef.current = null;
          }, 10000);
        }
      }
      
      // Also broadcast the PICK_WINNER event for non-hosts (though host already processed)
      try {
        channelRef.current.send({
          type: 'broadcast',
          event: 'PICK_WINNER',
          payload: { drawerUserId, winnerUserId, awardType },
        });
      } catch (error) {
        console.error('Error sending PICK_WINNER broadcast:', error);
      }
    } else {
      // Non-host drawer: just broadcast, host will process
      console.log('Non-host drawer, broadcasting...');
      try {
        channelRef.current.send({
          type: 'broadcast',
          event: 'PICK_WINNER',
          payload: { drawerUserId, winnerUserId, awardType },
        });
        console.log('Broadcast sent successfully');
      } catch (error) {
        console.error('Error sending PICK_WINNER broadcast:', error);
      }
    }
  }, [userId, isHost, roomState, broadcastRoomState])

  const handleStrokeBatch = useCallback((
    points: Array<{ x: number; y: number }>,
    color: string,
    width: number,
    isStart?: boolean,
    isEnd?: boolean
  ) => {
    if (!userId || !channelRef.current || !roomState?.pictionary) return

    if (roomState.pictionary.drawerUserId !== userId) return

    channelRef.current.send({
      type: 'broadcast',
      event: 'STROKE_BATCH',
      payload: { drawerUserId: userId, points, color, width, isStart, isEnd },
    })
  }, [userId, roomState])

  const handleExitSession = useCallback(async () => {
    // Leave the channel properly
    if (channelRef.current) {
      await channelRef.current.untrack()
      await channelRef.current.unsubscribe()
    }

    // Small delay to ensure cleanup completes
    setTimeout(() => {
      router.push('/dashboard')
    }, 100)
  }, [router])

  // Sync current drawer ref when roomState updates (for non-hosts) and clear strokes on drawer change
  useEffect(() => {
    if (!isHost && roomState?.pictionary?.drawerUserId) {
      const newDrawer = roomState.pictionary.drawerUserId
      if (currentDrawerRef.current !== newDrawer) {
        currentDrawerRef.current = newDrawer
        setReceivedStrokes([]) // Clear strokes when drawer changes
      }
    }
  }, [roomState?.pictionary?.drawerUserId, isHost])

  if (!roomState || !userId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-100 to-blue-100">
        <div className="text-center">
          <div className="text-2xl text-gray-600">Loading session...</div>
        </div>
      </div>
    )
  }

  // Show waiting room if reconnecting
  if (isReconnecting && !hasReceivedState) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-100 to-blue-100">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md text-center">
          <div className="mb-4">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600"></div>
          </div>
          <h2 className="text-2xl font-bold text-pink-600 mb-4">Reconnecting to Session</h2>
          <p className="text-gray-600 mb-6">
            {isHost 
              ? "Please wait while we sync the game state..."
              : "Please wait for the host to be ready..."}
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Session: <span className="font-mono font-bold">{code.toUpperCase()}</span>
          </p>
          <button
            onClick={handleExitSession}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel & Return to Dashboard
          </button>
        </div>
      </div>
    )
  }

  if (hostDisconnected && !isHost) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-100 to-blue-100">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Host Disconnected</h2>
          <p className="text-gray-600 mb-6">
            The host has left the session. Please return to the dashboard.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full bg-pink-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-pink-700"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    )
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
      <div className="min-h-screen bg-gradient-to-br from-pink-100 to-blue-100 px-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header with Leaderboard */}
        <div className="mb-6 grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-lg p-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-2">
                <div className="flex-1">
                  <h1 className="text-xl sm:text-2xl font-bold text-pink-600 mb-2">
                    Session: {roomState.code}
                  </h1>
                  {roomState.phase !== 'lobby' && roomState.phase !== 'results' && roomState.phase !== 'reveal' && (
                    <Timer timer={roomState.timer} />
                  )}
                </div>
                <div className="w-full sm:w-auto">
                  <button
                    onClick={handleExitSession}
                    className="w-full sm:w-auto px-4 py-2 text-sm sm:text-base bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-semibold min-h-[44px]"
                    title="Exit session and return to dashboard"
                  >
                    Exit Session
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="lg:col-span-1">
            <Leaderboard players={roomState.players} />
          </div>
        </div>

        {/* Main Game Area */}
        {roomState.phase === 'lobby' && (
          <Lobby roomState={roomState} isHost={isHost} onStartGame={startGame} />
        )}

        {(roomState.phase === 'trivia_question' || roomState.phase === 'trivia_reveal') && (
          <Trivia
            roomState={roomState}
            isHost={isHost}
            userId={userId}
            onAnswer={handleTriviaAnswer}
          />
        )}


        {(roomState.phase === 'pictionary_draw' ||
          roomState.phase === 'pictionary_guess' ||
          roomState.phase === 'pictionary_reveal') && (
          <Pictionary
            roomState={roomState}
            isHost={isHost}
            userId={userId}
            onGuessSubmit={handleGuessSubmit}
            onPickWinner={handlePickWinner}
            onStrokeBatch={handleStrokeBatch}
            onContinueToNextRound={handleContinueToNextRound}
            onRevealGender={handleRevealGender}
            receivedStrokes={receivedStrokes}
          />
        )}

              {roomState.phase === 'results' && (
                <Results 
                  roomState={roomState} 
                  isHost={isHost}
                  onContinue={
                    // Show continue to pictionary if:
                    // - Session status is 'trivia_complete' (trivia finished), OR
                    // - We're in results phase, no pictionary state, and game isn't complete yet
                    // Don&apos;t show if reveal button is available (game is complete)
                    (sessionStatus === 'trivia_complete' || (!roomState.trivia && !roomState.pictionary && sessionStatus !== 'ended'))
                      ? () => {
                          if (startPictionaryRef.current) {
                            startPictionaryRef.current()
                          }
                        }
                      : undefined
                  }
                  onRevealGender={
                    // Only show reveal button after BOTH trivia AND pictionary are complete
                    // Session status must be 'ended' which means both games are done
                    sessionStatus === 'ended' && !roomState.trivia && !roomState.pictionary
                      ? handleRevealGender
                      : undefined
                  }
                  continueButtonText={
                    sessionStatus === 'ended' && !roomState.trivia && !roomState.pictionary
                      ? "Show the Baby's Gender"
                      : "Continue to Next Game"
                  }
                  title={
                    sessionStatus === 'ended' && !roomState.trivia && !roomState.pictionary
                      ? "🎉 Game Complete!"
                      : roomState.pictionary
                      ? "Game Results"
                      : "🎉 Trivia Complete!"
                  }
                  subtitle={
                    sessionStatus === 'ended' && !roomState.trivia && !roomState.pictionary
                      ? "Final scores and standings. The winner will see the gender reveal!"
                      : roomState.pictionary
                      ? "Final scores and standings"
                      : "Great job everyone! Check your scores below."
                  }
                />
              )}

        {roomState.phase === 'reveal' && (
          <Reveal roomState={roomState} userId={userId} sessionCode={code.toUpperCase()} />
        )}
        </div>
      </div>
    </>
  )
}

