import { useState } from 'react'
import { Search, AlertCircle, Loader2 } from 'lucide-react'

/**
 * URL input component for the landing page.
 * Validates GitHub URLs inline before submission.
 */
export default function URLInput({ onSubmit, isLoading }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')

  const validateUrl = (value) => {
    if (!value.trim()) {
      setError('')
      return false
    }

    if (!value.includes('github.com')) {
      setError('Please enter a valid GitHub repository URL')
      return false
    }

    const pattern = /(?:https?:\/\/)?github\.com\/[\w.-]+\/[\w.-]+/
    if (!pattern.test(value)) {
      setError('Expected format: https://github.com/owner/repo')
      return false
    }

    setError('')
    return true
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (validateUrl(url) && !isLoading) {
      onSubmit(url)
    }
  }

  const handleChange = (e) => {
    const value = e.target.value
    setUrl(value)
    if (error) validateUrl(value)
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="relative">
        <div
          className={`
            flex items-center bg-white rounded-input border-2 transition-all duration-200
            ${error ? 'border-coral' : 'border-transparent focus-within:border-dark-600'}
            shadow-lg hover:shadow-xl
          `}
        >
          <div className="pl-5 text-gray-400">
            <Search size={20} />
          </div>
          <input
            id="repo-url-input"
            type="text"
            value={url}
            onChange={handleChange}
            placeholder="https://github.com/owner/repository"
            className="
              flex-1 px-4 py-4 text-base text-dark-600 placeholder-gray-400
              bg-transparent outline-none font-inter
            "
            disabled={isLoading}
            autoComplete="off"
            spellCheck="false"
          />
          <button
            id="analyze-repo-btn"
            type="submit"
            disabled={isLoading || !url.trim() || !!error}
            className="
              mr-2 px-6 py-2.5 bg-coral text-white font-semibold text-sm
              rounded-chip transition-all duration-200
              hover:bg-coral-600 active:scale-95
              disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-coral
              flex items-center gap-2
            "
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Analyzing...
              </>
            ) : (
              'Analyze Repo'
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 mt-3 text-coral text-sm animate-fade-in">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}
    </form>
  )
}
