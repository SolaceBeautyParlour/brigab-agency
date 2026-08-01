import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import "dotenv/config";
import "express-async-errors"; // must load before routes — lets thrown errors in
// async handlers reach the error middleware below instead of hanging forever.

import authRoutes from "./routes/auth.js";
import hostelRoutes from "./routes/hostels.js";
import bookingRoutes from "./routes/bookings.js";
import paymentRoutes from "./routes/payments.js";
import waitlistRoutes from "./routes/waitlist.js";
import managerRoutes from "./routes/manager.js";
import { startReminderJobs } from "./services/reminders.js";

const app = express();

// Render (and most hosts) sit behind a reverse proxy. Without this,
// express-rate-limit and req.ip both see the proxy's IP for every request
// instead of the real client — rate limiting would then treat every visitor
// as the same person.
app.set("trust proxy", 1);

app.use(helmet());

// In dev, allow any localhost port (Vite sometimes picks 5174+ if 5173 is
// busy). In production, only the deployed frontend's real URL is allowed —
// set FRONTEND_URL in .env once you know it (e.g. https://brigab.vercel.app).
const allowedOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      const isLocalDev = !origin || /^http:\/\/localhost:\d+$/.test(origin);
      if (isLocalDev || allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error("Not allowed by CORS"));
    },
  })
);

// Caps request body size — nothing this app sends legitimately needs more
// than a fraction of this, so it's a cheap guard against oversized payloads.
app.use(express.json({ limit: "200kb" }));

// Auth endpoints get their own, tighter limit — this is where credential
// stuffing / brute-force login attempts would land.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please wait a few minutes and try again." },
});

// A looser baseline for everything else, mainly to blunt scripted abuse
// rather than to constrain normal browsing/booking traffic.
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/hostels", generalLimiter, hostelRoutes);
app.use("/api/bookings", generalLimiter, bookingRoutes);
app.use("/api/payments", generalLimiter, paymentRoutes);
app.use("/api/waitlist", generalLimiter, waitlistRoutes);
app.use("/api/manager", generalLimiter, managerRoutes);

// Central error handler — keeps stack traces out of API responses.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Something went wrong" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Brigab Agency API running on port ${PORT}`);
  startReminderJobs();
});
