-- Brigab Agency — PostgreSQL schema
-- Run with: psql $DATABASE_URL -f schema.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Postgres has no CREATE TYPE IF NOT EXISTS (unlike tables/indexes), so each
-- enum is wrapped in a DO block that catches "already exists" and moves on —
-- this is what actually makes migrate.js safe to re-run.
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('student', 'manager');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE gender_policy AS ENUM ('male', 'female', 'mixed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE bed_status AS ENUM ('available', 'taken', 'reserved_pending', 'maintenance');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM ('pending_payment', 'deposit_paid', 'balance_paid', 'forfeited', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role user_role NOT NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  gender TEXT CHECK (gender IN ('male', 'female')), -- required for students at signup;
  -- used to enforce hostel gender_policy and prevent opposite genders sharing a room
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hostels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  manager_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  area TEXT NOT NULL,
  gender_policy gender_policy NOT NULL DEFAULT 'mixed',
  includes TEXT[] DEFAULT '{}',
  verified BOOLEAN DEFAULT false,
  deposit_pct NUMERIC(4,3) NOT NULL DEFAULT 0.35, -- e.g. 0.35 = 35%
  paystack_subaccount_code TEXT, -- set once manager completes Paystack onboarding
  photos TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hostel_id UUID NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  room_code TEXT NOT NULL, -- e.g. "A1"
  room_type TEXT NOT NULL, -- Single, 2-in-1, 4-in-1
  price_per_year NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(hostel_id, room_code)
);

CREATE TABLE IF NOT EXISTS beds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  bed_index INT NOT NULL, -- 0, 1, 2...
  status bed_status NOT NULL DEFAULT 'available',
  hold_expires_at TIMESTAMPTZ, -- used for the 15-minute reservation hold
  UNIQUE(room_id, bed_index)
);

-- Room photos/short clips, OR a hostel's own cover photo — exactly one of
-- room_id/hostel_id is set, never both, never neither. Only a lightweight
-- URL + Cloudinary reference lives here — actual files are never stored in
-- Postgres, so this table stays tiny no matter how many photos get uploaded.
CREATE TABLE IF NOT EXISTS media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  hostel_id UUID REFERENCES hostels(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  public_id TEXT NOT NULL, -- Cloudinary's reference, needed to delete the file later
  resource_type TEXT NOT NULL CHECK (resource_type IN ('image', 'video')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES users(id),
  bed_id UUID NOT NULL REFERENCES beds(id),
  deposit_amount NUMERIC(10,2) NOT NULL,
  service_fee NUMERIC(10,2) NOT NULL DEFAULT 50,
  balance_amount NUMERIC(10,2) NOT NULL,
  balance_due_date DATE NOT NULL,
  status booking_status NOT NULL DEFAULT 'pending_payment',
  paystack_ref TEXT UNIQUE,
  grace_period_ends_at DATE, -- balance_due_date + 3-5 days
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS waitlist_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES users(id),
  room_id UUID NOT NULL REFERENCES rooms(id),
  position INT NOT NULL,
  notified_at TIMESTAMPTZ,
  claim_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reminders_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL, -- '2_weeks' | '3_days' | 'deadline' | 'grace_warning' | 'forfeited'
  sent_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_beds_room ON beds(room_id);
CREATE INDEX IF NOT EXISTS idx_rooms_hostel ON rooms(hostel_id);
CREATE INDEX IF NOT EXISTS idx_bookings_student ON bookings(student_id);
CREATE INDEX IF NOT EXISTS idx_bookings_due_date ON bookings(balance_due_date) WHERE status = 'deposit_paid';
CREATE INDEX IF NOT EXISTS idx_waitlist_room ON waitlist_entries(room_id, position);

-- Room-level amenities (e.g. private bathroom, AC, bunk beds) — separate from
-- hostels.includes, which covers property-wide amenities (security, gym, etc).
-- ADD COLUMN IF NOT EXISTS makes this safe to re-run against a database that
-- already has the rooms table from before this column existed.
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS amenities TEXT[] DEFAULT '{}';

-- Same reasoning: users table already exists on deployed databases, so the
-- gender column needs its own ALTER rather than relying on CREATE TABLE.
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female'));

-- Tracks WHO placed a 15-minute hold, not just that one exists — needed to
-- catch a gender clash against someone mid-checkout in the same room, not
-- only against someone who has already fully paid.
ALTER TABLE beds ADD COLUMN IF NOT EXISTS held_by UUID REFERENCES users(id);

-- Media used to only attach to rooms; this lets it attach to a hostel
-- directly too (for a cover photo set at creation, before any room exists).
ALTER TABLE media ALTER COLUMN room_id DROP NOT NULL;
ALTER TABLE media ADD COLUMN IF NOT EXISTS hostel_id UUID REFERENCES hostels(id) ON DELETE CASCADE;

-- Postgres has no ADD CONSTRAINT IF NOT EXISTS either — same DO-block fix
-- as the enum types above.
DO $$ BEGIN
  ALTER TABLE media ADD CONSTRAINT media_belongs_to_one_parent
    CHECK ((room_id IS NOT NULL AND hostel_id IS NULL) OR (room_id IS NULL AND hostel_id IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN null;
END $$;
