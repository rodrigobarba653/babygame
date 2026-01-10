'use client'

import { useEffect } from 'react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  message: string
  type?: 'info' | 'success' | 'error' | 'warning'
  confirmText?: string
  showConfirm?: boolean
  children?: React.ReactNode
}

export default function Modal({
  isOpen,
  onClose,
  title,
  message,
  type = 'info',
  confirmText = 'OK',
  showConfirm = true,
  children,
}: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return 'bg-green-100 border-green-500 text-green-800'
      case 'error':
        return 'bg-red-100 border-red-500 text-red-800'
      case 'warning':
        return 'bg-yellow-100 border-yellow-500 text-yellow-800'
      default:
        return 'bg-blue-100 border-blue-500 text-blue-800'
    }
  }

  const getIconColor = () => {
    switch (type) {
      case 'success':
        return 'text-green-600'
      case 'error':
        return 'text-red-600'
      case 'warning':
        return 'text-yellow-600'
      default:
        return 'text-blue-600'
    }
  }

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✓'
      case 'error':
        return '✗'
      case 'warning':
        return '⚠'
      default:
        return 'ℹ'
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full my-4">
        <div className={`border-t-4 rounded-t-lg p-6 ${getTypeStyles()}`}>
          <div className="flex items-start">
            <div className={`flex-shrink-0 w-10 h-10 rounded-full ${getTypeStyles()} flex items-center justify-center text-2xl font-bold mr-4`}>
              <span className={getIconColor()}>{getIcon()}</span>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold mb-2">{title}</h3>
              <p className="text-base whitespace-pre-line">{message}</p>
            </div>
          </div>
        </div>
        {children && (
          <div className="px-6 py-4 bg-gray-50 rounded-b-lg">
            {children}
          </div>
        )}
        {showConfirm && !children && (
          <div className="px-4 sm:px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end">
            <button
              onClick={onClose}
              className={`px-6 py-2.5 sm:py-2 rounded-lg font-semibold transition-colors text-sm sm:text-base min-h-[44px] ${
                type === 'error'
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : type === 'success'
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : type === 'warning'
                  ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {confirmText}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

