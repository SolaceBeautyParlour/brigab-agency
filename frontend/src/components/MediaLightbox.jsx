import { useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Full-screen viewer for a gallery's photos/clips. Shared by every place
 * MediaGallery is used — hostel cover photos, room photos, both manager and
 * student views — so clicking a thumbnail always behaves the same way
 * everywhere in the app.
 */
export default function MediaLightbox({ items, index, onClose, onNavigate, altLabel }) {
  const current = items[index];

  const goNext = useCallback(() => {
    onNavigate((index + 1) % items.length);
  }, [index, items.length, onNavigate]);

  const goPrev = useCallback(() => {
    onNavigate((index - 1 + items.length) % items.length);
  }, [index, items.length, onNavigate]);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && items.length > 1) goNext();
      if (e.key === "ArrowLeft" && items.length > 1) goPrev();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, goNext, goPrev, items.length]);

  if (!current) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${altLabel} — viewer`}
      className="fixed inset-0 bg-ink/90 z-[100] flex items-center justify-center"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close viewer"
        className="absolute top-4 right-4 text-paper/70 hover:text-paper outline-none focus-visible:ring-2 focus-visible:ring-paper rounded-full p-2 z-10"
      >
        <X size={24} />
      </button>

      {items.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            aria-label="Previous"
            className="absolute left-2 sm:left-6 text-paper/70 hover:text-paper outline-none focus-visible:ring-2 focus-visible:ring-paper rounded-full p-2 z-10"
          >
            <ChevronLeft size={28} />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            aria-label="Next"
            className="absolute right-2 sm:right-6 text-paper/70 hover:text-paper outline-none focus-visible:ring-2 focus-visible:ring-paper rounded-full p-2 z-10"
          >
            <ChevronRight size={28} />
          </button>
        </>
      )}

      <div className="max-w-4xl max-h-[85vh] w-full px-4" onClick={(e) => e.stopPropagation()}>
        {current.resource_type === "video" ? (
          <video
            key={current.id}
            src={current.url}
            className="w-full max-h-[85vh] rounded-lg"
            controls
            autoPlay
            muted
            playsInline
          />
        ) : (
          <img
            key={current.id}
            src={current.url}
            alt={altLabel}
            className="w-full max-h-[85vh] object-contain rounded-lg mx-auto"
          />
        )}
      </div>

      {items.length > 1 && (
        <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-paper/60 text-xs font-mono">
          {index + 1} / {items.length}
        </p>
      )}
    </div>
  );
}
