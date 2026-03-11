-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL(10,2) NOT NULL,
    "accountId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "accountItemId" TEXT NOT NULL,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentAllocation_accountId_createdAt_idx" ON "PaymentAllocation"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentAllocation_accountItemId_createdAt_idx" ON "PaymentAllocation"("accountItemId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentAllocation_paymentId_createdAt_idx" ON "PaymentAllocation"("paymentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAllocation_paymentId_accountItemId_key" ON "PaymentAllocation"("paymentId", "accountItemId");

-- AddForeignKey
ALTER TABLE "PaymentAllocation"
ADD CONSTRAINT "PaymentAllocation_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "Account"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation"
ADD CONSTRAINT "PaymentAllocation_paymentId_fkey"
FOREIGN KEY ("paymentId") REFERENCES "Payment"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation"
ADD CONSTRAINT "PaymentAllocation_accountItemId_fkey"
FOREIGN KEY ("accountItemId") REFERENCES "AccountItem"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
