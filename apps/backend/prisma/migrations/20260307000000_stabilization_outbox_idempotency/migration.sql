DO $$
BEGIN
  CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Payment_idempotencyKey_key"
  ON "Payment"("idempotencyKey");

CREATE INDEX IF NOT EXISTS "Payment_idempotencyKey_idx"
  ON "Payment"("idempotencyKey");

CREATE TABLE IF NOT EXISTS "OutboxMessage" (
  "id" TEXT PRIMARY KEY,
  "clubId" INTEGER NOT NULL REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "type" TEXT NOT NULL,
  "aggregateType" TEXT,
  "aggregateId" TEXT,
  "payload" JSONB NOT NULL,
  "dedupeKey" TEXT,
  "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "availableAt" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  "claimedAt" TIMESTAMPTZ(3),
  "claimedBy" TEXT,
  "processedAt" TIMESTAMPTZ(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "OutboxMessage_dedupeKey_key"
  ON "OutboxMessage"("dedupeKey");

CREATE INDEX IF NOT EXISTS "OutboxMessage_clubId_createdAt_idx"
  ON "OutboxMessage"("clubId", "createdAt");

CREATE INDEX IF NOT EXISTS "OutboxMessage_type_status_idx"
  ON "OutboxMessage"("type", "status");

CREATE INDEX IF NOT EXISTS "OutboxMessage_status_availableAt_createdAt_idx"
  ON "OutboxMessage"("status", "availableAt", "createdAt");
