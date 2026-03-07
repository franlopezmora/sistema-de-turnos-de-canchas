ALTER TABLE "Club"
  ALTER COLUMN "lightsExtraAmount" TYPE DECIMAL(10,2) USING ROUND(CAST("lightsExtraAmount" AS numeric), 2),
  ALTER COLUMN "professorDiscountPercent" TYPE DECIMAL(5,2) USING ROUND(CAST("professorDiscountPercent" AS numeric), 2);

ALTER TABLE "ClubSettings"
  ALTER COLUMN "lightsExtraAmount" TYPE DECIMAL(10,2) USING ROUND(CAST("lightsExtraAmount" AS numeric), 2),
  ALTER COLUMN "professorDiscountPercent" TYPE DECIMAL(5,2) USING ROUND(CAST("professorDiscountPercent" AS numeric), 2);

ALTER TABLE "Court"
  ALTER COLUMN "price" TYPE DECIMAL(10,2) USING ROUND(CAST("price" AS numeric), 2),
  ALTER COLUMN "price" SET DEFAULT 0;

ALTER TABLE "CourtPriceRule"
  ALTER COLUMN "price" TYPE DECIMAL(10,2) USING ROUND(CAST("price" AS numeric), 2);

ALTER TABLE "Booking"
  ALTER COLUMN "price" TYPE DECIMAL(10,2) USING ROUND(CAST("price" AS numeric), 2);
