import { useEffect, useState } from "react";
import { Receipt, Check, CalendarClock } from "lucide-react";
import { api } from "../api/client.js";
import LoadingState from "../components/LoadingState.jsx";

const cedis = (n) => `₵${Number(n).toLocaleString()}`;

export default function Dashboard() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [payingId, setPayingId] = useState(null);
  const [payError, setPayError] = useState("");

  function load() {
    setLoading(true);
    setLoadError("");
    api.myBookings()
      .then(setBookings)
      .catch((err) => setLoadError(err.message || "Couldn't load your bookings."))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function payBalance(bookingId) {
    setPayingId(bookingId);
    setPayError("");
    try {
      const payment = await api.initializeBalancePayment(bookingId);
      window.location.href = payment.authorization_url;
    } catch (err) {
      setPayError(err.message || "Couldn't start payment. Try again.");
      setPayingId(null);
    }
  }

  if (loading) return <LoadingState message="Loading your bookings…" fullPage />;

  if (loadError) {
    return (
      <div className="px-6 sm:px-10 py-16 text-center">
        <p className="text-sm text-ink/60 mb-4">{loadError}</p>
        <button onClick={load} className="bg-ink text-paper rounded-full px-5 py-2 text-sm font-medium hover:bg-rust">
          Try again
        </button>
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="px-6 sm:px-10 py-16 text-center">
        <Receipt size={28} className="text-ink/20 mx-auto mb-3" />
        <p className="text-ink/50">Nothing here yet. Reserve a room to see it appear.</p>
      </div>
    );
  }

  return (
    <div className="px-6 sm:px-10 py-8 max-w-2xl">
      <h2 className="font-display text-2xl text-ink mb-6">Your bookings</h2>
      <div className="space-y-4">
        {bookings.map((b) => (
          <div key={b.id} className="border border-ink/10 rounded-xl p-5 bg-white/60">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-lg text-ink">{b.hostel_name} — {b.room_code}</h3>
              <StatusPill status={b.status} />
            </div>
            <div className="grid grid-cols-2 gap-3 font-mono text-sm text-ink/70">
              <div><p className="text-xs text-ink/40">Deposit paid</p>{cedis(b.deposit_amount)}</div>
              <div><p className="text-xs text-ink/40">Balance remaining</p>{cedis(b.balance_amount)}</div>
            </div>
            {b.status === "deposit_paid" && Number(b.balance_amount) > 0 && (
              <>
                <div className="flex items-center gap-1.5 mt-3 text-xs text-ink/50">
                  <CalendarClock size={13} /> Balance due {new Date(b.balance_due_date).toDateString()}
                </div>
                <button
                  onClick={() => payBalance(b.id)}
                  disabled={payingId === b.id}
                  className="mt-3 text-sm font-medium bg-ink text-paper px-4 py-2 rounded-full hover:bg-rust disabled:opacity-50"
                >
                  {payingId === b.id ? "Redirecting…" : `Pay remaining ${cedis(b.balance_amount)}`}
                </button>
                {payError && payingId === b.id && (
                  <p role="alert" className="text-rust text-xs mt-2">{payError}</p>
                )}
              </>
            )}
            {b.status === "deposit_paid" && Number(b.balance_amount) <= 0 && (
              <p className="text-xs text-forest mt-3">Fully paid — nothing left owed on this booking.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    deposit_paid: { label: "Deposit paid", tone: "bg-gold/15 text-[#7a5c14]" },
    balance_paid: { label: "Fully paid", tone: "bg-forest/10 text-forest" },
    forfeited: { label: "Forfeited", tone: "bg-rust/10 text-rust" },
  };
  const s = map[status] || { label: status, tone: "bg-ink/[0.06] text-ink/60" };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-mono uppercase tracking-wide ${s.tone}`}>
      {status === "balance_paid" && <Check size={11} />} {s.label}
    </span>
  );
}
