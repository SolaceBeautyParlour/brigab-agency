// Runs schema.sql against DATABASE_URL using the pg driver directly —
// no need for the psql command-line tool to be installed.
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { pool } from "./pool.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const sql = readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  console.log("Running schema.sql against DATABASE_URL...");
  try {
    await pool.query(sql);
    console.log("✅ Migration complete — tables created (or already existed).");
  } catch (err) {
    console.error("❌ Migration failed:");
    console.error(err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migrate();
