-- Ledger + POS foundation

DO $$ BEGIN
  CREATE TYPE "LedgerEntryType" AS ENUM ('ACCOUNT_ITEM', 'PAYMENT', 'REFUND', 'ADJUSTMENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "LedgerReferenceType" AS ENUM ('ACCOUNT', 'ACCOUNT_ITEM', 'PAYMENT', 'BOOKING', 'MANUAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "LedgerDirection" AS ENUM ('DEBIT', 'CREDIT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "CashShiftStatus" AS ENUM ('OPEN', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "CashMovementPosType" AS ENUM ('PAYMENT_IN', 'REFUND', 'WITHDRAW', 'DEPOSIT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "CashRegister" (
  "id" TEXT PRIMARY KEY,
  "clubId" INTEGER NOT NULL REFERENCES "Club"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "location" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "CashShift" (
  "id" TEXT PRIMARY KEY,
  "cashRegisterId" TEXT NOT NULL REFERENCES "CashRegister"("id") ON DELETE CASCADE,
  "openedByUserId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "openedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  "closedAt" TIMESTAMPTZ(3),
  "openingAmount" DECIMAL(10,2) NOT NULL,
  "expectedCash" DECIMAL(10,2),
  "countedCash" DECIMAL(10,2),
  "difference" DECIMAL(10,2),
  "status" "CashShiftStatus" NOT NULL DEFAULT 'OPEN'
);

CREATE TABLE IF NOT EXISTS "LedgerEntry" (
  "id" TEXT PRIMARY KEY,
  "clubId" INTEGER NOT NULL REFERENCES "Club"("id") ON DELETE RESTRICT,
  "type" "LedgerEntryType" NOT NULL,
  "referenceType" "LedgerReferenceType" NOT NULL,
  "referenceId" TEXT NOT NULL,
  "accountId" TEXT REFERENCES "Account"("id") ON DELETE SET NULL,
  "accountItemId" TEXT REFERENCES "AccountItem"("id") ON DELETE SET NULL,
  "paymentId" TEXT REFERENCES "Payment"("id") ON DELETE SET NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "direction" "LedgerDirection" NOT NULL,
  "description" TEXT NOT NULL,
  "createdByUserId" INTEGER REFERENCES "User"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW()
);

ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "cashShiftId" TEXT;
ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_cashShiftId_fkey"
  FOREIGN KEY ("cashShiftId") REFERENCES "CashShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CashMovement" ADD COLUMN IF NOT EXISTS "cashShiftId" TEXT;
ALTER TABLE "CashMovement" ADD COLUMN IF NOT EXISTS "createdByUserId" INTEGER;

ALTER TABLE "CashMovement"
  ADD CONSTRAINT "CashMovement_cashShiftId_fkey"
  FOREIGN KEY ("cashShiftId") REFERENCES "CashShift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CashMovement"
  ADD CONSTRAINT "CashMovement_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Map old enum values to POS types before cast
ALTER TABLE "CashMovement" ALTER COLUMN "type" TYPE TEXT;
UPDATE "CashMovement" SET "type" = 'PAYMENT_IN' WHERE "type" IN ('IN', 'INCOME');
UPDATE "CashMovement" SET "type" = 'WITHDRAW' WHERE "type" NOT IN ('PAYMENT_IN');
ALTER TABLE "CashMovement" ALTER COLUMN "type" TYPE "CashMovementPosType" USING "type"::"CashMovementPosType";

-- ensure required shift value exists (single synthetic shift per club for historical rows)
INSERT INTO "CashRegister" ("id", "clubId", "name", "location", "createdAt")
SELECT CONCAT('legacy-register-', c."id"), c."id", 'Legacy', 'Migrado', NOW()
FROM "Club" c
WHERE NOT EXISTS (
  SELECT 1 FROM "CashRegister" cr WHERE cr."clubId" = c."id"
);

INSERT INTO "CashShift" ("id", "cashRegisterId", "openedByUserId", "openedAt", "openingAmount", "status")
SELECT CONCAT('legacy-shift-', c."id"), CONCAT('legacy-register-', c."id"), 1, NOW(), 0, 'OPEN'::"CashShiftStatus"
FROM "Club" c
WHERE NOT EXISTS (
  SELECT 1 FROM "CashShift" cs WHERE cs."cashRegisterId" = CONCAT('legacy-register-', c."id")
)
AND EXISTS (SELECT 1 FROM "User" u WHERE u."id" = 1);

UPDATE "CashMovement" cm
SET "cashShiftId" = CONCAT('legacy-shift-', cm."clubId")
WHERE cm."cashShiftId" IS NULL;

ALTER TABLE "CashMovement" ALTER COLUMN "cashShiftId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "CashRegister_clubId_idx" ON "CashRegister"("clubId");
CREATE INDEX IF NOT EXISTS "CashShift_cashRegisterId_status_idx" ON "CashShift"("cashRegisterId", "status");
CREATE INDEX IF NOT EXISTS "CashShift_openedAt_idx" ON "CashShift"("openedAt");
CREATE INDEX IF NOT EXISTS "Payment_cashShiftId_idx" ON "Payment"("cashShiftId");
CREATE INDEX IF NOT EXISTS "CashMovement_cashShiftId_idx" ON "CashMovement"("cashShiftId");
CREATE INDEX IF NOT EXISTS "LedgerEntry_clubId_createdAt_idx" ON "LedgerEntry"("clubId", "createdAt");
CREATE INDEX IF NOT EXISTS "LedgerEntry_accountId_createdAt_idx" ON "LedgerEntry"("accountId", "createdAt");
CREATE INDEX IF NOT EXISTS "LedgerEntry_referenceType_referenceId_idx" ON "LedgerEntry"("referenceType", "referenceId");
