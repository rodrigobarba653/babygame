'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-100 to-blue-100 px-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-2xl w-full">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Something went wrong!</h1>
        <div className="bg-gray-50 rounded p-4 mb-4">
          <p className="text-sm font-mono text-gray-800 break-all">
            <strong>Error:</strong> {error.message}
          </p>
          {error.digest && (
            <p className="text-sm font-mono text-gray-600 mt-2">
              <strong>Digest:</strong> {error.digest}
            </p>
          )}
          {process.env.NODE_ENV === 'development' && error.stack && (
            <pre className="text-xs text-gray-600 mt-4 overflow-auto max-h-96">
              {error.stack}
            </pre>
          )}
        </div>
        <div className="flex gap-4">
          <button
            onClick={reset}
            className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors"
          >
            Try again
          </button>
          <a
            href="/login"
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Go to Login
          </a>
        </div>
      </div>
    </div>
  )
}
