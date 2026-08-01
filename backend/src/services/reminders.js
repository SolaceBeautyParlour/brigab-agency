import cron from "node-cron";
import { query, pool } from "../db/pool.js";
import { sendSMS, smsTemplates } from "./sms.js";
import { notifyNextInWaitlist } from "../routes/waitlist.js";

/**
 * Runs once a day. Walks every unpaid booking and sends the right reminder
 * based on how many days remain before balance_due_date, then handles the
 * grace period and eventual forfeiture. This is the automation that makes
 * the "fair but firm" policy actually happen without a human checking daily.
 */
async function runDailyReminders() {
  const bookings = await query(
    `SELECT bo.*, u.name, u.phone, r.room_id, r.room_code, h.name AS hostel_name
     FROM bookings bo
     JOIN users u ON u.id = bo.student_id
     JOIN beds be ON be.id = bo.bed_id
     JOIN rooms r ON r.id = be.room_id
     JOIN hostels h ON h.id = r.hostel_id
     WHERE bo.status = 'deposit_paid'`
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const b of bookings.rows) {
    const dueDate = new Date(b.balance_due_date);
    const graceEnd = new Date(b.grace_period_ends_at);
    const daysToDue = Math.round((dueDate - today) / 86400000);

    const already = await query(
      "SELECT reminder_type FROM reminders_log WHERE booking_id = $1",
      [b.id]
    );
    const sent = new Set(already.rows.map((r) => r.reminder_type));

    if (daysToDue === 14 && !sent.has("2_weeks")) {
      await sendSMS(b.phone, smsTemplates.reminder2Weeks(b.name, b.balance_amount, dueDate.toDateString()));
      await logReminder(b.id, "2_weeks");
    } else if (daysToDue === 3 && !sent.has("3_days")) {
      await sendSMS(b.phone, smsTemplates.reminder3Days(b.name, b.balance_amount, dueDate.toDateString()));
      await logReminder(b.id, "3_days");
    } else if (daysToDue === 0 && !sent.has("deadline")) {
      await sendSMS(b.phone, smsTemplates.reminderDeadline(b.name, b.balance_amount));
      await logReminder(b.id, "deadline");
    } else if (daysToDue < 0 && today <= graceEnd && !sent.has("grace_warning")) {
      await sendSMS(b.phone, smsTemplates.graceWarning(b.name, graceEnd.toDateString()));
      await logReminder(b.id, "grace_warning");
    } else if (today > graceEnd && !sent.has("forfeited")) {
      await forfeitBooking(b);
      await logReminder(b.id, "forfeited");
    }
  }
}

async function logReminder(bookingId, type) {
  await query("INSERT INTO reminders_log (booking_id, reminder_type) VALUES ($1, $2)", [bookingId, type]);
}

async function forfeitBooking(booking) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE bookings SET status = 'forfeited' WHERE id = $1", [booking.id]);
    await client.query("UPDATE beds SET status = 'available' WHERE id = $1", [booking.bed_id]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  await sendSMS(booking.phone, smsTemplates.forfeited(booking.name));
  // Bed is free again — automatically pull the next waitlisted student in.
  await notifyNextInWaitlist(booking.room_id, booking.hostel_name, booking.room_code);
}

/** Also sweeps expired 15-minute reservation holds back to 'available'. */
async function releaseExpiredHolds() {
  await query(
    "UPDATE beds SET status = 'available', hold_expires_at = NULL, held_by = NULL WHERE status = 'reserved_pending' AND hold_expires_at < now()"
  );
}

export function startReminderJobs() {
  // Once daily at 8am for balance reminders — a reasonable hour for SMS in Ghana.
  cron.schedule("0 8 * * *", () => {
    runDailyReminders().catch((err) => console.error("Reminder job failed:", err));
  });

  // Every minute, sweep expired reservation holds so beds don't stay stuck.
  cron.schedule("* * * * *", () => {
    releaseExpiredHolds().catch((err) => console.error("Hold sweep failed:", err));
  });
}
