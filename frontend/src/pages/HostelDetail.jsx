import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, MapPin, ShieldCheck, LayoutGrid, BedDouble } from "lucide-react";
import { api, sessionAuth } from "../api/client.js";
import BedGrid from "../components/BedGrid.jsx";
import ReservationModal from "../components/ReservationModal.jsx";
import LoadingState from "../components/LoadingState.jsx";
import MediaGallery from "../components/MediaGallery.jsx";

export default function HostelDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [hostel, setHostel] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [reserving, setReserving] = useState(null); // { room, bed }
  const [waitlistNotice, setWaitlistNotice] = useState(null);

  function load() {
    setLoadError("");
    setHostel(null);
    api.getHostel(id)
      .then(setHostel)
      .catch((err) => setLoadError(err.message || "Couldn't load this hostel."));
  }

  useEffect(load, [id]);

  async function handleSelectRoom(room, isFull) {
    if (!sessionAuth.token) {
      navigate("/login", { state: { redirectTo: `/hostels/${id}` } });
      return;
    }
    if (isFull) {
      await api.joinWaitlist(room.id);
      setWaitlistNotice(`You're on the waitlist for ${room.room_code}. We'll text you the moment a bed frees up.`);
      return;
    }
    const openBed = room.beds.find((b) => b.status === "available");
    setReserving({ room, bed: openBed });
  }

  if (loadError) {
    return (
      <div className="px-6 sm:px-10 py-16 text-center">
        <p className="text-sm text-ink/60 mb-4">{loadError}</p>
        <button
          onClick={load}
          className="bg-ink text-paper rounded-full px-5 py-2 text-sm font-medium hover:bg-rust"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!hostel) return <LoadingState message="Loading hostel…" fullPage />;

  const openBeds = hostel.rooms.reduce(
    (n, r) => n + r.beds.filter((b) => b.status === "available").length,
    0
  );

  return (
    <div>
      <div className="px-6 sm:px-10 pt-6">
        <Link to="/" className="flex items-center gap-1.5 text-sm text-ink/50 hover:text-ink mb-6">
          <ArrowLeft size={15} /> Back to browse
        </Link>
      </div>

      <div className="px-6 sm:px-10 pb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="font-display text-3xl text-ink">{hostel.name}</h2>
            {hostel.verified && <ShieldCheck size={20} className="text-forest" />}
          </div>
          <p className="text-sm text-ink/50 flex items-center gap-1"><MapPin size={13} /> {hostel.area}</p>
          {hostel.landmark_distances && Object.keys(hostel.landmark_distances).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {Object.entries(hostel.landmark_distances)
                .sort((a, b) => a[1].minutes - b[1].minutes)
                .map(([name, d]) => (
                  <span key={name} className="text-xs px-2.5 py-1 rounded-full bg-forest/10 text-forest">
                    {d.minutes} min walk to {name}
                  </span>
                ))}
            </div>
          )}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(hostel.includes || []).map((i) => (
            <span key={i} className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-mono uppercase bg-ink/[0.06] text-ink/70">
              {i}
            </span>
          ))}
        </div>
      </div>

      {hostel.media && hostel.media.length > 0 && (
        <div className="px-6 sm:px-10 mb-4">
          <MediaGallery initialItems={hostel.media} managerMode={false} altLabel={`${hostel.name} photo`} />
        </div>
      )}

      {hostel.additional_info && (
        <div className="px-6 sm:px-10 mb-4">
          <div className="border border-ink/10 rounded-lg p-4 bg-white/60">
            <p className="font-mono text-[11px] uppercase tracking-wide text-ink/50 mb-1.5">Good to know</p>
            <p className="text-sm text-ink/70 whitespace-pre-wrap">{hostel.additional_info}</p>
          </div>
        </div>
      )}

      {waitlistNotice && (
        <div className="px-6 sm:px-10">
          <p className="bg-gold/10 text-[#7a5c14] text-sm rounded-lg px-4 py-3 mb-4">{waitlistNotice}</p>
        </div>
      )}

      <div className="px-6 sm:px-10 pb-10 grid lg:grid-cols-[1fr_280px] gap-8 mt-2">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <LayoutGrid size={16} className="text-rust" />
            <h3 className="font-mono text-xs uppercase tracking-wide text-ink/60">
              Live floor plan — {openBeds} beds open
            </h3>
          </div>
          <BedGrid rooms={hostel.rooms} onSelectRoom={handleSelectRoom} />
          <div className="flex items-center gap-4 mt-4 text-xs text-ink/50">
            <span className="flex items-center gap-1.5"><BedDouble size={13} className="text-forest" /> Available</span>
            <span className="flex items-center gap-1.5"><BedDouble size={13} className="text-ink/25" /> Taken</span>
          </div>
        </div>

        <aside className="border border-ink/10 rounded-xl p-5 bg-white/60 h-fit">
          <h4 className="font-mono text-xs uppercase tracking-wide text-ink/50 mb-3">Deposit policy</h4>
          <p className="text-sm text-ink/60 leading-relaxed">
            {Math.round(hostel.deposit_pct * 100)}% deposit due to reserve, balance due before
            move-in. A ₵50 non-refundable service fee applies at checkout.
          </p>
        </aside>
      </div>

      {reserving && (
        <ReservationModal
          room={reserving.room}
          bed={reserving.bed}
          onClose={() => setReserving(null)}
          onBooked={() => navigate("/dashboard")}
        />
      )}
    </div>
  );
}
