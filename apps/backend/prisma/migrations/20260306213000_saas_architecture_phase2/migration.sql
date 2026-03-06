-- SaaS architecture phase 2
-- 1) Remove legacy User.clubId
-- 2) Add CourtPriceRule, AuditLog, Event, ClubSettings
-- 3) Improve Notification model
-- 4) Add missing performance indexes
-- 5) Ensure booking overlap protection with canonical constraint name

-- 1) Remove legacy single-club from User
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_clubId_fkey";
DROP INDEX IF EXISTS "User_clubId_idx";
ALTER TABLE "User" DROP COLUMN IF EXISTS "clubId";

-- 2) CourtPriceRule
CREATE TABLE IF NOT EXISTS "CourtPriceRule" (
  "id" SERIAL PRIMARY KEY,
  "courtId" INTEGER NOT NULL,
  "clubId" INTEGER NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "startMinutes" INTEGER NOT NULL,
  "endMinutes" INTEGER NOT NULL,
  "price" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CourtPriceRule_courtId_fkey') THEN
    ALTER TABLE "CourtPriceRule"
      ADD CONSTRAINT "CourtPriceRule_courtId_fkey"
      FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CourtPriceRule_clubId_fkey') THEN
    ALTER TABLE "CourtPriceRule"
      ADD CONSTRAINT "CourtPriceRule_clubId_fkey"
      FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "CourtPriceRule_courtId_idx" ON "CourtPriceRule"("courtId");
CREATE INDEX IF NOT EXISTS "CourtPriceRule_clubId_idx" ON "CourtPriceRule"("clubId");
CREATE INDEX IF NOT EXISTS "CourtPriceRule_courtId_dayOfWeek_idx" ON "CourtPriceRule"("courtId", "dayOfWeek");

-- 3) AuditLog
CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" TEXT NOT NULL,
  "clubId" INTEGER NOT NULL,
  "userId" INTEGER,
  "entity" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "payload" JSONB,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AuditLog_clubId_fkey') THEN
    ALTER TABLE "AuditLog"
      ADD CONSTRAINT "AuditLog_clubId_fkey"
      FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AuditLog_userId_fkey') THEN
    ALTER TABLE "AuditLog"
      ADD CONSTRAINT "AuditLog_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "AuditLog_clubId_idx" ON "AuditLog"("clubId");
CREATE INDEX IF NOT EXISTS "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- 4) Event
CREATE TABLE IF NOT EXISTS "Event" (
  "id" TEXT NOT NULL,
  "clubId" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Event_clubId_fkey') THEN
    ALTER TABLE "Event"
      ADD CONSTRAINT "Event_clubId_fkey"
      FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Event_clubId_idx" ON "Event"("clubId");
CREATE INDEX IF NOT EXISTS "Event_type_idx" ON "Event"("type");

-- 5) ClubSettings
CREATE TABLE IF NOT EXISTS "ClubSettings" (
  "id" SERIAL PRIMARY KEY,
  "clubId" INTEGER NOT NULL,
  "timeZone" TEXT NOT NULL,
  "openingDays" JSONB,
  "lightsEnabled" BOOLEAN NOT NULL,
  "lightsExtraAmount" DOUBLE PRECISION,
  "lightsFromHour" INTEGER,
  "professorDiscountEnabled" BOOLEAN NOT NULL,
  "professorDiscountPercent" DOUBLE PRECISION,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClubSettings_clubId_key" ON "ClubSettings"("clubId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClubSettings_clubId_fkey') THEN
    ALTER TABLE "ClubSettings"
      ADD CONSTRAINT "ClubSettings_clubId_fkey"
      FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill ClubSettings from Club (safe + idempotent)
INSERT INTO "ClubSettings" (
  "clubId",
  "timeZone",
  "openingDays",
  "lightsEnabled",
  "lightsExtraAmount",
  "lightsFromHour",
  "professorDiscountEnabled",
  "professorDiscountPercent"
)
SELECT
  c."id",
  COALESCE(c."timeZone", 'America/Argentina/Buenos_Aires'),
  c."openingDays"::jsonb,
  COALESCE(c."lightsEnabled", false),
  c."lightsExtraAmount",
  CASE
    WHEN c."lightsFromHour" ~ '^\\d{1,2}(:\\d{2})?$' THEN split_part(c."lightsFromHour", ':', 1)::INTEGER
    ELSE NULL
  END,
  COALESCE(c."professorDiscountEnabled", false),
  c."professorDiscountPercent"
FROM "Club" c
WHERE NOT EXISTS (
  SELECT 1 FROM "ClubSettings" cs WHERE cs."clubId" = c."id"
);

-- 6) Notification improvements
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "status" TEXT;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMPTZ(3);

-- 7) Missing indexes
CREATE INDEX IF NOT EXISTS "Payment_clubId_createdAt_idx" ON "Payment"("clubId", "createdAt");
CREATE INDEX IF NOT EXISTS "Notification_clubId_createdAt_idx" ON "Notification"("clubId", "createdAt");

-- 8) Overlap protection with canonical name
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "booking_no_overlap_per_court";
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "booking_no_overlap";

ALTER TABLE "Booking"
ADD CONSTRAINT "booking_no_overlap"
EXCLUDE USING gist (
  "courtId" WITH =,
  tstzrange("startDateTime", "endDateTime") WITH &&
)
WHERE ("status" <> 'CANCELLED');
