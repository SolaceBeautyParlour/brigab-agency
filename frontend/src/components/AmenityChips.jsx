/**
 * Toggleable chip list. Same component powers three places: the manager's
 * hostel-amenities picker, the manager's room-amenities picker, and the
 * student's filter panel — all drawing from the same fixed option list so
 * nothing ever drifts out of sync.
 */
export default function AmenityChips({ options, selected, onToggle, label }) {
  return (
    <div>
      {label && <p className="text-xs text-ink/50 mb-2">{label}</p>}
      <div className="flex flex-wrap gap-2" role="group" aria-label={label || "Amenities"}>
        {options.map((opt) => {
          const active = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onToggle(opt)}
              aria-pressed={active}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-rust ${
                active
                  ? "bg-ink text-paper border-ink"
                  : "bg-white text-ink/60 border-ink/15 hover:border-rust/40"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
