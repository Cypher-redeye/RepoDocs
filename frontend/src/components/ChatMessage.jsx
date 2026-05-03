import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { User, Bot, Copy, Check } from 'lucide-react'
import { useState } from 'react'

/**
 * Individual chat message bubble.
 * Renders user messages in coral, assistant messages in dark with markdown support.
 */
export default function ChatMessage({ message, isStreaming }) {
  const [copied, setCopied] = useState(false)
  const isUser = message.role === 'user'

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className={`
        flex gap-3 animate-slide-up
        ${isUser ? 'flex-row-reverse' : 'flex-row'}
      `}
    >
      {/* Avatar */}
      <div
        className={`
          flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1
          ${isUser ? 'bg-coral' : 'bg-dark-200'}
        `}
      >
        {isUser ? (
          <User size={16} className="text-white" />
        ) : (
          <Bot size={16} className="text-lime" />
        )}
      </div>

      {/* Message Bubble */}
      <div
        className={`
          relative max-w-[75%] rounded-card px-5 py-4 group
          ${isUser
            ? 'bg-coral text-white rounded-tr-sm'
            : 'bg-dark-300 text-white rounded-tl-sm'
          }
        `}
      >
        {isUser ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="markdown-body text-sm">
            {message.content ? (
              <ReactMarkdown
                skipHtml={true}
                disallowedElements={['script', 'iframe', 'object', 'embed']}
                components={{
                  code({ node, inline, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '')
                    return !inline && match ? (
                      <SyntaxHighlighter
                        style={vscDarkPlus}
                        language={match[1]}
                        PreTag="div"
                        customStyle={{
                          margin: '0.75rem 0',
                          borderRadius: '8px',
                          fontSize: '0.8rem',
                          background: '#1a1a1a',
                        }}
                        {...props}
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    ) : (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    )
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            ) : (
              <div className="typing-indicator py-1">
                <span></span>
                <span></span>
                <span></span>
              </div>
            )}
            {isStreaming && message.content && (
              <span className="inline-block w-2 h-4 bg-coral animate-pulse ml-0.5 align-middle" />
            )}
          </div>
        )}

        {/* Copy button for assistant messages */}
        {!isUser && message.content && !isStreaming && (
          <button
            onClick={handleCopy}
            className="
              absolute -bottom-2 right-3 opacity-0 group-hover:opacity-100
              transition-opacity p-1.5 rounded-md bg-dark-200 hover:bg-dark-400
              text-gray-400 hover:text-white
            "
            title="Copy message"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
        )}
      </div>
    </div>
  )
}
