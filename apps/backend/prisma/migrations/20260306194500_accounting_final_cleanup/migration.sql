-- Limpieza contable final (irreversible)

-- Enums nuevos
DO $$
BEGIN
  CREATE TYPE "AccountItemType" AS ENUM ('BOOKING', 'PRODUCT', 'SERVICE', 'ADJUSTMENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TRANSFER', 'CARD', 'MERCADO_PAGO', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "CashMovementType" AS ENUM ('IN', 'OUT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "CashMovementMethod" AS ENUM ('CASH', 'TRANSFER', 'CARD', 'MP');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Extensión de AccountSource
DO $$
BEGIN
  ALTER TYPE "AccountSource" ADD VALUE IF NOT EXISTS 'TABLE';
  ALTER TYPE "AccountSource" ADD VALUE IF NOT EXISTS 'MANUAL';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Legacy Booking financiero
ALTER TABLE "Booking" DROP COLUMN IF EXISTS "paymentStatus";

-- BookingItem fuera
DROP TABLE IF EXISTS "BookingItem";

-- Account simplificada
ALTER TABLE "Account" DROP CONSTRAINT IF EXISTS "Account_bookingId_fkey";
DROP INDEX IF EXISTS "Account_bookingId_key";
ALTER TABLE "Account" DROP COLUMN IF EXISTS "bookingId";
ALTER TABLE "Account" DROP COLUMN IF EXISTS "customerName";
ALTER TABLE "Account" DROP COLUMN IF EXISTS "totalAmount";
ALTER TABLE "Account" DROP COLUMN IF EXISTS "openedAt";
ALTER TABLE "Account" DROP COLUMN IF EXISTS "updatedAt";
ALTER TABLE "Account" RENAME COLUMN "source" TO "sourceType";
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "sourceId" TEXT;
UPDATE "Account" SET "sourceId" = COALESCE("sourceId", id::text);
ALTER TABLE "Account" ALTER COLUMN "sourceId" SET NOT NULL;

-- AccountItem simplificada
ALTER TABLE "AccountItem" DROP CONSTRAINT IF EXISTS "AccountItem_productId_fkey";
ALTER TABLE "AccountItem" DROP COLUMN IF EXISTS "productId";
ALTER TABLE "AccountItem" ADD COLUMN IF NOT EXISTS "type" "AccountItemType";
UPDATE "AccountItem" SET "type" = 'PRODUCT' WHERE "type" IS NULL;
ALTER TABLE "AccountItem" ALTER COLUMN "type" SET NOT NULL;
ALTER TABLE "AccountItem" RENAME COLUMN "totalPrice" TO "total";

-- Payment simplificada
ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_bookingId_fkey";
ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_userId_fkey";
ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_clubId_fkey";
ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_accountId_fkey";

DROP INDEX IF EXISTS "Payment_clubId_idx";
DROP INDEX IF EXISTS "Payment_clubId_createdAt_idx";
DROP INDEX IF EXISTS "Payment_bookingId_idx";
DROP INDEX IF EXISTS "Payment_userId_idx";

ALTER TABLE "Payment" DROP COLUMN IF EXISTS "bookingId";
ALTER TABLE "Payment" DROP COLUMN IF EXISTS "userId";
ALTER TABLE "Payment" DROP COLUMN IF EXISTS "clubId";
ALTER TABLE "Payment" DROP COLUMN IF EXISTS "status";

ALTER TABLE "Payment" ALTER COLUMN "accountId" SET NOT NULL;
ALTER TABLE "Payment" ALTER COLUMN "method" TYPE "PaymentMethod" USING
  CASE
    WHEN UPPER("method") IN ('CASH') THEN 'CASH'::"PaymentMethod"
    WHEN UPPER("method") IN ('TRANSFER') THEN 'TRANSFER'::"PaymentMethod"
    WHEN UPPER("method") IN ('CARD') THEN 'CARD'::"PaymentMethod"
    WHEN UPPER("method") IN ('MERCADOPAGO', 'MERCADO_PAGO', 'MP') THEN 'MERCADO_PAGO'::"PaymentMethod"
    ELSE 'OTHER'::"PaymentMethod"
  END;

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CashMovement simplificada
ALTER TABLE "CashMovement" DROP CONSTRAINT IF EXISTS "CashMovement_bookingId_fkey";
ALTER TABLE "CashMovement" DROP CONSTRAINT IF EXISTS "CashMovement_userId_fkey";
DROP INDEX IF EXISTS "CashMovement_clubId_date_idx";
DROP INDEX IF EXISTS "CashMovement_clubId_userId_idx";

ALTER TABLE "CashMovement" DROP COLUMN IF EXISTS "date";
ALTER TABLE "CashMovement" DROP COLUMN IF EXISTS "description";
ALTER TABLE "CashMovement" DROP COLUMN IF EXISTS "bookingId";
ALTER TABLE "CashMovement" DROP COLUMN IF EXISTS "userId";
ALTER TABLE "CashMovement" DROP COLUMN IF EXISTS "guestName";
ALTER TABLE "CashMovement" DROP COLUMN IF EXISTS "guestPhone";
ALTER TABLE "CashMovement" DROP COLUMN IF EXISTS "guestDni";
ALTER TABLE "CashMovement" DROP COLUMN IF EXISTS "isSettled";

ALTER TABLE "CashMovement" ALTER COLUMN "type" TYPE "CashMovementType" USING
  CASE
    WHEN UPPER("type") IN ('IN', 'INCOME') THEN 'IN'::"CashMovementType"
    ELSE 'OUT'::"CashMovementType"
  END;

ALTER TABLE "CashMovement" ALTER COLUMN "method" TYPE "CashMovementMethod" USING
  CASE
    WHEN UPPER("method") = 'CASH' THEN 'CASH'::"CashMovementMethod"
    WHEN UPPER("method") = 'TRANSFER' THEN 'TRANSFER'::"CashMovementMethod"
    WHEN UPPER("method") = 'CARD' THEN 'CARD'::"CashMovementMethod"
    ELSE 'MP'::"CashMovementMethod"
  END;

ALTER TABLE "CashMovement" ALTER COLUMN "amount" TYPE DECIMAL(10,2) USING "amount"::DECIMAL(10,2);
ALTER TABLE "CashMovement" ALTER COLUMN "concept" SET NOT NULL;

-- Índices nuevos
CREATE INDEX IF NOT EXISTS "Account_sourceType_sourceId_idx" ON "Account"("sourceType", "sourceId");
CREATE INDEX IF NOT EXISTS "Account_status_createdAt_idx" ON "Account"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "CashMovement_clubId_createdAt_idx" ON "CashMovement"("clubId", "createdAt");
