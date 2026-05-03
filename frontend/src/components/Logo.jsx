/**
 * RepoDocs Logo — custom SVG icon.
 * A stylized code document with brackets.
 */
export default function Logo({ size = 40, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Background rounded square */}
      <rect width="40" height="40" rx="10" fill="#0d0d0d" />

      {/* Document shape */}
      <path
        d="M12 8h10l6 6v18a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z"
        fill="#1a1a1a"
        stroke="#2a2a2a"
        strokeWidth="0.5"
      />
      {/* Folded corner */}
      <path
        d="M22 8v6h6"
        fill="#161616"
        stroke="#2a2a2a"
        strokeWidth="0.5"
      />

      {/* Left bracket < */}
      <path
        d="M17 17l-4 4.5 4 4.5"
        stroke="#e8564a"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Right bracket > */}
      <path
        d="M21 17l4 4.5-4 4.5"
        stroke="#c8f135"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Slash / */}
      <path
        d="M20.5 16l-3 10"
        stroke="#666"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}
