import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, MapPin, ShieldCheck, ChevronRight, SlidersHorizontal } from "lucide-react";
import { api } from "../api/client.js";
import FilterPanel from "../components/FilterPanel.jsx";

const EMPTY_FILTERS = { minPrice: "", maxPrice: "", roomTypes: [], hostelAmenities: [], roomAmenities: [] };

export default function Browse() {
  const [hostels, setHostels] = useState([]);
  const [query, setQuery] = useState("");
  const [gender, setGender] = useState("any");
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [amenityOptions, setAmenityOptions] = useState({});

  useEffect(() => {
    api.amenityOptions()
      .then(setAmenityOptions)
      .catch((err) => console.error("Couldn't load amenity filters:", err.message));
  }, []);

  const activeFilterCount =
    (filters.minPrice ? 1 : 0) +
    (filters.maxPrice ? 1 : 0) +
    filters.roomTypes.length +
    filters.hostelAmenities.length +
    filters.roomAmenities.length;

  useEffect(() => {
    setLoading(true);
    api.browseHostels({ search: query, gender, ...filters })
      .then(setHostels)
      .finally(() => setLoading(false));
  }, [query, gender, filters]);

  return (
    <div>
      <section className="px-6 sm:px-10 pt-10 pb-8 border-b border-ink/10">
        <p className="font-mono text-[11px] uppercase tracking-widest text-rust mb-3">
          KNUST · Academic Year 2026/27
        </p>
        <h1 className="font-display text-3xl sm:text-4xl text-ink max-w-lg leading-[1.1] mb-4">
          Reserve your room before you set foot on campus.
        </h1>
        <p className="text-ink/60 max-w-md mb-6 leading-relaxed">
          Every bed below is live, not a listing someone forgot to update. Browse, pay a deposit,
          done — no hostel-to-hostel tours required.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 max-w-xl">
          <div className="flex-1 flex items-center gap-2 bg-white border border-ink/10 rounded-full px-4 py-2.5">
            <Search size={16} className="text-ink/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search hostel or area"
              className="flex-1 outline-none bg-transparent text-sm placeholder:text-ink/40"
            />
          </div>
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="bg-white border border-ink/10 rounded-full px-4 py-2.5 text-sm text-ink/70 outline-none"
          >
            <option value="any">Any gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
          <button
            type="button"
            onClick={() => setShowFilters(true)}
            className="flex items-center justify-center gap-1.5 bg-white border border-ink/10 rounded-full px-4 py-2.5 text-sm text-ink/70 hover:border-rust/40 outline-none focus-visible:ring-2 focus-visible:ring-rust relative"
          >
            <SlidersHorizontal size={15} /> Filters
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-rust text-paper text-[10px] rounded-full w-5 h-5 flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </section>

      <section className="px-6 sm:px-10 py-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {loading && <p className="text-ink/40 text-sm">Loading hostels…</p>}
        {!loading && hostels.length === 0 && (
          <p className="text-ink/40 text-sm">No hostels match that search yet.</p>
        )}
        {hostels.map((h) => (
          <Link
            key={h.id}
            to={`/hostels/${h.id}`}
            className="text-left border border-ink/10 rounded-xl bg-white/60 p-5 hover:border-rust/40 hover:-translate-y-0.5 transition-all group block"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-display text-lg text-ink">{h.name}</h3>
                <p className="text-xs text-ink/50 flex items-center gap-1 mt-0.5">
                  <MapPin size={12} /> {h.area}
                </p>
              </div>
              {h.verified && <ShieldCheck size={18} className="text-forest shrink-0" />}
            </div>

            <div className="flex gap-1.5 mb-4">
              <span className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-mono uppercase bg-ink/[0.06] text-ink/70">
                {h.gender_policy}
              </span>
              <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-mono uppercase ${
                Number(h.open_beds) > 0 ? "bg-forest/10 text-forest" : "bg-gold/15 text-[#7a5c14]"
              }`}>
                {Number(h.open_beds) > 0 ? `${h.open_beds} beds open` : "Full — waitlist"}
              </span>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-ink/10">
              <span className="font-mono text-sm text-ink">
                from ₵{Number(h.from_price || 0).toLocaleString()}<span className="text-ink/40">/yr</span>
              </span>
              <ChevronRight size={16} className="text-ink/30 group-hover:text-rust group-hover:translate-x-0.5 transition-all" />
            </div>
          </Link>
        ))}
      </section>

      {showFilters && (
        <FilterPanel
          filters={filters}
          setFilters={setFilters}
          amenityOptions={amenityOptions}
          onClose={() => setShowFilters(false)}
        />
      )}
    </div>
  );
}
