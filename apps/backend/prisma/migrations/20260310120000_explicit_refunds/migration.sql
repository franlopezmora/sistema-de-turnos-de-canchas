DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'LedgerReferenceType' AND e.enumlabel = 'REFUND'
  ) THEN
    ALTER TYPE "LedgerReferenceType" ADD VALUE 'REFUND';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Refund" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "amount" DECIMAL(10,2) NOT NULL,
  "reason" TEXT,
  "paymentId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "clubId" INTEGER NOT NULL,
  "cashShiftId" TEXT,
  "createdByUserId" INTEGER,
  CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CashMovement" ADD COLUMN IF NOT EXISTS "refundId" TEXT;
ALTER TABLE "LedgerEntry" ADD COLUMN IF NOT EXISTS "refundId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CashMovement_refundId_key') THEN
    ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_refundId_key" UNIQUE ("refundId");
  END IF;
END $$;

ALTER TABLE "Refund"
  ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Refund_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Refund_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Refund_cashShiftId_fkey" FOREIGN KEY ("cashShiftId") REFERENCES "CashShift"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Refund_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CashMovement"
  ADD CONSTRAINT "CashMovement_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LedgerEntry"
  ADD CONSTRAINT "LedgerEntry_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Refund_paymentId_idx" ON "Refund"("paymentId");
CREATE INDEX IF NOT EXISTS "Refund_accountId_idx" ON "Refund"("accountId");
CREATE INDEX IF NOT EXISTS "Refund_clubId_createdAt_idx" ON "Refund"("clubId", "createdAt");
CREATE INDEX IF NOT EXISTS "Refund_cashShiftId_idx" ON "Refund"("cashShiftId");
CREATE INDEX IF NOT EXISTS "CashMovement_refundId_idx" ON "CashMovement"("refundId");
