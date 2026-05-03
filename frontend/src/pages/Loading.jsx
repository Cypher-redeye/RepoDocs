import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Github, Loader2, AlertCircle } from 'lucide-react'
import { useIngestion } from '../hooks/useIngestion'

export default function Loading({ sessionId, repoName, repoUrl, onReady }) {
  const navigate = useNavigate()
  const { pollStatus, status, error } = useIngestion()
  const intervalRef = useRef(null)
  const [dots, setDots] = useState('')

  // Animate dots
  useEffect(() => {
    const dotInterval = setInterval(() => {
      setDots(prev => (prev.length >= 3 ? '' : prev + '.'))
    }, 500)
    return () => clearInterval(dotInterval)
  }, [])

  // Poll status every 2 seconds
  useEffect(() => {
    if (!sessionId) return

    const poll = async () => {
      try {
        const data = await pollStatus(sessionId)

        if (data.status === 'ready') {
          clearInterval(intervalRef.current)
          onReady({
            status: 'ready',
            fileTree: data.file_tree,
            totalChunks: data.total_chunks,
            fileCount: data.file_count,
            skippedCount: data.skipped_count,
          })
          navigate('/chat')
        } else if (data.status === 'error') {
          clearInterval(intervalRef.current)
        }
      } catch (err) {
        // Will retry on next interval
      }
    }

    // Initial poll
    poll()

    // Set up interval
    intervalRef.current = setInterval(poll, 2000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  const progressPercent = status?.progress_percent || 0
  const stage = status?.stage || 'Starting...'
  const fileCount = status?.file_count || 0
  const isError = status?.status === 'error' || !!error

  return (
    <div className="min-h-screen bg-dark-600 flex items-center justify-center animate-fade-in">
      <div className="max-w-md w-full mx-auto px-6 text-center">
        {/* Repo info */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <Github size={20} className="text-gray-500" />
          <span className="text-gray-400 font-mono text-sm">{repoName}</span>
        </div>

        {/* Main status */}
        {isError ? (
          <div className="animate-slide-up">
            <div className="w-16 h-16 mx-auto mb-6 bg-coral/10 rounded-full flex items-center justify-center">
              <AlertCircle size={32} className="text-coral" />
            </div>
            <h2 className="text-white text-xl font-bold mb-3">Ingestion Failed</h2>
            <p className="text-gray-500 text-sm mb-8 leading-relaxed">
              {stage || error || 'An unknown error occurred.'}
            </p>
            <button
              onClick={() => navigate('/')}
              className="
                px-6 py-3 bg-coral text-white font-semibold rounded-chip
                hover:bg-coral-600 transition-colors
              "
            >
              Try Again
            </button>
          </div>
        ) : (
          <div className="animate-slide-up">
            {/* Spinning loader */}
            <div className="w-16 h-16 mx-auto mb-8 relative">
              <Loader2 size={64} className="text-coral animate-spin" />
            </div>

            {/* Status text */}
            <h2 className="text-white text-xl font-bold mb-2">
              Indexing Repository{dots}
            </h2>
            <p className="text-gray-500 text-sm mb-8">
              {stage}
            </p>

            {/* Progress bar */}
            <div className="progress-bar mb-4">
              <div
                className="progress-bar-fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Stats row */}
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>{progressPercent}% complete</span>
              {fileCount > 0 && (
                <span>{fileCount} files processed</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
