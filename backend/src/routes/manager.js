import express from "express";
import multer from "multer";
import { query } from "../db/pool.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { createSubaccount, listGhanaBanks } from "../services/paystack.js";
import {
  uploadRoomMedia,
  deleteRoomMedia,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  MAX_MEDIA_PER_ROOM,
} from "../services/cloudinaryMedia.js";
import { HOSTEL_AMENITIES, ROOM_AMENITIES, sanitizeAmenities } from "../constants/amenities.js";
import { notifyNextInWaitlist } from "./waitlist.js";

const router = express.Router();
router.use(requireAuth, requireRole("manager"));

// Memory storage — the file never touches disk here, it's streamed straight
// to Cloudinary. Multer's own limit is set to the larger of the two caps;
// the route below enforces the tighter image-specific cap afterward.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_VIDEO_BYTES } });

/** Create a hostel listing. Free — no subscription, ever. */
router.post("/hostels", async (req, res) => {
  const { name, area, genderPolicy, includes, depositPct } = req.body;
  const safeAmenities = sanitizeAmenities(includes, HOSTEL_AMENITIES);
  const safeDepositPct = Math.min(1, Math.max(0.1, Number(depositPct) || 0.35));
  const result = await query(
    `INSERT INTO hostels (manager_id, name, area, gender_policy, includes, deposit_pct)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [req.user.id, name, area, genderPolicy || "mixed", safeAmenities, safeDepositPct]
  );
  res.status(201).json(result.rows[0]);
});

router.get("/hostels", async (req, res) => {
  // One round trip for everything — hostels, rooms, and beds all nested via
  // json_agg — instead of one query per hostel. On a database that's a few
  // hundred ms away (Render's Oregon region, if you're testing from Ghana),
  // each extra round trip is the dominant cost, so this matters a lot more
  // than trimming query complexity would.
  const result = await query(
    `SELECT h.*,
            (SELECT COALESCE(
               json_agg(
                 json_build_object('id', m.id, 'url', m.url, 'resource_type', m.resource_type)
                 ORDER BY m.created_at
               ), '[]'
             ) FROM media m WHERE m.hostel_id = h.id) AS media,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', r.id, 'room_code', r.room_code, 'room_type', r.room_type,
                  'price_per_year', r.price_per_year, 'beds', r.beds, 'media', r.media,
                  'amenities', r.amenities
                ) ORDER BY r.room_code
              ) FILTER (WHERE r.id IS NOT NULL), '[]'
            ) AS rooms
     FROM hostels h
     LEFT JOIN (
       SELECT rm.id, rm.hostel_id, rm.room_code, rm.room_type, rm.price_per_year, rm.amenities,
              (SELECT COALESCE(
                 json_agg(
                   json_build_object('id', b.id, 'bed_index', b.bed_index, 'status', b.status)
                   ORDER BY b.bed_index
                 ), '[]'
               ) FROM beds b WHERE b.room_id = rm.id) AS beds,
              (SELECT COALESCE(
                 json_agg(
                   json_build_object('id', m.id, 'url', m.url, 'resource_type', m.resource_type)
                   ORDER BY m.created_at
                 ), '[]'
               ) FROM media m WHERE m.room_id = rm.id) AS media
       FROM rooms rm
     ) r ON r.hostel_id = h.id
     WHERE h.manager_id = $1
     GROUP BY h.id
     ORDER BY h.created_at DESC`,
    [req.user.id]
  );

  res.json(result.rows);
});

/** Powers the bank dropdown on the Connect Paystack form — name shown, code sent. */
router.get("/banks", async (req, res) => {
  const banks = await listGhanaBanks();
  res.json(banks.map((b) => ({ name: b.name, code: b.code })));
});

/** Onboarding step: link a real bank account so deposits settle directly to the manager. */
router.post("/hostels/:id/connect-paystack", async (req, res) => {
  const { businessName, bankCode, accountNumber } = req.body;
  const subaccount = await createSubaccount({
    businessName,
    bankCode,
    accountNumber,
    percentageCharge: 0, // Brigab takes its cut via the flat service fee, not a % of rent
  });
  await query(
    "UPDATE hostels SET paystack_subaccount_code = $1 WHERE id = $2 AND manager_id = $3",
    [subaccount.subaccount_code, req.params.id, req.user.id]
  );
  res.json({ subaccountCode: subaccount.subaccount_code });
});

/** Add a room with N beds pre-created as available. */
router.post("/hostels/:hostelId/rooms", async (req, res) => {
  const { roomCode, roomType, pricePerYear, bedCount, amenities } = req.body;
  const safeAmenities = sanitizeAmenities(amenities, ROOM_AMENITIES);

  const owns = await query("SELECT id FROM hostels WHERE id = $1 AND manager_id = $2", [req.params.hostelId, req.user.id]);
  if (!owns.rows.length) return res.status(403).json({ error: "You don't manage this hostel" });

  const roomResult = await query(
    `INSERT INTO rooms (hostel_id, room_code, room_type, price_per_year, amenities) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [req.params.hostelId, roomCode, roomType, pricePerYear, safeAmenities]
  );
  const room = roomResult.rows[0];

  const bedInserts = Array.from({ length: bedCount }, (_, i) =>
    query("INSERT INTO beds (room_id, bed_index, status) VALUES ($1, $2, 'available')", [room.id, i])
  );
  await Promise.all(bedInserts);

  res.status(201).json(room);
});

