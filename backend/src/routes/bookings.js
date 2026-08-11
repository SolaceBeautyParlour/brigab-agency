import express from "express";
import crypto from "crypto";
import { query } from "../db/pool.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { initializeSplitTransaction, PAYSTACK_FEE_RATE, calculatePaystackFee } from "../services/paystack.js";

const router = express.Router();
const SERVICE_FEE = 50;
const HOLD_MINUTES = 15;
const GRACE_DAYS = 4;

/**
 * Step 1: place a 15-minute hold on a bed and return the Paystack payment
 * breakdown. The bed is NOT marked "taken" yet — only "reserved_pending" —
 * so it releases automatically if payment isn't completed.
 */
router.post("/hold", requireAuth, requireRole("student"), async (req, res) => {
  const { bedId } = req.body;

  const bedResult = await query(
    `SELECT b.*, r.price_per_year, r.room_code, r.hostel_id, h.deposit_pct, h.name AS hostel_name,
            h.paystack_subaccount_code, h.gender_policy
     FROM beds b
     JOIN rooms r ON r.id = b.room_id
     JOIN hostels h ON h.id = r.hostel_id
     WHERE b.id = $1`,
    [bedId]
  );
  const bed = bedResult.rows[0];

  if (!bed) return res.status(404).json({ error: "Bed not found" });
  if (bed.status !== "available") {
    return res.status(409).json({ error: "This bed is no longer available. It may already be held or taken." });
  }
  if (!bed.paystack_subaccount_code) {
    return res.status(422).json({ error: "This hostel hasn't finished payment setup yet — the manager needs to connect their Paystack account." });
  }

  const student = (await query("SELECT gender FROM users WHERE id = $1", [req.user.id])).rows[0];

  // Hostel-level policy: a male-only or female-only hostel shouldn't let the
  // other gender book at all, regardless of which specific room/bed.
  if (bed.gender_policy !== "mixed" && bed.gender_policy !== student.gender) {
    return res.status(403).json({ error: `This hostel is for ${bed.gender_policy} students only.` });
  }

  // Room-level: even inside a "mixed" hostel, an individual room shouldn't
  // end up with both genders in it. Checks against anyone already booked
  // AND anyone actively mid-checkout (held_by) in the same room right now.
  const roommates = await query(
    `SELECT DISTINCT u.gender
     FROM beds b2
     LEFT JOIN bookings bk ON bk.bed_id = b2.id AND bk.status NOT IN ('forfeited', 'cancelled')
     LEFT JOIN users u ON u.id = COALESCE(bk.student_id, b2.held_by)
     WHERE b2.room_id = $1 AND b2.id != $2
       AND (b2.status = 'taken' OR (b2.status = 'reserved_pending' AND b2.hold_expires_at > now()))
       AND u.gender IS NOT NULL`,
    [bed.room_id, bed.id]
  );
  const clashingGender = roommates.rows.find((r) => r.gender !== student.gender);
  if (clashingGender) {
    return res.status(409).json({ error: "This room already has a student of a different gender. Rooms can't mix genders." });
  }

  const holdExpires = new Date(Date.now() + HOLD_MINUTES * 60 * 1000);
  await query(
    "UPDATE beds SET status = 'reserved_pending', hold_expires_at = $1, held_by = $2 WHERE id = $3",
    [holdExpires, req.user.id, bed.id]
  );

  const minDeposit = Number(bed.price_per_year) * Number(bed.deposit_pct);
  const reference = `BRG-${crypto.randomBytes(6).toString("hex")}`;

  res.json({
    bedId: bed.id,
    roomCode: bed.room_code,
    hostelName: bed.hostel_name,
    pricePerYear: Number(bed.price_per_year),
    minDeposit,
    serviceFee: SERVICE_FEE,
    paystackFeeRate: PAYSTACK_FEE_RATE,
    holdExpiresAt: holdExpires,
    reference,
    subaccountCode: bed.paystack_subaccount_code,
  });
});

/**
 * Step 2: initialize the actual Paystack transaction for the held bed.
 * Students can pay any amount from the hostel's minimum deposit up to the
 * full room price — more paid now means less owed later. Whatever amount
 * the client sends is only a suggestion; it's re-validated here against
 * the bed's real price and deposit percentage before Paystack ever sees it.
 */
