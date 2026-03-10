-- INICIO: migración 20260309193000_payment_idempotency_scoped
DROP INDEX IF EXISTS "Payment_idempotencyKey_key";

CREATE UNIQUE INDEX IF NOT EXISTS "Payment_accountId_idempotencyKey_key"
ON "Payment"("accountId", "idempotencyKey")
WHERE "idempotencyKey" IS NOT NULL;
-- FIN: migración 20260309193000_payment_idempotency_scoped

-- INICIO: migración 20260309193500_validate_account_constraints
ALTER TABLE "Account" VALIDATE CONSTRAINT account_amounts_non_negative;
ALTER TABLE "Account" VALIDATE CONSTRAINT account_remaining_non_negative;
-- FIN: migración 20260309193500_validate_account_constraints

-- INICIO: migración 20260310010000_booking_client_unique_fixes
-- Remove strict unique start-time constraint so cancelled bookings can be recreated.
DROP INDEX IF EXISTS "booking_court_start_unique";

-- Enforce client uniqueness by club on email/phone.
CREATE UNIQUE INDEX IF NOT EXISTS "Client_clubId_email_key"
ON "Client"("clubId", "email");

CREATE UNIQUE INDEX IF NOT EXISTS "Client_clubId_phone_key"
ON "Client"("clubId", "phone");
-- FIN: migración 20260310010000_booking_client_unique_fixes

-- INICIO: migración 20260310190000_product_stock_idempotency
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_stock_non_negative'
  ) THEN
    ALTER TABLE "Product"
      ADD CONSTRAINT product_stock_non_negative CHECK (stock >= 0);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "Account_clubId_idempotencyKey_key"
  ON "Account"("clubId", "idempotencyKey")
  WHERE "idempotencyKey" IS NOT NULL;
-- FIN: migración 20260310190000_product_stock_idempotency
-- This is an empty migration.


CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'booking_no_overlap_per_court'
  ) THEN
    ALTER TABLE "Booking"
    ADD CONSTRAINT "booking_no_overlap_per_court"
    EXCLUDE USING gist (
      "courtId" WITH =,
      tstzrange("startDateTime", "endDateTime", '[)') WITH &&
    )
    WHERE ("status" <> 'CANCELLED');
  END IF;
END $$;


CREATE UNIQUE INDEX IF NOT EXISTS "Account_clubId_sourceType_sourceId_key"
  ON "Account"("clubId", "sourceType", "sourceId");

CREATE UNIQUE INDEX IF NOT EXISTS "CashRegister_clubId_name_key"
  ON "CashRegister"("clubId", "name");

CREATE UNIQUE INDEX IF NOT EXISTS "CashShift_one_open_per_register_key"
  ON "CashShift"("cashRegisterId")
  WHERE "closedAt" IS NULL;

CREATE OR REPLACE FUNCTION ensure_court_activity_same_club()
RETURNS TRIGGER AS $$
DECLARE
  activity_club_id INTEGER;
BEGIN
  IF NEW."activityTypeId" IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT "clubId" INTO activity_club_id
  FROM "ActivityType"
  WHERE "id" = NEW."activityTypeId";

  IF activity_club_id IS NULL THEN
    RAISE EXCEPTION 'La actividad % no existe', NEW."activityTypeId";
  END IF;

  IF activity_club_id <> NEW."clubId" THEN
    RAISE EXCEPTION 'La actividad % no pertenece al club %', NEW."activityTypeId", NEW."clubId";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ensure_court_activity_same_club ON "Court";
CREATE TRIGGER trg_ensure_court_activity_same_club
BEFORE INSERT OR UPDATE ON "Court"
FOR EACH ROW
EXECUTE FUNCTION ensure_court_activity_same_club();

CREATE OR REPLACE FUNCTION ensure_booking_same_club()
RETURNS TRIGGER AS $$
DECLARE
  court_club_id INTEGER;
  activity_club_id INTEGER;
BEGIN
  SELECT "clubId" INTO court_club_id
  FROM "Court"
  WHERE "id" = NEW."courtId";

  IF court_club_id IS NULL THEN
    RAISE EXCEPTION 'La cancha % no existe', NEW."courtId";
  END IF;

  IF court_club_id <> NEW."clubId" THEN
    RAISE EXCEPTION 'La cancha % no pertenece al club %', NEW."courtId", NEW."clubId";
  END IF;

  SELECT "clubId" INTO activity_club_id
  FROM "ActivityType"
  WHERE "id" = NEW."activityId";

  IF activity_club_id IS NULL THEN
    RAISE EXCEPTION 'La actividad % no existe', NEW."activityId";
  END IF;

  IF activity_club_id <> NEW."clubId" THEN
    RAISE EXCEPTION 'La actividad % no pertenece al club %', NEW."activityId", NEW."clubId";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ensure_booking_same_club ON "Booking";
