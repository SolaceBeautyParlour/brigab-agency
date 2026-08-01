import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import AmenityChips from "./AmenityChips.jsx";

const ROOM_TYPES = ["Single", "2-in-1", "3-in-1", "4-in-1"];

export default function FilterPanel({ filters, setFilters, amenityOptions, onClose }) {
  const panelRef = useRef(null);

  useEffect(() => {
    panelRef.current?.querySelector("button, input")?.focus();
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function toggleFrom(key, item) {
    setFilters((f) => ({
      ...f,
      [key]: f[key].includes(item) ? f[key].filter((x) => x !== item) : [...f[key], item],
    }));
  }

  function clearAll() {
    setFilters({ minPrice: "", maxPrice: "", roomTypes: [], hostelAmenities: [], roomAmenities: [] });
  }

  return (
    <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Filters"
        className="bg-paper rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[85vh] overflow-y-auto p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl text-ink">Filters</h2>
          <button type="button" onClick={onClose} aria-label="Close filters" className="text-ink/40 hover:text-ink outline-none focus-visible:ring-2 focus-visible:ring-rust rounded p-1">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <p className="font-display text-sm text-ink mb-2">Price range (₵/year)</p>
            <div className="flex items-center gap-2">
              <label htmlFor="f-min" className="sr-only">Minimum price</label>
              <input
                id="f-min" type="number" min="0" placeholder="Min" value={filters.minPrice}
                onChange={(e) => setFilters((f) => ({ ...f, minPrice: e.target.value }))}
                className="w-full border border-ink/15 rounded-lg px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-rust"
              />
              <span className="text-ink/40 text-sm">—</span>
              <label htmlFor="f-max" className="sr-only">Maximum price</label>
              <input
                id="f-max" type="number" min="0" placeholder="Max" value={filters.maxPrice}
                onChange={(e) => setFilters((f) => ({ ...f, maxPrice: e.target.value }))}
                className="w-full border border-ink/15 rounded-lg px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-rust"
              />
            </div>
          </div>

          <div>
            <p className="font-display text-sm text-ink mb-2">Room type</p>
            <AmenityChips
              options={ROOM_TYPES}
              selected={filters.roomTypes}
              onToggle={(item) => toggleFrom("roomTypes", item)}
            />
          </div>

          {amenityOptions.hostelAmenities?.length > 0 && (
            <div>
              <p className="font-display text-sm text-ink mb-2">Hostel amenities</p>
              <AmenityChips
                options={amenityOptions.hostelAmenities}
                selected={filters.hostelAmenities}
                onToggle={(item) => toggleFrom("hostelAmenities", item)}
              />
            </div>
          )}

          {amenityOptions.roomAmenities?.length > 0 && (
            <div>
              <p className="font-display text-sm text-ink mb-2">Room amenities</p>
              <AmenityChips
                options={amenityOptions.roomAmenities}
                selected={filters.roomAmenities}
                onToggle={(item) => toggleFrom("roomAmenities", item)}
              />
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-6 sticky bottom-0 bg-paper pt-3">
          <button
            type="button"
            onClick={clearAll}
            className="flex-1 border border-rust/40 text-rust rounded-full py-2.5 text-sm font-medium hover:bg-rust/5 outline-none focus-visible:ring-2 focus-visible:ring-rust"
          >
            Clear selections
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-ink text-paper rounded-full py-2.5 text-sm font-medium hover:bg-rust outline-none focus-visible:ring-2 focus-visible:ring-rust"
          >
            Show results
          </button>
        </div>
      </div>
    </div>
  );
}
