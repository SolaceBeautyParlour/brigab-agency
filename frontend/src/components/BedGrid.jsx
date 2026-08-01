import { BedDouble, X, Pencil, Trash2 } from "lucide-react";
import RoomMedia from "./RoomMedia.jsx";

/**
 * Renders one card per room with its beds. In manager mode, clicking a bed
 * toggles it live via onToggleBed — deliberately one tap, no confirmation
 * dialog, because manager adoption depends on this staying friction-free.
 * Editing/deleting a room, by contrast, IS a deliberate action, so those
 * get a small confirm step via onDeleteRoom (handled by the parent).
 *
 * Accessibility: status is never color-only. Each bed has a background
 * shape + icon combo that differs by state (not just hue), a real
 * aria-label + aria-pressed for screen readers, and a visible per-room
 * text summary. Buttons are keyboard-focusable with a visible focus ring.
 */
export default function BedGrid({ rooms, onSelectRoom, managerMode, onToggleBed, onEditRoom, onDeleteRoom }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {rooms.map((room) => {
        const openCount = room.beds.filter((b) => b.status === "available").length;
        const full = openCount === 0;
        return (
          <div key={room.id} className="border border-ink/10 rounded-lg p-3 bg-white/60 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-ink/60">{room.room_code}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink/50">{room.room_type}</span>
                {managerMode && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onEditRoom(room)}
                      aria-label={`Edit room ${room.room_code}`}
                      className="text-ink/35 hover:text-ink outline-none focus-visible:ring-2 focus-visible:ring-rust rounded p-0.5"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteRoom(room)}
                      aria-label={`Delete room ${room.room_code}`}
                      className="text-ink/35 hover:text-rust outline-none focus-visible:ring-2 focus-visible:ring-rust rounded p-0.5"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <RoomMedia room={room} managerMode={managerMode} />

            {room.amenities?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {room.amenities.map((a) => (
                  <span key={a} className="text-[10px] px-1.5 py-0.5 rounded bg-ink/[0.05] text-ink/50">
                    {a}
                  </span>
                ))}
              </div>
            )}

            <div className="flex gap-1.5 flex-wrap" role="group" aria-label={`Beds in room ${room.room_code}`}>
              {room.beds.map((bed, i) => {
                const available = bed.status === "available";
                return managerMode ? (
                  <button
                    key={bed.id}
                    type="button"
                    onClick={() => onToggleBed(bed.id, available ? "taken" : "available")}
                    aria-pressed={!available}
                    aria-label={`Bed ${i + 1} in room ${room.room_code} — ${available ? "available. Tap to mark taken." : "taken. Tap to mark available."}`}
                    className={`relative w-7 h-7 rounded-md flex items-center justify-center transition-colors outline-none
                      focus-visible:ring-2 focus-visible:ring-rust focus-visible:ring-offset-1
                      ${available ? "bg-forest/15 hover:bg-forest/25" : "bg-ink/[0.06] hover:bg-ink/10"}`}
                  >
                    <BedDouble size={15} strokeWidth={2} className={available ? "text-forest" : "text-ink/35"} />
                    {!available && (
                      <X size={10} strokeWidth={3} className="absolute -top-1 -right-1 text-ink/50 bg-paper rounded-full" aria-hidden="true" />
                    )}
                  </button>
                ) : (
                  <span
                    key={bed.id}
                    role="img"
                    aria-label={`Bed ${i + 1}: ${available ? "available" : "taken"}`}
                    className={`relative w-7 h-7 rounded-md flex items-center justify-center ${available ? "bg-forest/15" : "bg-ink/[0.06]"}`}
                  >
                    <BedDouble size={15} strokeWidth={2} className={available ? "text-forest" : "text-ink/35"} />
                    {!available && (
                      <X size={10} strokeWidth={3} className="absolute -top-1 -right-1 text-ink/50 bg-paper rounded-full" aria-hidden="true" />
                    )}
                  </span>
                );
              })}
            </div>

            <p className="text-xs text-ink/45">
              {openCount} open · {room.beds.length - openCount} taken
            </p>

            <div className="flex items-center justify-between mt-1">
              <span className="font-mono text-sm text-ink">
                ₵{Number(room.price_per_year).toLocaleString()}
                <span className="text-ink/40 text-xs">/yr</span>
              </span>
              {!managerMode && (
                <button
                  type="button"
                  onClick={() => onSelectRoom(room, full)}
                  className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors outline-none
                    focus-visible:ring-2 focus-visible:ring-rust focus-visible:ring-offset-1
                    ${full ? "bg-ink/[0.06] text-ink/50 hover:bg-gold/20" : "bg-ink text-paper hover:bg-rust"}`}
                >
                  {full ? "Join waitlist" : "Reserve"}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

