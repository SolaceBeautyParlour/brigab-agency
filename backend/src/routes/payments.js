import express from "express";
import crypto from "crypto";
import { query, pool } from "../db/pool.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { verifyTransaction, PAYSTACK_FEE_RATE } from "../services/paystack.js";
import { sendSMS, smsTemplates } from "../services/sms.js";
import { sendReceiptEmail, sendManagerBookingEmail } from "../services/email.js";
import { computeBalanceDueDate } from "../services/academicCalendar.js";

const router = express.Router();
const SERVICE_FEE = 50;
const GRACE_DAYS = 4;

/**
 * NEVER trust a client-side "payment successful" callback. This endpoint
 * re-verifies the transaction directly with Paystack before creating any
 * booking or marking a bed as taken.
 */
router.post("/verify", requireAuth, requireRole("student"), async (req, res) => {
  const { reference, bedId } = req.body;

  const verified = await verifyTransaction(reference);
  if (verified.status !== "success") {
    return res.status(402).json({ error: "Payment was not successful", detail: verified.gateway_response });
  }

  const bedResult = await query(
    `SELECT b.*, r.price_per_year, r.hostel_id, h.deposit_pct
     FROM beds b JOIN rooms r ON r.id = b.room_id JOIN hostels h ON h.id = r.hostel_id
     WHERE b.id = $1`,
    [bedId]
  );
  const bed = bedResult.rows[0];
  if (!bed) return res.status(404).json({ error: "Bed not found" });

  const pricePerYear = Number(bed.price_per_year);
  const minDeposit = pricePerYear * Number(bed.deposit_pct);

  // Ground truth is what Paystack actually recorded, never a number the
  // client could have sent — that's what makes the flexible payment amount
  // safe. If someone tampered with the request, this is where it's caught.
  // The total now includes a visible Paystack-fee line on top of deposit +
  // service fee, so that has to come back out before we know the real deposit.
  const totalPaidGHS = Number(verified.amount) / 100;
  const paystackFeeActual = Math.round(totalPaidGHS * PAYSTACK_FEE_RATE * 100) / 100;
  const deposit = totalPaidGHS - SERVICE_FEE - paystackFeeActual;
  const balance = Math.max(0, pricePerYear - deposit);

  if (deposit < minDeposit - 0.5) {
    return res.status(402).json({
      error: "The amount paid is below this hostel's minimum deposit. Contact support before this bed is marked as booked.",
    });
  }

  // Balance due date follows KNUST's real academic calendar: 3 weeks before
  // move-in if booked well ahead, or right at move-in if booked close to it.
  const balanceDueDate = computeBalanceDueDate();
  const graceEnd = new Date(balanceDueDate);
  graceEnd.setDate(graceEnd.getDate() + GRACE_DAYS);

  const client = await pool.connect();
  let booking;
  try {
    await client.query("BEGIN");
    await client.query("UPDATE beds SET status = 'taken', hold_expires_at = NULL WHERE id = $1", [bedId]);

    const bookingResult = await client.query(
      `INSERT INTO bookings (student_id, bed_id, deposit_amount, service_fee, balance_amount, balance_due_date, status, paystack_ref, grace_period_ends_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'deposit_paid', $7, $8) RETURNING *`,
      [req.user.id, bedId, deposit, SERVICE_FEE, balance, balanceDueDate, reference, graceEnd]
    );
    booking = bookingResult.rows[0];
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    client.release();
    throw err;
  }
  client.release();

  // Notifications are best-effort and happen after the booking is already
  // committed — a failed SMS/email should never undo a successful payment.
  try {
    const student = (await query("SELECT name, email, phone FROM users WHERE id = $1", [req.user.id])).rows[0];
    const hostelInfo = (await query(
      `SELECT h.name AS hostel_name, r.room_code, u.name AS manager_name, u.email AS manager_email, u.phone AS manager_phone
       FROM rooms r
       JOIN hostels h ON h.id = r.hostel_id
       JOIN users u ON u.id = h.manager_id
       WHERE r.id = (SELECT room_id FROM beds WHERE id = $1)`,
      [bedId]
    )).rows[0];

    await sendSMS(student.phone, smsTemplates.bookingReceipt(student.name, reference, balance, balanceDueDate.toDateString()));
    await sendReceiptEmail({
      to: student.email,
      name: student.name,
      hostelName: hostelInfo.hostel_name,
      roomCode: hostelInfo.room_code,
      deposit,
      serviceFee: SERVICE_FEE,
      balance,
      dueDate: balanceDueDate.toDateString(),
      reference,
    });

    // The manager should know a real booking just happened too — not just
    // see it passively next time they happen to open their dashboard.
    await sendSMS(hostelInfo.manager_phone, smsTemplates.newBookingManager(student.name, hostelInfo.room_code, deposit));
    await sendManagerBookingEmail({
      to: hostelInfo.manager_email,
      managerName: hostelInfo.manager_name,
      studentName: student.name,
      studentPhone: student.phone,
      hostelName: hostelInfo.hostel_name,
      roomCode: hostelInfo.room_code,
      depositAmount: deposit,
      balanceAmount: balance,
    });
  } catch (notifyErr) {
    console.error("Booking succeeded but notification failed:", notifyErr);
  }

  res.status(201).json(booking);
});

/** Pay off the remaining balance later from the dashboard. */
router.post("/pay-balance", requireAuth, requireRole("student"), async (req, res) => {
  const { bookingId, reference } = req.body;
  const verified = await verifyTransaction(reference);
  if (verified.status !== "success") {
    return res.status(402).json({ error: "Payment was not successful" });
  }

  const result = await query(
    `UPDATE bookings SET status = 'balance_paid' WHERE id = $1 AND student_id = $2 RETURNING *`,
    [bookingId, req.user.id]
  );
  if (!result.rows.length) return res.status(404).json({ error: "Booking not found" });
  res.json(result.rows[0]);
});

export default router;
