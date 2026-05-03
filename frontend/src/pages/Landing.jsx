import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap, FileSearch, Globe, Github, ArrowRight } from 'lucide-react'
import URLInput from '../components/URLInput'
import Logo from '../components/Logo'
import { useIngestion } from '../hooks/useIngestion'

const EXAMPLE_QUESTIONS = [
  'How does auth work?',
  'Explain the folder structure',
  'Where are API rate limits handled?',
  'What does the entry point do?',
]

const FEATURES = [
  {
    icon: Zap,
    title: 'Instant Indexing',
    description: 'Fetches, chunks, and embeds your entire codebase in seconds using parallel processing.',
  },
  {
    icon: FileSearch,
    title: 'Source Citations',
    description: 'Every answer cites the exact file path and line range it came from. No hallucinations.',
  },
  {
    icon: Globe,
    title: 'Any Public Repo',
    description: 'Works with any public GitHub repository. Just paste the URL and start chatting.',
  },
]

export default function Landing({ onIngest }) {
  const navigate = useNavigate()
  const { startIngestion, isLoading, error, clearError } = useIngestion()
  const [submitError, setSubmitError] = useState('')

  const handleSubmit = async (url) => {
    setSubmitError('')
    clearError()

    try {
      const data = await startIngestion(url)

      // Extract owner/repo from URL for display
      const match = url.match(/github\.com\/([^/]+\/[^/]+)/)
      const repoName = match ? match[1] : url

      onIngest({
        sessionId: data.session_id,
        repoName,
        repoUrl: url,
        status: data.total_chunks > 0 ? 'ready' : 'processing',
        fileTree: data.file_tree,
        totalChunks: data.total_chunks,
        fileCount: data.file_count,
        skippedCount: data.skipped_count,
      })

      // If already ready (cached), go to chat. Otherwise go to loading.
      if (data.total_chunks > 0) {
        navigate('/chat')
      } else {
        navigate('/loading')
      }
    } catch (err) {
      setSubmitError(err.message)
    }
  }

  const handleChipClick = (question) => {
    const input = document.getElementById('repo-url-input')
    if (input) input.focus()
  }

  return (
    <div className="min-h-screen animate-fade-in">
      {/* ── Light Hero Section ───────────────────────────────────────── */}
      <section className="relative bg-dark-50 overflow-hidden">
        {/* Subtle vignette gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/50 via-transparent to-dark-50/80 pointer-events-none" />

        <div className="relative max-w-4xl mx-auto px-6 pt-20 pb-24 text-center">
          {/* Logo / Brand */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <Logo size={44} />
            <span className="text-2xl font-extrabold text-dark-600 tracking-tight">
              RepoDocs
            </span>
          </div>

          {/* Headlines */}
          <h1 className="text-5xl md:text-6xl font-extrabold text-dark-600 leading-tight mb-5 tracking-tight">
            Chat with any
            <br />
            <span className="text-gradient">GitHub repo</span>
          </h1>
          <p className="text-lg text-gray-500 mb-10 max-w-md mx-auto leading-relaxed">
            Paste a repo URL. Ask anything about the codebase.
            <br />
            Get answers with exact file citations.
          </p>

          {/* URL Input */}
          <URLInput onSubmit={handleSubmit} isLoading={isLoading} />

          {/* Error message */}
          {(submitError || error) && (
            <div className="mt-4 text-coral text-sm animate-fade-in">
              {submitError || error}
            </div>
          )}

          {/* Example Question Chips */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs text-gray-400 mr-1">Try asking:</span>
            {EXAMPLE_QUESTIONS.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleChipClick(q)}
                className="
                  px-3 py-1.5 text-xs text-gray-600 bg-white
                  border border-dark-100 rounded-chip
                  hover:border-coral hover:text-coral
                  transition-all duration-200 shadow-sm
                "
              >
                "{q}"
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Dark Section ─────────────────────────────────────────────── */}
      <section className="bg-dark-600 py-24">
        <div className="max-w-5xl mx-auto px-6">
          {/* Mock Chat UI Screenshot */}
          <div className="relative mb-20">
            <div className="bg-dark-400 rounded-card border border-dark-200 p-1 shadow-2xl mx-auto max-w-3xl">
              {/* Window chrome */}
              <div className="flex items-center gap-1.5 px-4 py-3 border-b border-dark-200">
                <div className="w-3 h-3 rounded-full bg-coral/60" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <div className="w-3 h-3 rounded-full bg-green-500/60" />
                <span className="ml-3 text-xs text-gray-600 font-mono">repodocs — chat</span>
              </div>

              {/* Mock chat */}
              <div className="p-6 space-y-4">
                <div className="flex justify-end">
                  <div className="bg-coral text-white text-sm px-4 py-2.5 rounded-card rounded-tr-sm max-w-xs">
                    How does the authentication middleware work?
                  </div>
                </div>
                <div className="flex">
                  <div className="bg-dark-300 text-gray-300 text-sm px-4 py-3 rounded-card rounded-tl-sm max-w-sm">
                    <p className="mb-2">The auth middleware is defined in <code className="text-lime bg-dark-600 px-1 rounded text-xs">src/middleware/auth.ts</code> (lines 12-45).</p>
                    <p className="text-gray-400">It validates JWT tokens from the Authorization header and attaches the decoded user to the request context...</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="text-xs text-lime bg-dark-600 px-2 py-1 rounded-full border border-lime/20">
                    src/middleware/auth.ts L12-45
                  </div>
                  <div className="text-xs text-lime bg-dark-600 px-2 py-1 rounded-full border border-lime/20">
                    src/types/user.ts L1-8
                  </div>
                </div>
              </div>
            </div>

            {/* Glow effect */}
            <div className="absolute -inset-4 bg-gradient-to-r from-coral/5 via-lime/5 to-coral/5 rounded-3xl blur-2xl -z-10" />
          </div>

          {/* Feature Cards */}
          <div className="grid md:grid-cols-3 gap-6">
            {FEATURES.map((feature, idx) => {
              const Icon = feature.icon
              return (
                <div
                  key={idx}
                  className="
                    bg-dark-400 border border-dark-200 rounded-card p-8
                    hover:border-dark-100 transition-all duration-300
                    hover:shadow-lg hover:-translate-y-1
                    group
                  "
                >
                  <div className="
                    w-12 h-12 bg-dark-300 rounded-xl flex items-center justify-center mb-5
                    group-hover:bg-dark-200 transition-colors
                  ">
                    <Icon size={22} className="text-lime" />
                  </div>
                  <h3 className="text-white font-bold text-lg mb-2">{feature.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{feature.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="bg-dark-600 border-t border-dark-200 py-6">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between">
          <span className="text-gray-600 text-sm">
            RepoDocs — Powered by LangChain + Ollama
          </span>
          <a
            href="https://github.com/Cypher-redeye/RepoDocs"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 hover:text-white transition-colors"
          >
            <Github size={18} />
          </a>
          {/* HMR force refresh */}
        </div>
      </footer>
    </div>
  )
}
