'use client'

import React, { useState, useEffect, useRef } from 'react'
import type { RoomState } from '@/lib/realtime/types'
import { TRIVIA_QUESTIONS, NUM_TRIVIA_QUESTIONS } from '@/data/trivia'
import Timer from './Timer'
import Modal from './Modal'

interface TriviaProps {
  roomState: RoomState
  isHost: boolean
  userId: string
  onAnswer: (questionIndex: number, optionIndex: number) => void
}

export default function Trivia({
  roomState,
  isHost,
  userId,
  onAnswer,
}: TriviaProps) {
  // Hooks must be called before any early returns
  const previousQuestionIndexRef = useRef<number>(roomState.trivia?.questionIndex ?? 0)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState('')

  // Show modal when reveal phase starts, hide when question changes or phase changes
  useEffect(() => {
    const trivia = roomState.trivia;
    if (!trivia) return;
    
    const question = TRIVIA_QUESTIONS[trivia.questionIndex];
    const hasAnswered = trivia.answers[userId] !== undefined;
    const showResults = roomState.phase === 'trivia_reveal';
    const correctIndex = trivia.correctIndex;
    
    // Reset modal when question index changes (new question started)
    if (trivia.questionIndex !== previousQuestionIndexRef.current) {
      setShowFeedbackModal(false)
      previousQuestionIndexRef.current = trivia.questionIndex
    }
    
    // Show modal when reveal phase starts
    if (showResults && correctIndex !== undefined && hasAnswered) {
      const userAnswer = trivia.answers[userId]
      const correct = userAnswer === correctIndex
      setIsCorrect(correct)
      
      if (correct) {
        setFeedbackMessage('Your answer was correct! +1 point\n\nGreat job!')
      } else {
        setFeedbackMessage(`Your answer was incorrect.\n\nThe correct answer was: "${question.options[correctIndex]}"`)
      }
      
      setShowFeedbackModal(true)
    } else if (!showResults) {
      // Hide modal when we leave reveal phase
      setShowFeedbackModal(false)
    }
  }, [roomState.trivia, roomState.phase, userId])

  // Early return after all hooks
  const trivia = roomState.trivia
  if (!trivia) return null

  const question = TRIVIA_QUESTIONS[trivia.questionIndex]
  const hasAnswered = trivia.answers[userId] !== undefined
  const showResults = roomState.phase === 'trivia_reveal'
  const correctIndex = trivia.correctIndex

  return (
    <div className="max-w-4xl mx-auto px-4">
      <div className="bg-white rounded-lg shadow-xl p-4 sm:p-8">
        <div className="text-center mb-4 sm:mb-6">
          <div className="text-xs sm:text-sm text-gray-500 mb-2">
            Question {trivia.questionIndex + 1} of {NUM_TRIVIA_QUESTIONS}
          </div>
          <h2 className="text-lg sm:text-2xl font-bold text-gray-800 mb-3 sm:mb-4 px-2">{question.text}</h2>
          <Timer timer={roomState.timer} />
        </div>

        <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
          {question.options.map((option, index) => {
            const isSelected = trivia.answers[userId] === index
            const isCorrect = showResults && correctIndex !== undefined && index === correctIndex
            const isWrong = showResults && isSelected && correctIndex !== undefined && index !== correctIndex
            // Allow changing answers until results are shown
            const disabled = showResults

            let bgColor = 'bg-gray-50 hover:bg-gray-100'
            if (showResults) {
              if (isCorrect) bgColor = 'bg-green-200 border-2 border-green-500'
              else if (isWrong) bgColor = 'bg-red-200 border-2 border-red-500'
            } else if (isSelected) {
              bgColor = 'bg-blue-200 border-2 border-blue-500'
            }

            return (
              <button
                key={index}
                onClick={() => !disabled && onAnswer(trivia.questionIndex, index)}
                disabled={disabled}
                className={`w-full p-3 sm:p-4 rounded-lg text-left font-medium transition-colors border-2 text-sm sm:text-base min-h-[48px] ${
                  disabled ? 'cursor-not-allowed' : 'cursor-pointer'
                } ${bgColor}`}
              >
                <div className="flex items-center justify-between">
                  <span>{option}</span>
                  {showResults && isCorrect && (
                    <span className="text-green-600 font-bold">✓ Correct</span>
                  )}
                  {showResults && isWrong && (
                    <span className="text-red-600 font-bold">✗ Wrong</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Feedback Modal - shows during reveal phase, auto-closes when next question starts */}
        <Modal
          isOpen={showFeedbackModal}
          onClose={() => setShowFeedbackModal(false)}
          title={isCorrect ? '🎉 Correct Answer!' : '❌ Incorrect Answer'}
          message={feedbackMessage}
          type={isCorrect ? 'success' : 'error'}
          showConfirm={false}
        />

        {!hasAnswered && !showResults && (
          <div className="text-center text-gray-500 text-sm">
            Select your answer above
          </div>
        )}
        {hasAnswered && !showResults && (
          <div className="text-center text-blue-600 text-sm font-medium">
            ✓ Answer selected - You can change your answer before time runs out
          </div>
        )}
      </div>
    </div>
  )
}

