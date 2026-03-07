-- Accounting rearchitecture: Account -> AccountItem -> Payment -> CashMovement

DO $$ BEGIN
  CREATE TYPE "AccountSource" AS ENUM ('BAR', 'BOOKING', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "AccountStatus" AS ENUM ('OPEN', 'CLOSED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "Account" (
  "id" TEXT NOT NULL,
  "clubId" INTEGER NOT NULL,
  "bookingId" INTEGER,
  "customerName" TEXT,
  "source" "AccountSource" NOT NULL,
  "status" "AccountStatus" NOT NULL DEFAULT 'OPEN',
  "totalAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "openedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Account_bookingId_key" ON "Account"("bookingId");
CREATE INDEX IF NOT EXISTS "Account_clubId_idx" ON "Account"("clubId");
CREATE INDEX IF NOT EXISTS "Account_status_openedAt_idx" ON "Account"("status", "openedAt");

CREATE TABLE IF NOT EXISTS "AccountItem" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "productId" INTEGER,
  "description" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" DECIMAL(10,2) NOT NULL,
  "totalPrice" DECIMAL(10,2) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AccountItem_accountId_idx" ON "AccountItem"("accountId");
CREATE INDEX IF NOT EXISTS "AccountItem_productId_idx" ON "AccountItem"("productId");

ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "accountId" TEXT;

ALTER TABLE "CashMovement"
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "concept" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "CashMovement_paymentId_key" ON "CashMovement"("paymentId");
CREATE INDEX IF NOT EXISTS "CashMovement_paymentId_idx" ON "CashMovement"("paymentId");
CREATE INDEX IF NOT EXISTS "Payment_accountId_idx" ON "Payment"("accountId");

DO $$ BEGIN
  ALTER TABLE "Account"
    ADD CONSTRAINT "Account_clubId_fkey"
    FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Account"
    ADD CONSTRAINT "Account_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "AccountItem"
    ADD CONSTRAINT "AccountItem_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "AccountItem"
    ADD CONSTRAINT "AccountItem_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Payment"
    ADD CONSTRAINT "Payment_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CashMovement"
    ADD CONSTRAINT "CashMovement_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