/**
 * Edit a room's basic details. Bed count is intentionally NOT editable here —
 * changing headcount on a room with live bookings is a data-integrity
 * minefield (which bed does a paid student lose?). Managers can still
 * delete+recreate an empty room if they need a different bed count.
 */
router.patch("/rooms/:roomId", async (req, res) => {
  const { roomCode, roomType, pricePerYear, amenities } = req.body;
  const safeAmenities = sanitizeAmenities(amenities, ROOM_AMENITIES);

  const owns = await query(
    `SELECT r.id FROM rooms r JOIN hostels h ON h.id = r.hostel_id
     WHERE r.id = $1 AND h.manager_id = $2`,
    [req.params.roomId, req.user.id]
  );
  if (!owns.rows.length) return res.status(403).json({ error: "You don't manage this room" });

  const result = await query(
    `UPDATE rooms SET room_code = $1, room_type = $2, price_per_year = $3, amenities = $4
     WHERE id = $5 RETURNING *`,
    [roomCode, roomType, pricePerYear, safeAmenities, req.params.roomId]
  );
  res.json(result.rows[0]);
});

/**
 * Delete a room (and its beds, via ON DELETE CASCADE). Blocked at the
 * database level if any bed in the room has booking history — a student
 * who paid a deposit can't have their room silently vanish. We catch that
 * FK violation (code 23503) and turn it into a clear message instead of a
 * raw 500.
 */
router.delete("/rooms/:roomId", async (req, res) => {
  const owns = await query(
    `SELECT r.id FROM rooms r JOIN hostels h ON h.id = r.hostel_id
     WHERE r.id = $1 AND h.manager_id = $2`,
    [req.params.roomId, req.user.id]
  );
  if (!owns.rows.length) return res.status(403).json({ error: "You don't manage this room" });

  try {
    await query("DELETE FROM rooms WHERE id = $1", [req.params.roomId]);
  } catch (err) {
    if (err.code === "23503") {
      return res.status(409).json({
        error: "This room has booking history and can't be deleted. Mark its beds as unavailable instead if it's no longer in use.",
      });
    }
    throw err;
  }
  res.status(204).end();
});

/**
 * Upload a photo or short clip for a room. Files are streamed straight to
 * Cloudinary — never written to this server's disk and never stored in
 * Postgres — so uploads can never bloat the database, no matter how many
 * managers use this.
 */
router.post("/rooms/:roomId/media", upload.single("file"), async (req, res) => {
  const owns = await query(
    `SELECT r.id FROM rooms r JOIN hostels h ON h.id = r.hostel_id
     WHERE r.id = $1 AND h.manager_id = $2`,
    [req.params.roomId, req.user.id]
  );
  if (!owns.rows.length) return res.status(403).json({ error: "You don't manage this room" });

  if (!req.file) return res.status(400).json({ error: "No file was uploaded." });

  const isImage = req.file.mimetype.startsWith("image/");
  const isVideo = req.file.mimetype.startsWith("video/");
  if (!isImage && !isVideo) {
    return res.status(415).json({ error: "Only images and videos are supported." });
  }
  if (isImage && req.file.size > MAX_IMAGE_BYTES) {
    return res.status(413).json({ error: `Images must be under ${MAX_IMAGE_BYTES / 1024 / 1024}MB.` });
  }
  if (isVideo && req.file.size > MAX_VIDEO_BYTES) {
    return res.status(413).json({ error: `Video clips must be under ${MAX_VIDEO_BYTES / 1024 / 1024}MB — keep it short.` });
  }

  const countResult = await query("SELECT COUNT(*) FROM media WHERE room_id = $1", [req.params.roomId]);
  if (Number(countResult.rows[0].count) >= MAX_MEDIA_PER_ROOM) {
    return res.status(409).json({ error: `Each room can have at most ${MAX_MEDIA_PER_ROOM} photos/clips. Delete one to add another.` });
  }

  const resourceType = isImage ? "image" : "video";
  let uploadResult;
  try {
    uploadResult = await uploadRoomMedia(req.file.buffer, resourceType);
  } catch (err) {
    return res.status(502).json({ error: "Upload to media storage failed. Please try again." });
  }

  // Store the EAGER (compressed/resized) version, not the original —
  // that's the whole point of compressing on upload.
  const url = uploadResult.eager?.[0]?.secure_url || uploadResult.secure_url;

  const result = await query(
    `INSERT INTO media (room_id, url, public_id, resource_type) VALUES ($1, $2, $3, $4) RETURNING *`,
    [req.params.roomId, url, uploadResult.public_id, resourceType]
  );
  res.status(201).json(result.rows[0]);
});

/**
 * Upload a cover photo/clip for the HOSTEL itself — separate from room
 * photos, since a hostel needs at least one image before any room exists
 * (e.g. right at creation time, or a building-exterior shot).
 */
