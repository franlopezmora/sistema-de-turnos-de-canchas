ALTER TABLE "AccountItem"
  ADD COLUMN IF NOT EXISTS "productId" INTEGER;

CREATE INDEX IF NOT EXISTS "AccountItem_productId_idx"
  ON "AccountItem"("productId");

ALTER TABLE "AccountItem"
  ADD CONSTRAINT "AccountItem_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
