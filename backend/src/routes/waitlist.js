import express from "express";
import { query } from "../db/pool.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { sendSMS, smsTemplates } from "../services/sms.js";

const router = express.Router();
const CLAIM_WINDOW_HOURS = 24;

/** Student joins a room's waitlist and sees their live queue position. */
router.post("/join", requireAuth, requireRole("student"), async (req, res) => {
  const { roomId } = req.body;

  const existing = await query(
    "SELECT id FROM waitlist_entries WHERE room_id = $1 AND student_id = $2",
    [roomId, req.user.id]
  );
  if (existing.rows.length) {
    return res.status(409).json({ error: "You're already on the waitlist for this room" });
  }

  const countResult = await query("SELECT COUNT(*) FROM waitlist_entries WHERE room_id = $1", [roomId]);
  const position = Number(countResult.rows[0].count) + 1;

  const result = await query(
    `INSERT INTO waitlist_entries (student_id, room_id, position) VALUES ($1, $2, $3) RETURNING *`,
    [req.user.id, roomId, position]
  );
  res.status(201).json(result.rows[0]);
});

/** Current position, updated live whenever anyone ahead is removed. */
router.get("/room/:roomId", requireAuth, async (req, res) => {
  const result = await query(
    `SELECT w.*, u.name FROM waitlist_entries w JOIN users u ON u.id = w.student_id
     WHERE w.room_id = $1 ORDER BY w.position ASC`,
    [req.params.roomId]
  );
  res.json(result.rows);
});

/**
 * Called when a manager marks a bed as vacated (see manager.js). Notifies the
 * next student in line with a 24-hour claim window, then re-notifies the
 * following person if it lapses (handled by the reminders cron job).
 */
export async function notifyNextInWaitlist(roomId, hostelName, roomCode) {
  const next = await query(
    `SELECT w.*, u.name, u.phone FROM waitlist_entries w JOIN users u ON u.id = w.student_id
     WHERE w.room_id = $1 AND w.notified_at IS NULL ORDER BY w.position ASC LIMIT 1`,
    [roomId]
  );
  const entry = next.rows[0];
  if (!entry) return null;

  const claimExpires = new Date(Date.now() + CLAIM_WINDOW_HOURS * 60 * 60 * 1000);
  await query(
    "UPDATE waitlist_entries SET notified_at = now(), claim_expires_at = $1 WHERE id = $2",
    [claimExpires, entry.id]
  );
  await sendSMS(entry.phone, smsTemplates.waitlistClaim(entry.name, hostelName, roomCode));
  return entry;
}

/** Student removes themselves from a waitlist. */
router.delete("/:id", requireAuth, requireRole("student"), async (req, res) => {
  await query("DELETE FROM waitlist_entries WHERE id = $1 AND student_id = $2", [req.params.id, req.user.id]);
  res.status(204).send();
});

export default router;
