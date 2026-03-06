-- Hardening de concurrencia: evita doble reserva de la misma cancha en rangos solapados.
-- Requiere extensión btree_gist para combinar igualdad (courtId) con solapamiento de rangos de tiempo.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Booking"
DROP CONSTRAINT IF EXISTS "booking_no_overlap_per_court";

ALTER TABLE "Booking"
ADD CONSTRAINT "booking_no_overlap_per_court"
EXCLUDE USING gist (
  "courtId" WITH =,
  tstzrange("startDateTime", "endDateTime", '[)') WITH &&
)
WHERE ("status" <> 'CANCELLED');
