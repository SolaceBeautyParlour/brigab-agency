import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Search, MapPin, Loader2 } from "lucide-react";
import { api } from "../api/client.js";

// Leaflet's default marker icon paths break under Vite's bundler (it can't
// resolve the relative image URLs baked into the leaflet package) — this
// points them at the same version's files on a CDN instead, which sidesteps
// the bundling issue entirely rather than fighting Vite's asset pipeline.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// KNUST's rough center — used only to center the map on first load, before
// a manager has placed anything. Not treated as an actual landmark location.
const KNUST_CENTER = { lat: 6.6746, lng: -1.5716 };

/**
 * Click-to-place-pin map, backed by OpenStreetMap tiles (free, no API key,
 * ever) — the search box is the only part that costs anything (a
 * geocoding call proxied through our own backend), and only fires when the
 * manager actually types a search, not on every render.
 */
export default function MapPicker({ initialLat, initialLng, onSave }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markerRef = useRef(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [position, setPosition] = useState(
    initialLat && initialLng ? { lat: initialLat, lng: initialLng } : null
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const start = position || KNUST_CENTER;
    const map = L.map(mapRef.current).setView([start.lat, start.lng], position ? 16 : 14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    if (position) {
      markerRef.current = L.marker([position.lat, position.lng], { draggable: true }).addTo(map);
      markerRef.current.on("dragend", (e) => {
        const { lat, lng } = e.target.getLatLng();
        setPosition({ lat, lng });
        setSaved(false);
      });
    }

    map.on("click", (e) => {
      const { lat, lng } = e.latlng;
      setPosition({ lat, lng });
      setSaved(false);
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(map);
        markerRef.current.on("dragend", (evt) => {
          const p = evt.target.getLatLng();
          setPosition({ lat: p.lat, lng: p.lng });
          setSaved(false);
        });
      }
    });

    mapInstance.current = map;
    return () => map.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSearch(e) {
    e.preventDefault();
    if (query.trim().length < 3) return;
    setSearching(true);
    setError("");
    try {
      const found = await api.geocodeSearch(query);
      setResults(found);
    } catch (err) {
      setError(err.message || "Search failed.");
    } finally {
      setSearching(false);
    }
  }

  function selectResult(r) {
    setPosition({ lat: r.latitude, lng: r.longitude });
    setResults([]);
    setQuery(r.label);
    setSaved(false);
    mapInstance.current.setView([r.latitude, r.longitude], 16);
    if (markerRef.current) {
      markerRef.current.setLatLng([r.latitude, r.longitude]);
    } else {
      markerRef.current = L.marker([r.latitude, r.longitude], { draggable: true }).addTo(mapInstance.current);
    }
  }

  async function handleSave() {
    if (!position) return;
    setSaving(true);
    setError("");
    try {
      const { warnings } = await onSave(position.lat, position.lng);
      setSaved(true);
      if (warnings?.length) {
        setError(`Saved, but couldn't get distance to: ${warnings.map((w) => w.split(":")[0]).join(", ")}.`);
      }
    } catch (err) {
      setError(err.message || "Couldn't save this location.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleSearch} className="flex gap-2 mb-2">
        <div className="flex-1 flex items-center gap-2 bg-white border border-ink/15 rounded-lg px-3 py-2">
          <Search size={14} className="text-ink/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search an address near your hostel"
            className="flex-1 text-sm outline-none bg-transparent"
          />
        </div>
        <button
          type="submit"
          disabled={searching}
          className="bg-ink text-paper rounded-lg px-3 py-2 text-sm font-medium hover:bg-rust disabled:opacity-50"
        >
          {searching ? <Loader2 size={14} className="animate-spin" /> : "Search"}
        </button>
      </form>

      {results.length > 0 && (
        <div className="border border-ink/10 rounded-lg mb-2 divide-y divide-ink/10 bg-white">
          {results.map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={() => selectResult(r)}
              className="w-full text-left px-3 py-2 text-xs text-ink/70 hover:bg-ink/5"
            >
              {r.label}
            </button>
          ))}
        </div>
      )}

      <div ref={mapRef} className="w-full h-64 rounded-lg border border-ink/10 mb-2" />

      <p className="text-[11px] text-ink/40 mb-2">
        Click anywhere on the map to drop a pin, or drag it to fine-tune. Search above to jump to an address first.
      </p>

      {error && <p role="alert" className="text-rust text-xs mb-2">{error}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={!position || saving}
        className="flex items-center gap-1.5 bg-ink text-paper rounded-full px-4 py-2 text-sm font-medium hover:bg-rust disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-rust"
      >
        <MapPin size={14} />
        {saving ? "Calculating distances…" : saved ? "Saved ✓" : "Save location"}
      </button>
    </div>
  );
}
