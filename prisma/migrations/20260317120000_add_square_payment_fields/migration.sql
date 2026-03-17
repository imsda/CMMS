-- Add Square payment fields to EventRegistration
-- Existing rows are safe with null defaults; no backfill required.
ALTER TABLE "EventRegistration" ADD COLUMN "squarePaymentId" TEXT;
ALTER TABLE "EventRegistration" ADD COLUMN "squareCheckoutUrl" TEXT;
ALTER TABLE "EventRegistration" ADD COLUMN "squareOrderId" TEXT;
