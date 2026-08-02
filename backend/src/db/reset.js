// Wipes all app data (users, hostels, rooms, beds, bookings, waitlist,
// reminders) while leaving the table structure intact — for clearing test
// data before a real test round. Deliberately requires an explicit flag so
// this can never run by accident.
//
// Run with: npm run reset-data -- --yes-really-wipe-everything
import "dotenv/config";
import { pool } from "./pool.js";

async function main() {
  if (!process.argv.includes("--yes-really-wipe-everything")) {
    console.log(`
This deletes EVERY user, hostel, room, bed, booking, and waitlist entry.
There is no undo.

If you're sure, run:
  npm run reset-data -- --yes-really-wipe-everything
`);
    process.exit(1);
  }

  const redactedUrl = (process.env.DATABASE_URL || "").replace(/:\/\/([^:]+):[^@]+@/, "://$1:****@");
  console.log(`About to wipe all data at:\n  ${redactedUrl}\n`);

  await pool.query(`
    TRUNCATE reminders_log, waitlist_entries, bookings, media, beds, rooms, hostels, users
    RESTART IDENTITY CASCADE;
  `);

  console.log("✅ All tables wiped. Structure is intact — ready for fresh signups.");
  await pool.end();
}

main().catch((err) => {
  console.error("❌ Reset failed:", err.message);
  process.exit(1);
});
