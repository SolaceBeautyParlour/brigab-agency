import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { api } from "../api/client.js";

/**
 * Paystack redirects here after checkout. Nothing about the booking exists
 * yet at this point — this is the ONLY place that calls /payments/verify,
 * which is what actually creates the booking row, marks the bed taken, and
 * triggers the SMS/email receipts. Without this page, a student could pay
 * successfully on Paystack's own page and the booking would simply never
 * happen on our end.
 */
export default function PaymentCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("verifying"); // verifying | success | error
  const [error, setError] = useState("");
  const isBalancePayment = params.get("type") === "balance";

  useEffect(() => {
    const reference = params.get("reference") || params.get("trxref");

    if (isBalancePayment) {
      const bookingId = params.get("bookingId");
      if (!bookingId || !reference) {
        setStatus("error");
        setError("Missing payment reference. If you completed payment, contact support with your reference number.");
        return;
      }
      api.verifyBalancePayment({ bookingId, reference })
        .then(() => setStatus("success"))
        .catch((err) => {
          setStatus("error");
          setError(err.message || "Couldn't confirm your payment. If money left your account, contact support.");
        });
      return;
    }

    const bedId = params.get("bedId");
    if (!bedId || !reference) {
      setStatus("error");
      setError("Missing payment reference. If you completed payment, contact support with your reference number.");
      return;
    }

    api.verifyPayment({ bedId, reference })
      .then(() => setStatus("success"))
      .catch((err) => {
        setStatus("error");
        setError(err.message || "Couldn't confirm your payment. If money left your account, contact support.");
      });
  }, [params, isBalancePayment]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center">
        {status === "verifying" && (
          <>
            <Loader2 className="animate-spin text-ink/40 mx-auto mb-4" size={32} />
            <h1 className="font-display text-xl text-ink mb-2">Confirming your payment…</h1>
            <p className="text-sm text-ink/50">Don't close this page — this only takes a moment.</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle2 className="text-forest mx-auto mb-4" size={40} />
            <h1 className="font-display text-xl text-ink mb-2">
              {isBalancePayment ? "Balance paid in full" : "Room secured"}
            </h1>
            <p className="text-sm text-ink/60 mb-6">
              A receipt has been sent by SMS and email.{" "}
              {isBalancePayment ? "Your booking is now fully settled." : "Your booking is now in your dashboard."}
            </p>
            <button
              onClick={() => navigate("/dashboard")}
              className="bg-ink text-paper rounded-full px-6 py-2.5 text-sm font-medium hover:bg-rust outline-none focus-visible:ring-2 focus-visible:ring-rust"
            >
              Go to my dashboard
            </button>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="text-rust mx-auto mb-4" size={40} />
            <h1 className="font-display text-xl text-ink mb-2">Something went wrong</h1>
            <p className="text-sm text-ink/60 mb-6">{error}</p>
            <Link
              to="/dashboard"
              className="inline-block bg-ink text-paper rounded-full px-6 py-2.5 text-sm font-medium hover:bg-rust"
            >
              Go to my dashboard
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
