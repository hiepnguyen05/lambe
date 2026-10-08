CREATE TYPE "CustomerAddressType" AS ENUM ('HOME', 'WORK', 'OTHER');

ALTER TABLE "customer_addresses"
ADD COLUMN "type" "CustomerAddressType" NOT NULL DEFAULT 'HOME',
ADD COLUMN "provinceName" TEXT,
ADD COLUMN "districtName" TEXT,
ADD COLUMN "wardName" TEXT,
ADD COLUMN "streetLine" TEXT,
ADD COLUMN "isMapConfirmed" BOOLEAN NOT NULL DEFAULT false;