router.post("/hostels/:hostelId/media", upload.single("file"), async (req, res) => {
  const owns = await query("SELECT id FROM hostels WHERE id = $1 AND manager_id = $2", [req.params.hostelId, req.user.id]);
  if (!owns.rows.length) return res.status(403).json({ error: "You don't manage this hostel" });

  if (!req.file) return res.status(400).json({ error: "No file was uploaded." });

  const isImage = req.file.mimetype.startsWith("image/");
  const isVideo = req.file.mimetype.startsWith("video/");
  if (!isImage && !isVideo) {
    return res.status(415).json({ error: "Only images and videos are supported." });
  }
  if (isImage && req.file.size > MAX_IMAGE_BYTES) {
    return res.status(413).json({ error: `Images must be under ${MAX_IMAGE_BYTES / 1024 / 1024}MB.` });
  }
  if (isVideo && req.file.size > MAX_VIDEO_BYTES) {
    return res.status(413).json({ error: `Video clips must be under ${MAX_VIDEO_BYTES / 1024 / 1024}MB — keep it short.` });
  }

  const countResult = await query("SELECT COUNT(*) FROM media WHERE hostel_id = $1", [req.params.hostelId]);
  if (Number(countResult.rows[0].count) >= MAX_MEDIA_PER_ROOM) {
    return res.status(409).json({ error: `A hostel can have at most ${MAX_MEDIA_PER_ROOM} photos/clips. Delete one to add another.` });
  }

  const resourceType = isImage ? "image" : "video";
  let uploadResult;
  try {
    uploadResult = await uploadRoomMedia(req.file.buffer, resourceType);
  } catch (err) {
    return res.status(502).json({ error: "Upload to media storage failed. Please try again." });
  }

  const url = uploadResult.eager?.[0]?.secure_url || uploadResult.secure_url;

  const result = await query(
    `INSERT INTO media (hostel_id, url, public_id, resource_type) VALUES ($1, $2, $3, $4) RETURNING *`,
    [req.params.hostelId, url, uploadResult.public_id, resourceType]
  );
  res.status(201).json(result.rows[0]);
});

/** Delete a room OR hostel photo/clip — removes it from Cloudinary too, not just the DB row. */
router.delete("/media/:mediaId", async (req, res) => {
  const owns = await query(
    `SELECT m.* FROM media m
     LEFT JOIN rooms r ON r.id = m.room_id
     LEFT JOIN hostels h ON h.id = COALESCE(r.hostel_id, m.hostel_id)
     WHERE m.id = $1 AND h.manager_id = $2`,
    [req.params.mediaId, req.user.id]
  );
  const media = owns.rows[0];
  if (!media) return res.status(403).json({ error: "You don't manage this media" });

  try {
    await deleteRoomMedia(media.public_id, media.resource_type);
  } catch (err) {
    console.error("Cloudinary delete failed (continuing to remove DB record):", err.message);
  }
  await query("DELETE FROM media WHERE id = $1", [req.params.mediaId]);
  res.status(204).end();
});

/**
 * The core adoption-driving interaction: tap a bed to flip its status.
 * Deliberately a single request, single tap — complexity here is the
 * enemy of managers actually keeping it updated.
 */
router.patch("/beds/:bedId", async (req, res) => {
  const { status } = req.body; // 'available' | 'taken' | 'maintenance'

  const bed = (await query(
    `SELECT b.*, r.hostel_id, r.id AS room_id, r.room_code, h.name AS hostel_name, h.manager_id
     FROM beds b JOIN rooms r ON r.id = b.room_id JOIN hostels h ON h.id = r.hostel_id
     WHERE b.id = $1`,
    [req.params.bedId]
  )).rows[0];

  if (!bed || bed.manager_id !== req.user.id) {
    return res.status(403).json({ error: "You don't manage this hostel" });
  }

  const wasFullyTaken = bed.status === "taken";
  await query("UPDATE beds SET status = $1, hold_expires_at = NULL WHERE id = $2", [status, req.params.bedId]);

  // Marking a bed vacated kicks off the waitlist notification chain automatically.
  if (wasFullyTaken && status === "available") {
    await notifyNextInWaitlist(bed.room_id, bed.hostel_name, bed.room_code);
  }

  res.json({ id: req.params.bedId, status });
});

/** Manager's booking list — who's paid what, per hostel. */
router.get("/hostels/:hostelId/bookings", async (req, res) => {
  const owns = await query("SELECT id FROM hostels WHERE id = $1 AND manager_id = $2", [req.params.hostelId, req.user.id]);
  if (!owns.rows.length) return res.status(403).json({ error: "You don't manage this hostel" });

  const result = await query(
    `SELECT bo.*, u.name AS student_name, u.phone AS student_phone, r.room_code
     FROM bookings bo
     JOIN beds be ON be.id = bo.bed_id
     JOIN rooms r ON r.id = be.room_id
     JOIN users u ON u.id = bo.student_id
     WHERE r.hostel_id = $1
     ORDER BY bo.created_at DESC`,
    [req.params.hostelId]
  );
  res.json(result.rows);
});

export default router;
