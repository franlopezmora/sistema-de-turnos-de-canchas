-- SaaS multi-club hardening:
-- 1) Membership multi-club por usuario
-- 2) clubId obligatorio en FixedBooking
-- 3) Tablas operativas Payment y Notification con scoping por club
-- 4) Índices de performance para Booking

-- 1) Enum MembershipRole
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MembershipRole') THEN
    CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'ADMIN', 'STAFF', 'CUSTOMER');
  END IF;
END $$;

-- 2) Tabla Membership
CREATE TABLE IF NOT EXISTS "Membership" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "clubId" INTEGER NOT NULL,
  "role" "MembershipRole" NOT NULL,
  CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Membership_userId_clubId_key"
ON "Membership"("userId", "clubId");

CREATE INDEX IF NOT EXISTS "Membership_clubId_idx"
ON "Membership"("clubId");

CREATE INDEX IF NOT EXISTS "Membership_userId_idx"
ON "Membership"("userId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Membership_userId_fkey') THEN
    ALTER TABLE "Membership"
      ADD CONSTRAINT "Membership_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Membership_clubId_fkey') THEN
    ALTER TABLE "Membership"
      ADD CONSTRAINT "Membership_clubId_fkey"
      FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 3) clubId en FixedBooking + backfill
ALTER TABLE "FixedBooking" ADD COLUMN IF NOT EXISTS "clubId" INTEGER;

UPDATE "FixedBooking" fb
SET "clubId" = c."clubId"
FROM "Court" c
WHERE fb."courtId" = c."id"
  AND fb."clubId" IS NULL;

ALTER TABLE "FixedBooking" ALTER COLUMN "clubId" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FixedBooking_clubId_fkey') THEN
    ALTER TABLE "FixedBooking"
      ADD CONSTRAINT "FixedBooking_clubId_fkey"
      FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "FixedBooking_clubId_idx"
ON "FixedBooking"("clubId");

-- 4) Payment table
CREATE TABLE IF NOT EXISTS "Payment" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "amount" DECIMAL(10,2) NOT NULL,
  "method" TEXT NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "bookingId" INTEGER,
  "userId" INTEGER,
  "clubId" INTEGER NOT NULL,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payment_bookingId_fkey') THEN
    ALTER TABLE "Payment"
      ADD CONSTRAINT "Payment_bookingId_fkey"
      FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payment_userId_fkey') THEN
    ALTER TABLE "Payment"
      ADD CONSTRAINT "Payment_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payment_clubId_fkey') THEN
    ALTER TABLE "Payment"
      ADD CONSTRAINT "Payment_clubId_fkey"
      FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Payment_clubId_idx" ON "Payment"("clubId");
CREATE INDEX IF NOT EXISTS "Payment_bookingId_idx" ON "Payment"("bookingId");
CREATE INDEX IF NOT EXISTS "Payment_userId_idx" ON "Payment"("userId");

-- 5) Notification table
CREATE TABLE IF NOT EXISTS "Notification" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "channel" TEXT,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "userId" INTEGER,
  "clubId" INTEGER NOT NULL,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Notification_userId_fkey') THEN
    ALTER TABLE "Notification"
      ADD CONSTRAINT "Notification_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Notification_clubId_fkey') THEN
    ALTER TABLE "Notification"
      ADD CONSTRAINT "Notification_clubId_fkey"
      FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Notification_clubId_idx" ON "Notification"("clubId");
CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON "Notification"("userId");

-- 6) Performance indexes solicitados para Booking
DROP INDEX IF EXISTS "Booking_clubId_startDateTime_idx";
DROP INDEX IF EXISTS "Booking_courtId_startDateTime_idx";

CREATE INDEX IF NOT EXISTS "booking_club_day"
ON "Booking" ("clubId", "startDateTime");

CREATE INDEX IF NOT EXISTS "booking_court_day"
ON "Booking" ("courtId", "startDateTime");

-- En este schema la columna es activityId (no activityTypeId)
CREATE INDEX IF NOT EXISTS "booking_activity_day"
ON "Booking" ("activityId", "startDateTime");
