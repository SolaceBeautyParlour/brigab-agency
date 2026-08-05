import { Loader2 } from "lucide-react";

/**
 * A real progress bar would be misleading here — we don't know how far
 * along a JSON fetch is, so faking a percentage would be worse than not
 * showing one. This is the honest version: a clear "something is happening"
 * spinner instead of the page just sitting there blank.
 */
export default function LoadingState({ message = "Loading…", fullPage = false }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 text-ink/50 ${fullPage ? "min-h-[50vh]" : "py-16"}`}>
      <Loader2 className="animate-spin" size={28} />
      <p className="text-sm">{message}</p>
    </div>
  );
}
