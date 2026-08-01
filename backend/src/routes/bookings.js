import express from "express";
import crypto from "crypto";
import { query } from "../db/pool.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { initializeSplitTransaction } from "../services/paystack.js";

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
            h.paystack_subaccount_code
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

  const holdExpires = new Date(Date.now() + HOLD_MINUTES * 60 * 1000);
  await query(
    "UPDATE beds SET status = 'reserved_pending', hold_expires_at = $1 WHERE id = $2",
    [holdExpires, bed.id]
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

  const total = amount + SERVICE_FEE;
  const student = (await query("SELECT email FROM users WHERE id = $1", [req.user.id])).rows[0];

  const paystackData = await initializeSplitTransaction({
    email: student.email,
    amountGHS: total,
    depositGHS: amount,
    subaccountCode,
    reference,
    metadata: { bedId, studentId: req.user.id },
  });

  res.json(paystackData); // contains authorization_url for the student to complete payment
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
