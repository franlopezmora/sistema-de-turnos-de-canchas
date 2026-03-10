ALTER TABLE "ClubSettings"
  ADD COLUMN IF NOT EXISTS "autoCancelPendingBookingsEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "autoCancelPendingBookingsMinutesBefore" INTEGER,
  ADD COLUMN IF NOT EXISTS "autoCancelPendingBookingsOnlyIfUnpaid" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "autoCancelPendingWarningEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "autoCancelPendingWarningMinutesBefore" INTEGER;

ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "autoCancelWarningSentAt" TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS "autoCancelledAt" TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS "autoCancelReason" TEXT;

CREATE INDEX IF NOT EXISTS "booking_pending_autocancel_idx"
  ON "Booking"("status", "startDateTime", "autoCancelledAt");

ALTER TABLE "ClubSettings"
  DROP CONSTRAINT IF EXISTS "club_settings_autocancel_minutes_valid";
ALTER TABLE "ClubSettings"
  ADD CONSTRAINT "club_settings_autocancel_minutes_valid"
  CHECK (
    (NOT "autoCancelPendingBookingsEnabled")
    OR (
      "autoCancelPendingBookingsMinutesBefore" IS NOT NULL
      AND "autoCancelPendingBookingsMinutesBefore" > 0
    )
  );

ALTER TABLE "ClubSettings"
  DROP CONSTRAINT IF EXISTS "club_settings_autowarning_minutes_valid";
ALTER TABLE "ClubSettings"
  ADD CONSTRAINT "club_settings_autowarning_minutes_valid"
  CHECK (
    (NOT "autoCancelPendingWarningEnabled")
    OR (
      "autoCancelPendingWarningMinutesBefore" IS NOT NULL
      AND "autoCancelPendingWarningMinutesBefore" > 0
    )
  );

ALTER TABLE "ClubSettings"
  DROP CONSTRAINT IF EXISTS "club_settings_warning_before_cancel";
ALTER TABLE "ClubSettings"
  ADD CONSTRAINT "club_settings_warning_before_cancel"
  CHECK (
    NOT (
      "autoCancelPendingBookingsEnabled"
      AND "autoCancelPendingWarningEnabled"
      AND "autoCancelPendingBookingsMinutesBefore" IS NOT NULL
      AND "autoCancelPendingWarningMinutesBefore" IS NOT NULL
      AND "autoCancelPendingWarningMinutesBefore" <= "autoCancelPendingBookingsMinutesBefore"
    )
  );