CREATE TRIGGER trg_ensure_booking_same_club
BEFORE INSERT OR UPDATE ON "Booking"
FOR EACH ROW
EXECUTE FUNCTION ensure_booking_same_club();

CREATE OR REPLACE FUNCTION ensure_court_price_rule_same_club()
RETURNS TRIGGER AS $$
DECLARE
  court_club_id INTEGER;
BEGIN
  SELECT "clubId" INTO court_club_id
  FROM "Court"
  WHERE "id" = NEW."courtId";

  IF court_club_id IS NULL THEN
    RAISE EXCEPTION 'La cancha % no existe', NEW."courtId";
  END IF;

  IF court_club_id <> NEW."clubId" THEN
    RAISE EXCEPTION 'La regla de precio referencia una cancha de otro club';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ensure_court_price_rule_same_club ON "CourtPriceRule";
CREATE TRIGGER trg_ensure_court_price_rule_same_club
BEFORE INSERT OR UPDATE ON "CourtPriceRule"
FOR EACH ROW
EXECUTE FUNCTION ensure_court_price_rule_same_club();

CREATE OR REPLACE FUNCTION ensure_payment_cash_shift_same_club()
RETURNS TRIGGER AS $$
DECLARE
  account_club_id INTEGER;
  shift_club_id INTEGER;
BEGIN
  SELECT "clubId" INTO account_club_id
  FROM "Account"
  WHERE "id" = NEW."accountId";

  IF account_club_id IS NULL THEN
    RAISE EXCEPTION 'La cuenta % no existe', NEW."accountId";
  END IF;

  IF NEW."cashShiftId" IS NOT NULL THEN
    SELECT cr."clubId" INTO shift_club_id
    FROM "CashShift" cs
    JOIN "CashRegister" cr ON cr."id" = cs."cashRegisterId"
    WHERE cs."id" = NEW."cashShiftId";

    IF shift_club_id IS NULL THEN
      RAISE EXCEPTION 'El turno de caja % no existe', NEW."cashShiftId";
    END IF;

    IF shift_club_id <> account_club_id THEN
      RAISE EXCEPTION 'El pago referencia una caja de otro club';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ensure_payment_cash_shift_same_club ON "Payment";
CREATE TRIGGER trg_ensure_payment_cash_shift_same_club
BEFORE INSERT OR UPDATE ON "Payment"
FOR EACH ROW
EXECUTE FUNCTION ensure_payment_cash_shift_same_club();

CREATE OR REPLACE FUNCTION ensure_cash_movement_same_club()
RETURNS TRIGGER AS $$
DECLARE
  shift_club_id INTEGER;
  payment_club_id INTEGER;
BEGIN
  SELECT cr."clubId" INTO shift_club_id
  FROM "CashShift" cs
  JOIN "CashRegister" cr ON cr."id" = cs."cashRegisterId"
  WHERE cs."id" = NEW."cashShiftId";

  IF shift_club_id IS NULL THEN
    RAISE EXCEPTION 'El turno de caja % no existe', NEW."cashShiftId";
  END IF;

  IF shift_club_id <> NEW."clubId" THEN
    RAISE EXCEPTION 'El movimiento de caja referencia una caja de otro club';
  END IF;

  IF NEW."paymentId" IS NOT NULL THEN
    SELECT a."clubId" INTO payment_club_id
    FROM "Payment" p
    JOIN "Account" a ON a."id" = p."accountId"
    WHERE p."id" = NEW."paymentId";

    IF payment_club_id IS NULL THEN
      RAISE EXCEPTION 'El pago % no existe', NEW."paymentId";
    END IF;

    IF payment_club_id <> NEW."clubId" THEN
      RAISE EXCEPTION 'El movimiento de caja referencia un pago de otro club';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ensure_cash_movement_same_club ON "CashMovement";
CREATE TRIGGER trg_ensure_cash_movement_same_club
BEFORE INSERT OR UPDATE ON "CashMovement"
FOR EACH ROW
EXECUTE FUNCTION ensure_cash_movement_same_club();

