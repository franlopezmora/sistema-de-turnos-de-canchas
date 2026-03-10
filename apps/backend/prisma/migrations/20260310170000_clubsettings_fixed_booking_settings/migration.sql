DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ClubSettings'
      AND column_name = 'fixedBookingSettingsByActivity'
  ) THEN
    ALTER TABLE "ClubSettings"
      ADD COLUMN "fixedBookingSettingsByActivity" JSONB;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Club'
      AND column_name = 'fixedBookingSettingsByActivity'
  ) THEN
    UPDATE "ClubSettings" cs
    SET "fixedBookingSettingsByActivity" = c."fixedBookingSettingsByActivity"
    FROM "Club" c
    WHERE c."id" = cs."clubId"
      AND cs."fixedBookingSettingsByActivity" IS NULL
      AND c."fixedBookingSettingsByActivity" IS NOT NULL;
  END IF;
END $$;
