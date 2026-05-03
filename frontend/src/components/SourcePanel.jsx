import { useState } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { FileCode2, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'

/**
 * Right panel showing source citations from the RAG retrieval.
 * Each source shows file path, line range, and expandable code preview.
 */
export default function SourcePanel({ sources, isCollapsed, onToggle }) {
  const [expandedIdx, setExpandedIdx] = useState(null)

  const getLanguage = (filePath) => {
    const ext = filePath.split('.').pop()?.toLowerCase()
    const langMap = {
      py: 'python', js: 'javascript', ts: 'typescript',
      jsx: 'jsx', tsx: 'tsx', java: 'java', go: 'go',
      rs: 'rust', rb: 'ruby', php: 'php', c: 'c',
      cpp: 'cpp', h: 'c', css: 'css', html: 'html',
      json: 'json', yaml: 'yaml', yml: 'yaml',
      md: 'markdown', sql: 'sql', sh: 'bash',
      toml: 'toml', xml: 'xml',
    }
    return langMap[ext] || 'text'
  }

  if (!sources || sources.length === 0) {
    return (
      <div
        className={`
          border-l border-dark-200 bg-dark-500 flex flex-col transition-all duration-300
          ${isCollapsed ? 'w-0 overflow-hidden' : 'w-80'}
        `}
      >
        <div className="p-4 border-b border-dark-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
            Sources
          </h3>
          <button onClick={onToggle} className="text-gray-500 hover:text-white transition-colors">
            <ChevronDown size={16} />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-gray-600 text-sm text-center">
            Ask a question to see relevant source files here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`
        border-l border-dark-200 bg-dark-500 flex flex-col transition-all duration-300
        ${isCollapsed ? 'w-0 overflow-hidden' : 'w-80'}
      `}
    >
      {/* Header */}
      <div className="p-4 border-b border-dark-200 flex items-center justify-between flex-shrink-0">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Sources
          <span className="ml-2 text-xs bg-dark-200 text-lime px-2 py-0.5 rounded-full">
            {sources.length}
          </span>
        </h3>
        <button onClick={onToggle} className="text-gray-500 hover:text-white transition-colors">
          <ChevronDown size={16} />
        </button>
      </div>

      {/* Source List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {sources.map((source, idx) => (
          <div
            key={idx}
            className="
              bg-dark-400 rounded-card border border-dark-200
              overflow-hidden transition-all duration-200 hover:border-dark-100
              animate-slide-up
            "
            style={{ animationDelay: `${idx * 50}ms` }}
          >
            {/* Source Header */}
            <button
              onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
              className="w-full p-3 flex items-start gap-2 text-left hover:bg-dark-300 transition-colors"
            >
              <FileCode2 size={14} className="text-lime mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                {/* File path pill */}
                <span className="
                  inline-block text-xs font-mono text-lime bg-dark-600
                  px-2 py-0.5 rounded-full truncate max-w-full
                ">
                  {source.file_path}
                </span>
                {/* Line range badge */}
                <span className="
                  ml-2 inline-block text-xs text-gray-500 bg-dark-200
                  px-2 py-0.5 rounded-full
                ">
                  L{source.start_line}–{source.end_line}
                </span>
              </div>
              {expandedIdx === idx ? (
                <ChevronUp size={14} className="text-gray-500 flex-shrink-0" />
              ) : (
                <ChevronDown size={14} className="text-gray-500 flex-shrink-0" />
              )}
            </button>

            {/* Preview (always visible) */}
            <div className="px-3 pb-3">
              <div className="rounded-lg overflow-hidden text-xs">
                <SyntaxHighlighter
                  language={getLanguage(source.file_path)}
                  style={vscDarkPlus}
                  customStyle={{
                    margin: 0,
                    padding: '0.75rem',
                    fontSize: '0.7rem',
                    background: '#0d0d0d',
                    maxHeight: expandedIdx === idx ? '400px' : '120px',
                    transition: 'max-height 300ms ease-in-out',
                    overflow: 'auto',
                  }}
                  showLineNumbers
                  startingLineNumber={source.start_line}
                  lineNumberStyle={{ color: '#555', minWidth: '2em' }}
                >
                  {expandedIdx === idx
                    ? (source.full_text || source.preview)
                    : source.preview
                  }
                </SyntaxHighlighter>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
