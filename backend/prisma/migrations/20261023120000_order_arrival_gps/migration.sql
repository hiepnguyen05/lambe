ALTER TABLE "service_orders"
  ADD COLUMN "arrivalLatitude" DOUBLE PRECISION,
  ADD COLUMN "arrivalLongitude" DOUBLE PRECISION,
  ADD COLUMN "arrivalAccuracyMeters" DOUBLE PRECISION,
  ADD COLUMN "arrivalDistanceMeters" INTEGER;
