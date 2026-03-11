-- Add strict cash-shift close policy in club settings
ALTER TABLE "ClubSettings"
ADD COLUMN IF NOT EXISTS "enforceCashShiftCloseWithOpenAccounts" BOOLEAN NOT NULL DEFAULT false;
