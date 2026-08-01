import { Pool } from "pg";
import "dotenv/config";

// Railway/Render provide DATABASE_URL automatically once you attach a Postgres
// instance. Locally, copy .env.example to .env and point it at your own db.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost")
    ? false
    : { rejectUnauthorized: false },
  // Default idle timeout (10s) is shorter than the once-a-minute reminders
  // job, so the pool was tearing the connection down and rebuilding it —
  // a fresh TLS handshake every time — right before each sweep. Keeping it
  // warm longer avoids that repeated handshake cost.
  idleTimeoutMillis: 120000,
  max: 5,
  // TCP keepalive stops the connection from going quietly stale on a long
  // physical link (e.g. Ghana <-> Render's Oregon region), which otherwise
  // forces a fresh handshake on the next query after any pause.
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

// REQUIRED, not optional: if an idle connection in the pool gets dropped —
// a network blip, or Render's side closing it — pg-pool emits an 'error'
// event on the pool itself. Node treats an unlistened 'error' event as
// fatal and kills the whole process. This just logs it instead; pg-pool
// already discards the bad client and opens a fresh one on the next query,
// so a dropped idle connection should never take the server down with it.
pool.on("error", (err) => {
  console.error("Idle database connection was dropped (pool will reconnect automatically):", err.message);
});

export async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  // Set DEBUG_SQL=true in .env if you want every query printed while debugging.
  if (process.env.DEBUG_SQL === "true") {
    console.log("query", { text, duration: Date.now() - start, rows: res.rowCount });
  }
  return res;
}
