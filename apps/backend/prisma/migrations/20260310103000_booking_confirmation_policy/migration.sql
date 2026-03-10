DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BookingConfirmationMode') THEN
    CREATE TYPE "BookingConfirmationMode" AS ENUM ('AUTOMATIC', 'MANUAL', 'DEPOSIT_REQUIRED');
  END IF;
END $$;

ALTER TABLE "ClubSettings"
  ADD COLUMN IF NOT EXISTS "bookingConfirmationMode" "BookingConfirmationMode" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS "bookingDepositPercent" DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS "allowManualConfirmationOverride" BOOLEAN NOT NULL DEFAULT true;
