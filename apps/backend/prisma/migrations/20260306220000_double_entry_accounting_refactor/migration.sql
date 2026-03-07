-- Double-entry accounting refactor

DO $$ BEGIN
  CREATE TYPE "PaymentSource" AS ENUM ('POS', 'ONLINE', 'BACKOFFICE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "LedgerAccount" AS ENUM (
    'CASH',
    'BANK',
    'CARD_CLEARING',
    'ONLINE_GATEWAY',
    'ACCOUNTS_RECEIVABLE',
    'BOOKING_REVENUE',
    'BAR_REVENUE',
    'ADJUSTMENTS',
    'EXPENSE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "Account"
  ADD COLUMN IF NOT EXISTS "totalAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "paidAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;

ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "source" "PaymentSource" NOT NULL DEFAULT 'POS';

CREATE TABLE IF NOT EXISTS "LedgerTransaction" (
  "id" TEXT PRIMARY KEY,
  "clubId" INTEGER NOT NULL REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "type" "LedgerEntryType" NOT NULL,
  "referenceType" "LedgerReferenceType" NOT NULL,
  "referenceId" TEXT NOT NULL,
  "createdByUserId" INTEGER REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW()
);

ALTER TABLE "LedgerEntry" ADD COLUMN IF NOT EXISTS "transactionId" TEXT;
ALTER TABLE "LedgerEntry" ADD COLUMN IF NOT EXISTS "account" "LedgerAccount";

INSERT INTO "LedgerTransaction" (
  "id", "clubId", "type", "referenceType", "referenceId", "createdByUserId", "createdAt"
)
SELECT
  CONCAT('legacy-tx-', le."id"),
  le."clubId",
  le."type",
  le."referenceType",
  le."referenceId",
  le."createdByUserId",
  le."createdAt"
FROM "LedgerEntry" le
LEFT JOIN "LedgerTransaction" lt ON lt."id" = CONCAT('legacy-tx-', le."id")
WHERE lt."id" IS NULL;

UPDATE "LedgerEntry" le
SET "transactionId" = CONCAT('legacy-tx-', le."id")
WHERE le."transactionId" IS NULL;

UPDATE "LedgerEntry" le
SET "account" = CASE
  WHEN le."type" = 'ACCOUNT_ITEM' AND le."direction" = 'DEBIT' THEN 'ACCOUNTS_RECEIVABLE'::"LedgerAccount"
  WHEN le."type" = 'ACCOUNT_ITEM' AND le."direction" = 'CREDIT' THEN 'BAR_REVENUE'::"LedgerAccount"
  WHEN le."type" = 'PAYMENT' AND le."direction" = 'CREDIT' THEN 'ACCOUNTS_RECEIVABLE'::"LedgerAccount"
  WHEN le."type" = 'PAYMENT' AND le."direction" = 'DEBIT' THEN 'CASH'::"LedgerAccount"
  ELSE 'ADJUSTMENTS'::"LedgerAccount"
END
WHERE le."account" IS NULL;

ALTER TABLE "LedgerEntry" ALTER COLUMN "transactionId" SET NOT NULL;
ALTER TABLE "LedgerEntry" ALTER COLUMN "account" SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE "LedgerEntry"
    ADD CONSTRAINT "LedgerEntry_transactionId_fkey"
    FOREIGN KEY ("transactionId") REFERENCES "LedgerTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

UPDATE "Account" a
SET "totalAmount" = COALESCE(items.total_amount, 0)
FROM (
  SELECT ai."accountId", SUM(ai."total")::DECIMAL(10,2) AS total_amount
  FROM "AccountItem" ai
  GROUP BY ai."accountId"
) items
WHERE items."accountId" = a."id";

UPDATE "Account" a
SET "paidAmount" = COALESCE(payments.paid_amount, 0)
FROM (
  SELECT p."accountId", SUM(p."amount")::DECIMAL(10,2) AS paid_amount
  FROM "Payment" p
  GROUP BY p."accountId"
) payments
WHERE payments."accountId" = a."id";

UPDATE "Account"
SET "status" = 'CLOSED',
    "closedAt" = COALESCE("closedAt", NOW())
WHERE "status" = 'OPEN'
  AND "paidAmount" >= "totalAmount";

CREATE INDEX IF NOT EXISTS "Payment_source_idx" ON "Payment"("source");
CREATE INDEX IF NOT EXISTS "LedgerTransaction_clubId_createdAt_idx" ON "LedgerTransaction"("clubId", "createdAt");
CREATE INDEX IF NOT EXISTS "LedgerTransaction_referenceType_referenceId_idx" ON "LedgerTransaction"("referenceType", "referenceId");
CREATE INDEX IF NOT EXISTS "LedgerEntry_transactionId_idx" ON "LedgerEntry"("transactionId");
CREATE INDEX IF NOT EXISTS "LedgerEntry_account_createdAt_idx" ON "LedgerEntry"("account", "createdAt");
