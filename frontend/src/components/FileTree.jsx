import { useState } from 'react'
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from 'lucide-react'

/**
 * Collapsible file tree component for the left sidebar.
 * Shows all ingested files with expand/collapse for directories.
 */
function TreeNode({ node, depth = 0, onFileClick }) {
  const [isOpen, setIsOpen] = useState(depth < 2)

  if (node.type === 'file') {
    return (
      <button
        onClick={() => onFileClick?.(node.path)}
        className="
          w-full flex items-center gap-2 px-3 py-1.5 text-left
          text-gray-400 hover:text-white hover:bg-dark-300
          transition-colors text-xs font-mono truncate
        "
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
        title={node.path}
      >
        <File size={13} className="text-gray-500 flex-shrink-0" />
        <span className="truncate">{node.name}</span>
      </button>
    )
  }

  // Directory node
  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="
          w-full flex items-center gap-2 px-3 py-1.5 text-left
          text-gray-300 hover:text-white hover:bg-dark-300
          transition-colors text-xs font-semibold
        "
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
      >
        <span className="flex-shrink-0 text-gray-500">
          {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
        <span className="flex-shrink-0">
          {isOpen ? (
            <FolderOpen size={13} className="text-lime" />
          ) : (
            <Folder size={13} className="text-lime" />
          )}
        </span>
        <span className="truncate">{node.name}</span>
      </button>

      {isOpen && node.children && (
        <div className="animate-fade-in">
          {node.children.map((child, idx) => (
            <TreeNode
              key={`${child.name}-${idx}`}
              node={child}
              depth={depth + 1}
              onFileClick={onFileClick}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function FileTree({ tree, onFileClick }) {
  if (!tree || tree.length === 0) {
    return (
      <div className="p-4 text-center text-gray-600 text-xs">
        No files indexed
      </div>
    )
  }

  return (
    <div className="overflow-y-auto">
      {tree.map((node, idx) => (
        <TreeNode
          key={`${node.name}-${idx}`}
          node={node}
          depth={0}
          onFileClick={onFileClick}
        />
      ))}
    </div>
  )
}
