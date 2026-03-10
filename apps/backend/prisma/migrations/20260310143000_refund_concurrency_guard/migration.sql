CREATE OR REPLACE FUNCTION ensure_refund_not_exceed_payment_amount()
RETURNS trigger AS $$
DECLARE
  payment_amount NUMERIC;
  refunded_amount NUMERIC;
BEGIN
  -- Serializa por payment para evitar carrera entre refunds concurrentes
  SELECT "amount"
    INTO payment_amount
  FROM "Payment"
  WHERE "id" = NEW."paymentId"
  FOR UPDATE;

  IF payment_amount IS NULL THEN
    RAISE EXCEPTION 'Refund references unknown payment %', NEW."paymentId";
  END IF;

  SELECT COALESCE(SUM(r."amount"), 0)
    INTO refunded_amount
  FROM "Refund" r
  WHERE r."paymentId" = NEW."paymentId"
    AND r."id" <> COALESCE(NEW."id", '');

  IF (refunded_amount + NEW."amount") > payment_amount THEN
    RAISE EXCEPTION 'Refund exceeds payment amount: payment %, existing %, new %', payment_amount, refunded_amount, NEW."amount";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ensure_refund_not_exceed_payment_amount ON "Refund";
CREATE TRIGGER trg_ensure_refund_not_exceed_payment_amount
BEFORE INSERT OR UPDATE ON "Refund"
FOR EACH ROW
EXECUTE FUNCTION ensure_refund_not_exceed_payment_amount();
