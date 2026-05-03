/**
 * Suggested follow-up question chips.
 * Displayed after each assistant response in lime green bordered pills.
 */
export default function SuggestedChips({ suggestions, onSelect }) {
  if (!suggestions || suggestions.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 mt-3 animate-slide-up">
      {suggestions.map((suggestion, idx) => (
        <button
          key={idx}
          onClick={() => onSelect(suggestion)}
          className="
            px-3 py-1.5 text-xs text-lime bg-dark-400
            border border-lime/30 rounded-chip
            hover:border-lime hover:bg-dark-300
            transition-all duration-200
            hover:shadow-[0_0_10px_rgba(200,241,53,0.1)]
          "
        >
          {suggestion}
        </button>
      ))}
    </div>
  )
}
