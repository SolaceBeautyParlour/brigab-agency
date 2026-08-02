import { useState, useRef } from "react";
import { Image as ImageIcon, Video, Plus, X, Loader2 } from "lucide-react";
import { api } from "../api/client.js";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 45;
const MAX_ITEMS = 8;

function getVideoDuration(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error("Couldn't read this video file."));
    };
    video.src = URL.createObjectURL(file);
  });
}

/**
 * Shared by RoomMedia (per-room photos) and the hostel's own cover photo —
 * same upload limits, same validation, same UI. Only the upload function
 * and alt-text label differ between the two callers.
 */
export default function MediaGallery({ initialItems, managerMode, uploadFn, altLabel, onChanged }) {
  const [items, setItems] = useState(initialItems || []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError("");
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (!isImage && !isVideo) {
      setError("Only photos and video clips are supported.");
      return;
    }
    if (isImage && file.size > MAX_IMAGE_BYTES) {
      setError(`That photo is too big — keep it under ${MAX_IMAGE_BYTES / 1024 / 1024}MB.`);
      return;
    }
    if (isVideo) {
      if (file.size > MAX_VIDEO_BYTES) {
        setError(`That clip is too big — keep it under ${MAX_VIDEO_BYTES / 1024 / 1024}MB.`);
        return;
      }
      try {
        const duration = await getVideoDuration(file);
        if (duration > MAX_VIDEO_SECONDS) {
          setError(`Keep clips under ${MAX_VIDEO_SECONDS} seconds — this one is ${Math.round(duration)}s.`);
          return;
        }
      } catch {
        setError("Couldn't read this video file — try a different one.");
        return;
      }
    }

    setBusy(true);
    try {
      const created = await uploadFn(file);
      const next = [...items, created];
      setItems(next);
      onChanged?.(next);
    } catch (err) {
      setError(err.message || "Upload failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(mediaId) {
    try {
      await api.deleteMedia(mediaId);
      const next = items.filter((m) => m.id !== mediaId);
      setItems(next);
      onChanged?.(next);
    } catch (err) {
      setError(err.message || "Couldn't delete this.");
    }
  }

  if (!managerMode && items.length === 0) return null;

  return (
    <div className="mt-2">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {items.map((m) => (
          <div key={m.id} className="relative shrink-0 w-16 h-16 rounded-md overflow-hidden bg-ink/5 border border-ink/10">
            {m.resource_type === "video" ? (
              <video src={m.url} className="w-full h-full object-cover" muted playsInline />
            ) : (
              <img src={m.url} alt={altLabel} className="w-full h-full object-cover" />
            )}
            <span className="absolute bottom-0.5 left-0.5 bg-ink/60 rounded p-0.5" aria-hidden="true">
              {m.resource_type === "video" ? <Video size={10} className="text-paper" /> : <ImageIcon size={10} className="text-paper" />}
            </span>
            {managerMode && (
              <button
                type="button"
                onClick={() => handleDelete(m.id)}
                aria-label="Delete this photo/clip"
                className="absolute top-0.5 right-0.5 bg-ink/70 hover:bg-rust text-paper rounded-full p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-rust"
              >
                <X size={10} />
              </button>
            )}
          </div>
        ))}

        {managerMode && items.length < MAX_ITEMS && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            aria-label="Add a photo or short clip"
            className="shrink-0 w-16 h-16 rounded-md border border-dashed border-ink/20 flex items-center justify-center text-ink/40 hover:text-rust hover:border-rust/40 outline-none focus-visible:ring-2 focus-visible:ring-rust disabled:opacity-50"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/mp4,video/quicktime,video/webm"
        onChange={handleFile}
        className="sr-only"
      />
      {managerMode && (
        <p className="text-[11px] text-ink/40 mt-1">
          Up to {MAX_ITEMS} photos or clips under {MAX_VIDEO_SECONDS}s. Compressed automatically on upload.
        </p>
      )}
      {error && <p role="alert" className="text-rust text-xs mt-1">{error}</p>}
    </div>
  );
}
