-- 1) Nuevos tipos/columnas
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FixedBookingStatus') THEN
    CREATE TYPE "FixedBookingStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED');
  END IF;
END $$;

ALTER TABLE "ActivityType" ADD COLUMN IF NOT EXISTS "clubId" INTEGER;
ALTER TABLE "ActivityType" ADD COLUMN IF NOT EXISTS "scheduleMode" "ScheduleMode" DEFAULT 'FIXED';
ALTER TABLE "ActivityType" ADD COLUMN IF NOT EXISTS "scheduleOpenTime" TEXT;
ALTER TABLE "ActivityType" ADD COLUMN IF NOT EXISTS "scheduleCloseTime" TEXT;
ALTER TABLE "ActivityType" ADD COLUMN IF NOT EXISTS "scheduleIntervalMinutes" INTEGER;
ALTER TABLE "ActivityType" ADD COLUMN IF NOT EXISTS "scheduleDurations" JSON;
ALTER TABLE "ActivityType" ADD COLUMN IF NOT EXISTS "scheduleFixedSlots" JSON;

ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "clubId" INTEGER;
ALTER TABLE "FixedBooking" ADD COLUMN IF NOT EXISTS "startTimeMinutes" INTEGER;
ALTER TABLE "FixedBooking" ADD COLUMN IF NOT EXISTS "endTimeMinutes" INTEGER;

-- 2) Conversión de tiempos FixedBooking (String -> minutos)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'FixedBooking' AND column_name = 'startTime'
  ) THEN
    UPDATE "FixedBooking"
    SET "startTimeMinutes" = split_part("startTime", ':', 1)::INTEGER * 60 + split_part("startTime", ':', 2)::INTEGER
    WHERE "startTimeMinutes" IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'FixedBooking' AND column_name = 'endTime'
  ) THEN
    UPDATE "FixedBooking"
    SET "endTimeMinutes" = split_part("endTime", ':', 1)::INTEGER * 60 + split_part("endTime", ':', 2)::INTEGER
    WHERE "endTimeMinutes" IS NULL;
  END IF;
END $$;

-- 3) Conversión de estado FixedBooking (String -> enum)
DO $$
DECLARE
  status_udt TEXT;
BEGIN
  SELECT c.udt_name INTO status_udt
  FROM information_schema.columns c
  WHERE c.table_name = 'FixedBooking' AND c.column_name = 'status';

  IF status_udt IS NOT NULL AND status_udt <> 'FixedBookingStatus' THEN
    ALTER TABLE "FixedBooking" ADD COLUMN IF NOT EXISTS "status_new" "FixedBookingStatus";

    UPDATE "FixedBooking"
    SET "status_new" = (
      CASE UPPER(COALESCE("status"::TEXT, 'ACTIVE'))
        WHEN 'ACTIVE' THEN 'ACTIVE'
        WHEN 'PAUSED' THEN 'PAUSED'
        WHEN 'CANCELLED' THEN 'CANCELLED'
        ELSE 'ACTIVE'
      END
    )::"FixedBookingStatus";

    ALTER TABLE "FixedBooking" DROP COLUMN "status";
    ALTER TABLE "FixedBooking" RENAME COLUMN "status_new" TO "status";
  END IF;
END $$;

-- 4) Backfill ActivityType por club (clonado por club cuando era global)
CREATE TEMP TABLE IF NOT EXISTS "_tmp_activity_map" (
  "old_activity_id" INTEGER NOT NULL,
  "clubId" INTEGER NOT NULL,
  "new_activity_id" INTEGER NOT NULL
) ON COMMIT DROP;

TRUNCATE TABLE "_tmp_activity_map";

DO $$
DECLARE
  rec RECORD;
  new_id INTEGER;
BEGIN
  FOR rec IN
    WITH source_pairs AS (
      SELECT DISTINCT c."activityTypeId" AS old_activity_id, c."clubId"
      FROM "Court" c
      WHERE c."activityTypeId" IS NOT NULL

      UNION

      SELECT DISTINCT b."activityId" AS old_activity_id, c."clubId"
      FROM "Booking" b
      JOIN "Court" c ON c."id" = b."courtId"

      UNION

      SELECT DISTINCT fb."activityId" AS old_activity_id, c."clubId"
      FROM "FixedBooking" fb
      JOIN "Court" c ON c."id" = fb."courtId"
    )
    SELECT sp.old_activity_id, sp."clubId"
    FROM source_pairs sp
  LOOP
    INSERT INTO "ActivityType" (
      "name",
      "description",
      "defaultDurationMinutes",
      "clubId",
      "scheduleMode",
      "scheduleOpenTime",
      "scheduleCloseTime",
      "scheduleIntervalMinutes",
      "scheduleDurations",
      "scheduleFixedSlots"
    )
    SELECT
      at."name",
      at."description",
      at."defaultDurationMinutes",
      rec."clubId",
      COALESCE(cl."scheduleMode", 'FIXED'::"ScheduleMode"),
      cl."scheduleOpenTime",
      cl."scheduleCloseTime",
      cl."scheduleIntervalMinutes",
      cl."scheduleDurations",
      CASE
        WHEN cl."scheduleMode" = 'FIXED'::"ScheduleMode" THEN
          CASE
            WHEN cl."scheduleFixedSlots" IS NOT NULL THEN
              (
                SELECT json_agg(json_build_object('start', value::TEXT, 'duration', at."defaultDurationMinutes"))
                FROM json_array_elements_text(cl."scheduleFixedSlots")
              )
            ELSE
              json_build_array(json_build_object('start', '08:00', 'duration', at."defaultDurationMinutes"))
          END
        ELSE NULL
      END
    FROM "ActivityType" at
    LEFT JOIN "Club" cl ON cl."id" = rec."clubId"
    WHERE at."id" = rec.old_activity_id
    RETURNING "id" INTO new_id;

    INSERT INTO "_tmp_activity_map"("old_activity_id", "clubId", "new_activity_id")
    VALUES (rec.old_activity_id, rec."clubId", new_id);
  END LOOP;
