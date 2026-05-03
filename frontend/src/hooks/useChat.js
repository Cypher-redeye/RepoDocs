import { useState, useCallback, useRef } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

/**
 * Hook for managing the chat with a codebase.
 * Handles SSE streaming from POST /api/chat.
 */
export function useChat(sessionId) {
  const [messages, setMessages] = useState([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [sources, setSources] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [error, setError] = useState(null)
  const abortControllerRef = useRef(null)

  const sendMessage = useCallback(async (message) => {
    if (!message.trim() || isStreaming) return

    setError(null)
    setSources([])
    setSuggestions([])

    // Add user message
    const userMessage = { role: 'user', content: message }
    setMessages(prev => [...prev, userMessage])

    // Add placeholder assistant message
    const assistantMessage = { role: 'assistant', content: '' }
    setMessages(prev => [...prev, assistantMessage])

    setIsStreaming(true)

    // Build chat history (exclude the empty assistant placeholder)
    const chatHistory = [...messages, userMessage].map(m => ({
      role: m.role,
      content: m.content,
    }))

    try {
      abortControllerRef.current = new AbortController()

      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          message: message,
          chat_history: chatHistory,
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Chat request failed')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Process SSE events from buffer
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue

          try {
            const eventData = JSON.parse(line.slice(6))

            switch (eventData.type) {
              case 'token':
                setMessages(prev => {
                  const updated = [...prev]
                  const lastIdx = updated.length - 1
                  if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
                    updated[lastIdx] = {
                      ...updated[lastIdx],
                      content: updated[lastIdx].content + eventData.content,
                    }
                  }
                  return updated
                })
                break

              case 'sources':
                setSources(eventData.sources || [])
                break

              case 'suggestions':
                setSuggestions(eventData.suggestions || [])
                break

              case 'error':
                setError(eventData.content)
                break

              case 'done':
                break
            }
          } catch (parseError) {
            // Skip malformed SSE events
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') return
      setError(err.message)
      // Remove the empty assistant message on error
      setMessages(prev => {
        const updated = [...prev]
        if (updated.length > 0 && updated[updated.length - 1].content === '') {
          updated.pop()
        }
        return updated
      })
    } finally {
      setIsStreaming(false)
      abortControllerRef.current = null
    }
  }, [sessionId, messages, isStreaming])

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }, [])

  const clearChat = useCallback(() => {
    setMessages([])
    setSources([])
    setSuggestions([])
    setError(null)
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return {
    messages,
    isStreaming,
    sources,
    suggestions,
    error,
    sendMessage,
    stopStreaming,
    clearChat,
    clearError,
  }
}
