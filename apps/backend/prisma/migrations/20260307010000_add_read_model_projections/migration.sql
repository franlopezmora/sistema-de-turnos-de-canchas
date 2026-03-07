CREATE TABLE IF NOT EXISTS "AccountSummaryProjection" (
  "accountId" TEXT PRIMARY KEY,
  "clubId" INTEGER NOT NULL,
  "sourceType" "AccountSource" NOT NULL,
  "sourceId" TEXT NOT NULL,
  "status" "AccountStatus" NOT NULL,
  "totalAmount" DECIMAL(10,2) NOT NULL,
  "paidAmount" DECIMAL(10,2) NOT NULL,
  "remaining" DECIMAL(10,2) NOT NULL,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "AccountSummaryProjection_clubId_status_idx"
  ON "AccountSummaryProjection"("clubId", "status");

CREATE INDEX IF NOT EXISTS "AccountSummaryProjection_clubId_updatedAt_idx"
  ON "AccountSummaryProjection"("clubId", "updatedAt");

CREATE TABLE IF NOT EXISTS "CashShiftSummaryProjection" (
  "shiftId" TEXT PRIMARY KEY,
  "clubId" INTEGER NOT NULL,
  "cashRegisterId" TEXT NOT NULL,
  "status" "CashShiftStatus" NOT NULL,
  "openingAmount" DECIMAL(10,2) NOT NULL,
  "expectedCash" DECIMAL(10,2),
  "countedCash" DECIMAL(10,2),
  "difference" DECIMAL(10,2),
  "paymentIn" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "deposit" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "withdraw" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "refund" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "CashShiftSummaryProjection_clubId_status_idx"
  ON "CashShiftSummaryProjection"("clubId", "status");

CREATE INDEX IF NOT EXISTS "CashShiftSummaryProjection_clubId_updatedAt_idx"
  ON "CashShiftSummaryProjection"("clubId", "updatedAt");

CREATE TABLE IF NOT EXISTS "DailyCashSummaryProjection" (
  "clubId" INTEGER NOT NULL,
  "day" DATE NOT NULL,
  "cashIn" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "cashOut" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "netCash" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("clubId", "day")
);

CREATE INDEX IF NOT EXISTS "DailyCashSummaryProjection_day_idx"
  ON "DailyCashSummaryProjection"("day");
