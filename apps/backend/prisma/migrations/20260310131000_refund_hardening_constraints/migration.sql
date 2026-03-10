DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'refund_amount_positive'
  ) THEN
    ALTER TABLE "Refund"
      ADD CONSTRAINT refund_amount_positive
      CHECK ("amount" > 0) NOT VALID;
  END IF;
END $$;

ALTER TABLE "Refund" VALIDATE CONSTRAINT refund_amount_positive;

CREATE OR REPLACE FUNCTION ensure_refund_payment_account_club_consistency()
RETURNS trigger AS $$
DECLARE
  payment_account_id TEXT;
  payment_club_id INT;
  shift_club_id INT;
BEGIN
  SELECT p."accountId", a."clubId"
    INTO payment_account_id, payment_club_id
  FROM "Payment" p
  JOIN "Account" a ON a."id" = p."accountId"
  WHERE p."id" = NEW."paymentId";

  IF payment_account_id IS NULL THEN
    RAISE EXCEPTION 'Refund references unknown payment %', NEW."paymentId";
  END IF;

  IF NEW."accountId" <> payment_account_id THEN
    RAISE EXCEPTION 'Refund accountId % must match payment accountId %', NEW."accountId", payment_account_id;
  END IF;

  IF NEW."clubId" <> payment_club_id THEN
    RAISE EXCEPTION 'Refund clubId % must match payment/account clubId %', NEW."clubId", payment_club_id;
  END IF;

  IF NEW."cashShiftId" IS NOT NULL THEN
    SELECT cs."clubId"
      INTO shift_club_id
    FROM "CashShift" cs
    WHERE cs."id" = NEW."cashShiftId";

    IF shift_club_id IS NULL THEN
      RAISE EXCEPTION 'Refund references unknown cashShift %', NEW."cashShiftId";
    END IF;

    IF shift_club_id <> NEW."clubId" THEN
      RAISE EXCEPTION 'Refund cashShift club mismatch: % <> %', shift_club_id, NEW."clubId";
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ensure_refund_payment_account_club_consistency ON "Refund";
CREATE TRIGGER trg_ensure_refund_payment_account_club_consistency
BEFORE INSERT OR UPDATE ON "Refund"
FOR EACH ROW
EXECUTE FUNCTION ensure_refund_payment_account_club_consistency();
