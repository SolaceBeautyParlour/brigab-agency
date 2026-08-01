import express from "express";
import { query } from "../db/pool.js";
import { HOSTEL_AMENITIES, ROOM_AMENITIES } from "../constants/amenities.js";

const router = express.Router();

/** Powers both the manager's amenity checklists and the student filter panel. */
router.get("/amenity-options", (req, res) => {
  res.json({ hostelAmenities: HOSTEL_AMENITIES, roomAmenities: ROOM_AMENITIES });
});

/**
 * Public browse — filter by area/gender/price/room type/amenities.
 * Amenity filters require ALL selected items to match (a strict AND), which
 * is what a student picking specific must-haves would expect.
 */
router.get("/", async (req, res) => {
  const { search, gender, minPrice, maxPrice, roomTypes, hostelAmenities, roomAmenities } = req.query;

  const conditions = [];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(h.name ILIKE $${params.length} OR h.area ILIKE $${params.length})`);
  }
  if (gender && gender !== "any") {
    params.push(gender);
    conditions.push(`(h.gender_policy = $${params.length} OR h.gender_policy = 'mixed')`);
  }
  if (hostelAmenities) {
    const list = hostelAmenities.split(",").filter(Boolean);
    if (list.length) {
      params.push(list);
      conditions.push(`h.includes @> $${params.length}::text[]`);
    }
  }

  // Price range, room type, and room-level amenities all need to match some
  // ROOM at the hostel, not the hostel row itself — hence the EXISTS checks
  // rather than a plain column comparison.
  const roomConditions = [];
  const roomParams = [];
  if (minPrice) {
    roomParams.push(Number(minPrice));
    roomConditions.push(`r2.price_per_year >= $${params.length + roomParams.length}`);
  }
  if (maxPrice) {
    roomParams.push(Number(maxPrice));
    roomConditions.push(`r2.price_per_year <= $${params.length + roomParams.length}`);
  }
  if (roomTypes) {
    const list = roomTypes.split(",").filter(Boolean);
    if (list.length) {
      roomParams.push(list);
      roomConditions.push(`r2.room_type = ANY($${params.length + roomParams.length}::text[])`);
    }
  }
  if (roomAmenities) {
    const list = roomAmenities.split(",").filter(Boolean);
    if (list.length) {
      roomParams.push(list);
      roomConditions.push(`r2.amenities @> $${params.length + roomParams.length}::text[]`);
    }
  }
  if (roomConditions.length) {
    conditions.push(`EXISTS (SELECT 1 FROM rooms r2 WHERE r2.hostel_id = h.id AND ${roomConditions.join(" AND ")})`);
  }
  params.push(...roomParams);

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await query(
    `SELECT h.id, h.name, h.area, h.gender_policy, h.includes, h.verified,
            COUNT(b.id) AS total_beds,
            COUNT(b.id) FILTER (WHERE b.status = 'available') AS open_beds,
            MIN(r.price_per_year) AS from_price
     FROM hostels h
     LEFT JOIN rooms r ON r.hostel_id = h.id
     LEFT JOIN beds b ON b.room_id = r.id
     ${where}
     GROUP BY h.id
     ORDER BY open_beds DESC`,
    params
  );

  res.json(result.rows);
});

/** Hostel detail — rooms + live bed grid + photos/clips, in a single round trip. */
router.get("/:id", async (req, res) => {
  const result = await query(
    `SELECT h.*,
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
     WHERE h.id = $1
     GROUP BY h.id`,
    [req.params.id]
  );

  const hostel = result.rows[0];
  if (!hostel) return res.status(404).json({ error: "Hostel not found" });
  res.json(hostel);
});

export default router;
