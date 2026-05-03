import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Github, Send, PanelRightClose, PanelRightOpen,
  PanelLeftClose, PanelLeftOpen, Plus, FileCode2,
  Hash, AlertCircle, X, ChevronRight
} from 'lucide-react'
import ChatMessage from '../components/ChatMessage'
import SourcePanel from '../components/SourcePanel'
import FileTree from '../components/FileTree'
import SuggestedChips from '../components/SuggestedChips'
import Logo from '../components/Logo'
import { useChat } from '../hooks/useChat'

export default function Chat({
  sessionId, repoName, repoUrl, fileTree,
  totalChunks, fileCount, skippedCount, onNewRepo,
}) {
  const navigate = useNavigate()
  const {
    messages, isStreaming, sources, suggestions,
    error, sendMessage, stopStreaming, clearChat, clearError,
  } = useChat(sessionId)

  const [input, setInput] = useState('')
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSend = () => {
    if (!input.trim() || isStreaming) return
    sendMessage(input)
    setInput('')
  }

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleSend()
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleNewRepo = () => {
    onNewRepo()
    navigate('/')
  }

  const handleSuggestionClick = (suggestion) => {
    setInput(suggestion)
    inputRef.current?.focus()
  }

  return (
    <div className="h-screen bg-dark-600 flex animate-fade-in">
      {/* ── LEFT SIDEBAR ──────────────────────────────────────────────── */}
      <aside
        className={`
          bg-dark-500 border-r border-dark-200 flex flex-col
          transition-all duration-300 overflow-hidden flex-shrink-0
          ${leftCollapsed ? 'w-0' : 'w-60'}
        `}
      >
        {/* Repo Header */}
        <div className="p-4 border-b border-dark-200">
          <div className="flex items-center gap-2 mb-2">
            <Github size={16} className="text-gray-500" />
            <a
              href={repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white font-semibold text-sm hover:text-coral transition-colors truncate"
              title={repoName}
            >
              {repoName}
            </a>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-600">
            <span className="flex items-center gap-1">
              <FileCode2 size={11} />
              {fileCount} files
            </span>
            <span className="flex items-center gap-1">
              <Hash size={11} />
              {totalChunks} chunks
            </span>
          </div>
          {skippedCount > 0 && (
            <div className="mt-2 text-xs text-gray-600">
              {skippedCount} files skipped
            </div>
          )}
        </div>

        {/* File Tree */}
        <div className="flex-1 overflow-y-auto py-2">
          <div className="px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wider">
            Files
          </div>
          <FileTree tree={fileTree} />
        </div>

        {/* New Repo Button */}
        <div className="p-3 border-t border-dark-200">
          <button
            onClick={handleNewRepo}
            className="
              w-full flex items-center justify-center gap-2
              px-4 py-2.5 bg-coral text-white text-sm font-semibold
              rounded-chip hover:bg-coral-600 transition-colors
              active:scale-95
            "
          >
            <Plus size={16} />
            New Repo
          </button>
        </div>
      </aside>

      {/* Left sidebar toggle (when collapsed) */}
      {leftCollapsed && (
        <button
          onClick={() => setLeftCollapsed(false)}
          className="
            fixed left-2 top-1/2 -translate-y-1/2 z-20
            bg-dark-400 border border-dark-200 rounded-lg p-2
            text-gray-500 hover:text-white transition-colors
          "
        >
          <PanelLeftOpen size={16} />
        </button>
      )}

      {/* ── CENTER PANEL ──────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="h-12 border-b border-dark-200 flex items-center justify-between px-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLeftCollapsed(!leftCollapsed)}
              className="text-gray-500 hover:text-white transition-colors p-1"
              title="Toggle sidebar"
            >
              {leftCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
            <span className="text-sm text-gray-500 font-mono">{repoName}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setRightCollapsed(!rightCollapsed)}
              className="text-gray-500 hover:text-white transition-colors p-1"
              title="Toggle sources panel"
            >
              {rightCollapsed ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />}
            </button>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Logo size={56} />
              <h2 className="text-white text-xl font-bold mb-2">
                Ask anything about this codebase
              </h2>
              <p className="text-gray-600 text-sm mb-8 max-w-sm">
                I've indexed {fileCount} files and {totalChunks} code chunks
                from <span className="text-gray-400">{repoName}</span>.
                Ask me anything!
              </p>

              {/* Starter chips */}
              <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                {[
                  'Explain the project structure',
                  'What does the entry point do?',
                  'Show me the main dependencies',
                  'How is error handling implemented?',
                ].map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInput(q)
                      inputRef.current?.focus()
                    }}
                    className="
                      px-4 py-2 text-sm text-gray-400 bg-dark-400
                      border border-dark-200 rounded-chip
                      hover:border-lime/30 hover:text-lime
                      transition-all duration-200
                    "
                  >
                    <ChevronRight size={12} className="inline mr-1 opacity-50" />
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx}>
              <ChatMessage
                message={msg}
                isStreaming={isStreaming && idx === messages.length - 1 && msg.role === 'assistant'}
              />
              {/* Show suggestions after last assistant message */}
              {msg.role === 'assistant' &&
                idx === messages.length - 1 &&
                !isStreaming &&
                suggestions.length > 0 && (
                  <div className="ml-11 mt-2">
                    <SuggestedChips
                      suggestions={suggestions}
                      onSelect={handleSuggestionClick}
                    />
                  </div>
                )}
            </div>
          ))}

          {/* Error display */}
          {error && (
            <div className="flex items-center gap-2 bg-coral/10 border border-coral/20 rounded-chip px-4 py-3 animate-slide-up">
              <AlertCircle size={16} className="text-coral flex-shrink-0" />
              <p className="text-coral text-sm flex-1">{error}</p>
              <button onClick={clearError} className="text-coral hover:text-white transition-colors">
                <X size={14} />
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="border-t border-dark-200 p-4 flex-shrink-0">
          <div className="max-w-3xl mx-auto flex items-end gap-3">
            <div className="
              flex-1 flex items-end bg-dark-400 border border-dark-200
              rounded-input focus-within:border-coral/50 transition-colors
            ">
              <textarea
                ref={inputRef}
                id="chat-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about the codebase... (Enter to send, Shift+Enter for newline)"
                className="
                  flex-1 bg-transparent text-white text-sm placeholder-gray-600
                  px-4 py-3 outline-none resize-none font-inter
                  max-h-32
                "
                rows={1}
                disabled={isStreaming}
                onInput={(e) => {
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px'
                }}
              />
            </div>

            <button
              id="send-message-btn"
              onClick={isStreaming ? stopStreaming : handleSend}
              disabled={!isStreaming && !input.trim()}
              className={`
                p-3 rounded-input transition-all duration-200
                flex items-center justify-center flex-shrink-0
                ${isStreaming
                  ? 'bg-coral/20 text-coral hover:bg-coral/30'
                  : input.trim()
                    ? 'bg-coral text-white hover:bg-coral-600 active:scale-95'
                    : 'bg-dark-400 text-gray-600 cursor-not-allowed'
                }
              `}
              title={isStreaming ? 'Stop generating' : 'Send message (Ctrl+Enter)'}
            >
              {isStreaming ? (
                <div className="w-4 h-4 border-2 border-coral rounded-sm" />
              ) : (
                <Send size={18} />
              )}
            </button>
          </div>
          <div className="text-center mt-2">
            <span className="text-xs text-gray-700">
              Ctrl+Enter to send • Answers cite file paths & line numbers
            </span>
          </div>
        </div>
      </main>

      {/* ── RIGHT PANEL (Sources) ─────────────────────────────────────── */}
      <SourcePanel
        sources={sources}
        isCollapsed={rightCollapsed}
        onToggle={() => setRightCollapsed(!rightCollapsed)}
      />
    </div>
  )
}