CREATE INDEX IF NOT EXISTS "LedgerEntry_transactionId_idx"
ON "LedgerEntry"("transactionId");

CREATE OR REPLACE FUNCTION ensure_ledger_balanced()
RETURNS TRIGGER AS $$
DECLARE
  debit_sum numeric;
  credit_sum numeric;
  tx_id text;
BEGIN
  tx_id := COALESCE(NEW."transactionId", OLD."transactionId");

  SELECT
    COALESCE(SUM(CASE WHEN direction='DEBIT' THEN amount ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN direction='CREDIT' THEN amount ELSE 0 END),0)
  INTO debit_sum, credit_sum
  FROM "LedgerEntry"
  WHERE "transactionId" = tx_id;

  IF debit_sum <> credit_sum THEN
    RAISE EXCEPTION 'Ledger transaction not balanced';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ensure_ledger_balanced ON "LedgerEntry";

CREATE CONSTRAINT TRIGGER trg_ensure_ledger_balanced
AFTER INSERT OR UPDATE OR DELETE ON "LedgerEntry"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION ensure_ledger_balanced();

CREATE OR REPLACE FUNCTION ensure_ledger_entry_same_club()
RETURNS TRIGGER AS $$
DECLARE
  transaction_club_id INTEGER;
  account_club_id INTEGER;
  account_item_club_id INTEGER;
  payment_club_id INTEGER;
BEGIN
  SELECT "clubId" INTO transaction_club_id
  FROM "LedgerTransaction"
  WHERE "id" = NEW."transactionId";

  IF transaction_club_id IS NULL THEN
    RAISE EXCEPTION 'La transacción contable % no existe', NEW."transactionId";
  END IF;

  IF transaction_club_id <> NEW."clubId" THEN
    RAISE EXCEPTION 'La entrada contable pertenece a otro club que su transacción';
  END IF;

  IF NEW."accountId" IS NOT NULL THEN
    SELECT "clubId" INTO account_club_id
    FROM "Account"
    WHERE "id" = NEW."accountId";

    IF account_club_id IS NULL THEN
      RAISE EXCEPTION 'La cuenta % no existe', NEW."accountId";
    END IF;

    IF account_club_id <> NEW."clubId" THEN
      RAISE EXCEPTION 'La entrada contable referencia una cuenta de otro club';
    END IF;
  END IF;

  IF NEW."accountItemId" IS NOT NULL THEN
    SELECT a."clubId" INTO account_item_club_id
    FROM "AccountItem" ai
    JOIN "Account" a ON a."id" = ai."accountId"
    WHERE ai."id" = NEW."accountItemId";

    IF account_item_club_id IS NULL THEN
      RAISE EXCEPTION 'El item de cuenta % no existe', NEW."accountItemId";
    END IF;

    IF account_item_club_id <> NEW."clubId" THEN
      RAISE EXCEPTION 'La entrada contable referencia un item de otro club';
    END IF;
  END IF;

  IF NEW."paymentId" IS NOT NULL THEN
    SELECT a."clubId" INTO payment_club_id
    FROM "Payment" p
    JOIN "Account" a ON a."id" = p."accountId"
    WHERE p."id" = NEW."paymentId";

    IF payment_club_id IS NULL THEN
      RAISE EXCEPTION 'El pago % no existe', NEW."paymentId";
    END IF;

    IF payment_club_id <> NEW."clubId" THEN
      RAISE EXCEPTION 'La entrada contable referencia un pago de otro club';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ensure_ledger_entry_same_club ON "LedgerEntry";
CREATE TRIGGER trg_ensure_ledger_entry_same_club
BEFORE INSERT OR UPDATE ON "LedgerEntry"
FOR EACH ROW
EXECUTE FUNCTION ensure_ledger_entry_same_club();

CREATE INDEX IF NOT EXISTS "Booking_active_court_time_idx"
ON "Booking"("courtId", "startDateTime")
WHERE "status" <> 'CANCELLED';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'account_amounts_non_negative'
  ) THEN
    ALTER TABLE "Account"
    ADD CONSTRAINT account_amounts_non_negative
    CHECK (
      "totalAmount" >= 0
      AND "paidAmount" >= 0
    ) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'account_remaining_non_negative'
  ) THEN
    ALTER TABLE "Account"
    ADD CONSTRAINT account_remaining_non_negative
    CHECK ("paidAmount" <= "totalAmount") NOT VALID;
  END IF;
END $$;
