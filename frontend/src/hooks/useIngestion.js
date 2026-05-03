import { useState, useCallback } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

/**
 * Hook for managing the repository ingestion flow.
 * Handles POST /api/ingest and GET /api/status/{session_id} polling.
 */
export function useIngestion() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState(null)

  const startIngestion = useCallback(async (repoUrl) => {
    setIsLoading(true)
    setError(null)
    setStatus(null)

    try {
      const response = await fetch(`${API_BASE}/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_url: repoUrl }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to start ingestion')
      }

      const data = await response.json()
      return data
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const pollStatus = useCallback(async (sessionId) => {
    try {
      const response = await fetch(`${API_BASE}/status/${sessionId}`)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to get status')
      }

      const data = await response.json()
      setStatus(data)
      return data
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return {
    isLoading,
    error,
    status,
    startIngestion,
    pollStatus,
    clearError,
  }
}