router.post("/initialize-payment", requireAuth, requireRole("student"), async (req, res) => {
  const { bedId, reference, payAmount, subaccountCode } = req.body;

  const bedResult = await query(
    `SELECT b.status, b.hold_expires_at, r.price_per_year, h.deposit_pct
     FROM beds b JOIN rooms r ON r.id = b.room_id JOIN hostels h ON h.id = r.hostel_id
     WHERE b.id = $1`,
    [bedId]
  );
  const bed = bedResult.rows[0];
  if (!bed || bed.status !== "reserved_pending" || new Date(bed.hold_expires_at) < new Date()) {
    return res.status(409).json({ error: "Your hold has expired. Please reserve the bed again." });
  }

  const pricePerYear = Number(bed.price_per_year);
  const minDeposit = pricePerYear * Number(bed.deposit_pct);
  const amount = Number(payAmount);

  if (!Number.isFinite(amount) || amount < minDeposit - 0.01 || amount > pricePerYear + 0.01) {
    return res.status(422).json({
      error: `Payment amount must be between ${minDeposit.toFixed(2)} and ${pricePerYear.toFixed(2)} GHS.`,
    });
  }

  const subtotal = amount + SERVICE_FEE;
  const paystackFee = calculatePaystackFee(subtotal);
  const total = subtotal + paystackFee;
  const student = (await query("SELECT email FROM users WHERE id = $1", [req.user.id])).rows[0];

  // Paystack appends its own ?reference=...&trxref=... to whatever we send
  // here, so bedId travels through as our own query param alongside those —
  // without this, the frontend has no way to know which bed to verify
  // against once the student lands back from Paystack's checkout page.
  const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:5173").split(",")[0];
  const callbackUrl = `${frontendUrl}/payment-callback?bedId=${bedId}`;

  const paystackData = await initializeSplitTransaction({
    email: student.email,
    amountGHS: total,
    depositGHS: amount,
    subaccountCode,
    reference,
    metadata: { bedId, studentId: req.user.id },
    callbackUrl,
  });

  res.json(paystackData); // contains authorization_url for the student to complete payment
});

/**
 * Initialize payment for the REMAINING balance on an existing booking — not
 * a new deposit. No new Brigab service fee here (that was already charged
 * at deposit time); this is a pure pass-through to the manager, with only
 * Paystack's own processing fee added transparently, same gross-up logic
 * as the deposit flow.
 */
router.post("/initialize-balance-payment", requireAuth, requireRole("student"), async (req, res) => {
  const { bookingId } = req.body;

  const bookingResult = await query(
    `SELECT bo.*, h.paystack_subaccount_code
     FROM bookings bo
     JOIN beds be ON be.id = bo.bed_id
     JOIN rooms r ON r.id = be.room_id
     JOIN hostels h ON h.id = r.hostel_id
     WHERE bo.id = $1 AND bo.student_id = $2`,
    [bookingId, req.user.id]
  );
  const booking = bookingResult.rows[0];
  if (!booking) return res.status(404).json({ error: "Booking not found" });
  if (booking.status !== "deposit_paid") {
    return res.status(409).json({ error: "This booking isn't awaiting a balance payment." });
  }

  const balanceOwed = Number(booking.balance_amount);
  if (balanceOwed <= 0) {
    return res.status(409).json({ error: "There's no balance left to pay on this booking." });
  }
  const paystackFee = calculatePaystackFee(balanceOwed);
  const total = balanceOwed + paystackFee;

  const student = (await query("SELECT email FROM users WHERE id = $1", [req.user.id])).rows[0];
  const reference = `BRG-BAL-${crypto.randomBytes(6).toString("hex")}`;
  const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:5173").split(",")[0];
  const callbackUrl = `${frontendUrl}/payment-callback?bookingId=${bookingId}&type=balance`;

  const paystackData = await initializeSplitTransaction({
    email: student.email,
    amountGHS: total,
    depositGHS: balanceOwed, // the manager's subaccount gets the full balance, untouched
    subaccountCode: booking.paystack_subaccount_code,
    reference,
    metadata: { bookingId, studentId: req.user.id, type: "balance" },
    callbackUrl,
  });

  res.json(paystackData);
});

/**
 * Manually list bookings for the logged-in student's dashboard.
 * Actual booking creation happens in payments.js after Paystack verification.
 */
router.get("/mine", requireAuth, requireRole("student"), async (req, res) => {
  const result = await query(
    `SELECT bo.*, r.room_code, r.room_type, h.name AS hostel_name, h.area
     FROM bookings bo
     JOIN beds be ON be.id = bo.bed_id
     JOIN rooms r ON r.id = be.room_id
     JOIN hostels h ON h.id = r.hostel_id
     WHERE bo.student_id = $1
     ORDER BY bo.created_at DESC`,
    [req.user.id]
  );
  res.json(result.rows);
});

export { GRACE_DAYS, SERVICE_FEE };
export default router;