END $$;

-- 5) Rewire relaciones a ActivityType clonado por club
UPDATE "Court" c
SET "activityTypeId" = m."new_activity_id"
FROM "_tmp_activity_map" m
WHERE c."activityTypeId" = m."old_activity_id"
  AND c."clubId" = m."clubId";

UPDATE "Booking" b
SET
  "activityId" = m."new_activity_id",
  "clubId" = c."clubId"
FROM "Court" c
JOIN "_tmp_activity_map" m
  ON m."old_activity_id" = b."activityId"
 AND m."clubId" = c."clubId"
WHERE b."courtId" = c."id";

UPDATE "Booking" b
SET "clubId" = c."clubId"
FROM "Court" c
WHERE b."courtId" = c."id"
  AND b."clubId" IS NULL;

UPDATE "FixedBooking" fb
SET "activityId" = m."new_activity_id"
FROM "Court" c
JOIN "_tmp_activity_map" m
  ON m."old_activity_id" = fb."activityId"
 AND m."clubId" = c."clubId"
WHERE fb."courtId" = c."id";

-- 6) Limpiar ActivityType global viejo clonado
DELETE FROM "ActivityType" at
USING (
  SELECT DISTINCT "old_activity_id" FROM "_tmp_activity_map"
) old_ids
WHERE at."id" = old_ids."old_activity_id";

-- 7) Fallbacks para no romper existentes
UPDATE "ActivityType"
SET "clubId" = (
  SELECT c."id" FROM "Club" c ORDER BY c."id" ASC LIMIT 1
)
WHERE "clubId" IS NULL;

UPDATE "ActivityType"
SET "scheduleMode" = COALESCE("scheduleMode", 'FIXED'::"ScheduleMode");

UPDATE "ActivityType"
SET "scheduleDurations" = to_json(ARRAY["defaultDurationMinutes"])
WHERE "scheduleDurations" IS NULL;

UPDATE "ActivityType"
SET "scheduleFixedSlots" = json_build_array(json_build_object('start', '08:00', 'duration', "defaultDurationMinutes"))
WHERE "scheduleMode" = 'FIXED'::"ScheduleMode"
  AND "scheduleFixedSlots" IS NULL;

-- 8) Constraints e índices nuevos
ALTER TABLE "ActivityType" ALTER COLUMN "clubId" SET NOT NULL;
ALTER TABLE "Booking" ALTER COLUMN "clubId" SET NOT NULL;
ALTER TABLE "FixedBooking" ALTER COLUMN "startTimeMinutes" SET NOT NULL;
ALTER TABLE "FixedBooking" ALTER COLUMN "endTimeMinutes" SET NOT NULL;
ALTER TABLE "FixedBooking" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "FixedBooking" ALTER COLUMN "status" SET DEFAULT 'ACTIVE'::"FixedBookingStatus";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ActivityType_clubId_fkey'
  ) THEN
    ALTER TABLE "ActivityType"
      ADD CONSTRAINT "ActivityType_clubId_fkey"
      FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Booking_clubId_fkey'
  ) THEN
    ALTER TABLE "Booking"
      ADD CONSTRAINT "Booking_clubId_fkey"
      FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ActivityType_clubId_idx" ON "ActivityType"("clubId");
CREATE INDEX IF NOT EXISTS "Booking_courtId_endDateTime_idx" ON "Booking"("courtId", "endDateTime");
CREATE INDEX IF NOT EXISTS "Booking_clubId_startDateTime_idx" ON "Booking"("clubId", "startDateTime");

-- 9) Eliminar columnas obsoletas de Club y FixedBooking
ALTER TABLE "Club" DROP COLUMN IF EXISTS "scheduleMode";
ALTER TABLE "Club" DROP COLUMN IF EXISTS "scheduleOpenTime";
ALTER TABLE "Club" DROP COLUMN IF EXISTS "scheduleCloseTime";
ALTER TABLE "Club" DROP COLUMN IF EXISTS "scheduleIntervalMinutes";
ALTER TABLE "Club" DROP COLUMN IF EXISTS "scheduleDurations";
ALTER TABLE "Club" DROP COLUMN IF EXISTS "scheduleFixedSlots";

ALTER TABLE "FixedBooking" DROP COLUMN IF EXISTS "startTime";
ALTER TABLE "FixedBooking" DROP COLUMN IF EXISTS "endTime";
