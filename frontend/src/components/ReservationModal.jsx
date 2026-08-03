import { useState, useEffect } from "react";
import { X, Check } from "lucide-react";
import { api } from "../api/client.js";

const cedis = (n) => `₵${Number(n).toLocaleString()}`;

/**
 * Flow: hold the bed (15-min lock) -> initialize a Paystack transaction ->
 * redirect the student to Paystack's hosted checkout -> on return, verify
 * server-side -> show confirmation. Paystack's authorization_url does the
 * actual card/mobile-money collection, so this modal never touches card data.
 */
export default function ReservationModal({ room, bed, onClose, onBooked }) {
  const [stage, setStage] = useState("loading"); // loading | review | redirecting | error
  const [hold, setHold] = useState(null);
  const [amount, setAmount] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.holdBed(bed.id)
      .then((data) => { setHold(data); setAmount(data.minDeposit); setStage("review"); })
      .catch((e) => { setError(e.message); setStage("error"); });
  }, [bed.id]);

  // Mirrors the backend's gross-up formula exactly (see paystack.js) — this
  // is only a live preview; the server recalculates and validates the real
  // amount independently before ever charging anything.
  const subtotal = hold ? amount + hold.serviceFee : 0;
  const paystackFee = hold
    ? Math.round(((subtotal * hold.paystackFeeRate) / (1 - hold.paystackFeeRate)) * 100) / 100
    : 0;
  const totalDue = subtotal + paystackFee;

  async function startPayment() {
    setStage("redirecting");
    try {
      const payment = await api.initializePayment({
        bedId: bed.id,
        reference: hold.reference,
        payAmount: amount,
        subaccountCode: hold.subaccountCode,
      });
      // Paystack redirects to /payment-callback (see bookings.js for the
      // callback_url construction), which is what actually calls
      // /payments/verify and creates the booking.
      window.location.href = payment.authorization_url;
    } catch (e) {
      setError(e.message);
      setStage("error");
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-paper rounded-2xl max-w-md w-full p-6 relative border border-ink/10 shadow-2xl">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute top-4 right-4 text-ink/40 hover:text-ink outline-none focus-visible:ring-2 focus-visible:ring-rust rounded p-1">
          <X size={20} />
        </button>

        {stage === "loading" && <p className="py-16 text-center text-ink/50">Holding your bed…</p>}

        {stage === "error" && (
          <div className="py-10 text-center">
            <p className="text-rust font-medium mb-2">Couldn't reserve this bed</p>
            <p className="text-sm text-ink/60">{error}</p>
          </div>
        )}

        {stage === "review" && hold && (
          <>
            <p className="font-mono text-[11px] uppercase tracking-wide text-ink/50 mb-1">
              Reserve room {hold.roomCode}
            </p>
            <h3 className="font-display text-2xl text-ink mb-4">{hold.hostelName}</h3>

            <div className="mb-4">
              <label htmlFor="pay-amount" className="text-xs text-ink/50 flex justify-between mb-1">
                <span>How much do you want to pay now?</span>
                <span aria-live="polite" className="font-mono text-ink">{cedis(amount)}</span>
              </label>
              <input
                id="pay-amount"
                type="range"
                min={hold.minDeposit}
                max={hold.pricePerYear}
                step="10"
                value={amount}
                aria-valuetext={`${cedis(amount)} of ${cedis(hold.pricePerYear)}`}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full outline-none focus-visible:ring-2 focus-visible:ring-rust"
              />
              <div className="flex justify-between text-[11px] text-ink/40 mt-1">
                <span>Min {cedis(hold.minDeposit)}</span>
                <span>Full year {cedis(hold.pricePerYear)}</span>
              </div>
            </div>

            <div className="rounded-lg border border-ink/10 divide-y divide-ink/10 mb-4 font-mono text-sm">
              <Row label="Room (full year)" value={cedis(hold.pricePerYear)} />
              <Row label="Paying now" value={cedis(amount)} tone="text-forest" />
              <Row label="Balance — due before move-in" value={cedis(hold.pricePerYear - amount)} />
              <Row label="Brigab service fee" value={cedis(hold.serviceFee)} />
              <Row label={`Payment processing fee (${(hold.paystackFeeRate * 100).toFixed(2)}%)`} value={cedis(paystackFee)} />
              <Row label="Total due today" value={cedis(totalDue)} bold />
            </div>

            <p className="text-xs text-ink/50 leading-relaxed mb-5">
              Paying more now means less owed later — but this hostel requires at least{" "}
              {cedis(hold.minDeposit)} to hold the room. The service fee and processing fee are
              non-refundable. This hold lasts 15 minutes — complete payment before then or the
              bed returns to the pool.
            </p>

            <button
              onClick={startPayment}
              className="w-full bg-ink text-paper rounded-full py-3 font-medium hover:bg-rust transition-colors outline-none focus-visible:ring-2 focus-visible:ring-rust focus-visible:ring-offset-2"
            >
              Pay {cedis(totalDue)} with Paystack
            </button>
          </>
        )}

        {stage === "redirecting" && (
          <div className="py-16 flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-ink/20 border-t-ink rounded-full animate-spin" />
            <p className="text-sm text-ink/50">Redirecting to Paystack…</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, tone = "", bold = false }) {
  return (
    <div className={`flex justify-between px-4 py-2.5 ${bold ? "bg-ink/[0.03] font-semibold" : ""}`}>
      <span className="text-ink/60">{label}</span>
      <span className={tone}>{value}</span>
    </div>
  );
}
