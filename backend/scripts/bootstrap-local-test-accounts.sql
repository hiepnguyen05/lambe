\set ON_ERROR_STOP on

\if :{?provider_firebase_uid}
\else
  \echo 'Missing psql variable: provider_firebase_uid'
  \quit 1
\endif

\if :{?customer_firebase_uid}
\else
  \echo 'Missing psql variable: customer_firebase_uid'
  \quit 1
\endif

BEGIN;

-- Minimal local catalog so the provider can participate in discovery on a
-- freshly migrated development database. These stable LOCAL_* codes keep the
-- script idempotent and make the data easy to identify.
INSERT INTO "service_categories" (
  "id",
  "code",
  "name",
  "normalizedName",
  "slug",
  "description",
  "sortOrder",
  "status",
  "createdById",
  "updatedById",
  "createdAt",
  "updatedAt"
)
VALUES (
  gen_random_uuid(),
  'LOCAL_HAIR_MEN',
  'Tóc nam',
  'toc nam',
  'toc-nam',
  'Danh mục mẫu phục vụ kiểm thử cục bộ.',
  10,
  'ACTIVE',
  (SELECT "id" FROM "internal_accounts" WHERE "status" = 'ACTIVE' ORDER BY "createdAt" LIMIT 1),
  (SELECT "id" FROM "internal_accounts" WHERE "status" = 'ACTIVE' ORDER BY "createdAt" LIMIT 1),
  NOW(),
  NOW()
)
ON CONFLICT ("code") DO UPDATE
SET
  "status" = 'ACTIVE',
  "updatedAt" = NOW();

WITH category AS (
  SELECT "id"
  FROM "service_categories"
  WHERE "code" = 'LOCAL_HAIR_MEN'
), sample_services (
  "code",
  "name",
  "normalizedName",
  "slug",
  "description",
  "minPriceAmount",
  "maxPriceAmount",
  "defaultDurationMinutes",
  "sortOrder"
) AS (
  VALUES
    ('LOCAL_MEN_HAIRCUT', 'Cắt tóc nam cơ bản', 'cat toc nam co ban', 'cat-toc-nam-co-ban', 'Cắt và tạo kiểu tóc nam tại nhà.', 80000, 150000, 45, 10),
    ('LOCAL_MEN_HAIR_WASH', 'Gội đầu nam', 'goi dau nam', 'goi-dau-nam', 'Gội đầu và chăm sóc tóc nam tại nhà.', 50000, 100000, 30, 20),
    ('LOCAL_MEN_PERM', 'Uốn tóc nam', 'uon toc nam', 'uon-toc-nam', 'Uốn và tạo kiểu tóc nam.', 250000, 500000, 120, 30),
    ('LOCAL_MEN_DYE', 'Nhuộm tóc nam', 'nhuom toc nam', 'nhuom-toc-nam', 'Nhuộm tóc nam tại nhà.', 300000, 700000, 150, 40),
    ('LOCAL_MEN_STYLING', 'Tạo kiểu tóc nam', 'tao kieu toc nam', 'tao-kieu-toc-nam', 'Tạo kiểu tóc nam theo nhu cầu.', 100000, 200000, 45, 50),
    ('LOCAL_MEN_COMBO', 'Combo cắt và gội đầu nam', 'combo cat va goi dau nam', 'combo-cat-va-goi-dau-nam', 'Combo cắt, gội và tạo kiểu tóc nam.', 120000, 220000, 60, 60)
)
INSERT INTO "services" (
  "id",
  "categoryId",
  "code",
  "name",
  "normalizedName",
  "slug",
  "description",
  "minPriceAmount",
  "maxPriceAmount",
  "currencyCode",
  "defaultDurationMinutes",
  "targetAudience",
  "sortOrder",
  "status",
  "createdById",
  "updatedById",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid(),
  category."id",
  sample_service."code",
  sample_service."name",
  sample_service."normalizedName",
  sample_service."slug",
  sample_service."description",
  sample_service."minPriceAmount",
  sample_service."maxPriceAmount",
  'VND',
  sample_service."defaultDurationMinutes",
  'MEN',
  sample_service."sortOrder",
  'ACTIVE',
  (SELECT "id" FROM "internal_accounts" WHERE "status" = 'ACTIVE' ORDER BY "createdAt" LIMIT 1),
  (SELECT "id" FROM "internal_accounts" WHERE "status" = 'ACTIVE' ORDER BY "createdAt" LIMIT 1),
  NOW(),
  NOW()
FROM category
CROSS JOIN sample_services AS sample_service
ON CONFLICT ("code") DO UPDATE
SET
  "status" = 'ACTIVE',
  "updatedAt" = NOW();

-- Development-only identities. Fixed OTP codes remain configured in Firebase,
-- never in PostgreSQL.
INSERT INTO "users" (
  "id",
  "phone",
  "firebaseUid",
  "phoneVerifiedAt",
  "fullName",
  "status",
  "createdAt",
  "updatedAt"
)
VALUES
  (
    gen_random_uuid(),
    '0777777777',
    :'provider_firebase_uid',
    NOW(),
    'Đối tác thử nghiệm',
    'ACTIVE',
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid(),
    '0999999999',
    :'customer_firebase_uid',
    NOW(),
    'Khách hàng thử nghiệm',
    'ACTIVE',
    NOW(),
    NOW()
  )
ON CONFLICT ("phone") DO UPDATE
SET
  "firebaseUid" = EXCLUDED."firebaseUid",
  "phoneVerifiedAt" = COALESCE("users"."phoneVerifiedAt", NOW()),
  "fullName" = COALESCE("users"."fullName", EXCLUDED."fullName"),
  "status" = 'ACTIVE',
  "updatedAt" = NOW();

INSERT INTO "user_role_assignments" (
  "id",
  "userId",
  "role",
  "assignedAt"
)
SELECT gen_random_uuid(), "id", 'CUSTOMER', NOW()
FROM "users"
WHERE "phone" IN ('0777777777', '0999999999')
ON CONFLICT ("userId", "role") DO NOTHING;

INSERT INTO "customer_profiles" (
  "id",
  "userId",
  "preferredAudience",
  "pricePreference",
  "onboardingStatus",
  "skippedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid(),
  "id",
  'ALL',
  'NO_PREFERENCE',
  'SKIPPED',
  NOW(),
  NOW(),
  NOW()
FROM "users"
WHERE "phone" IN ('0777777777', '0999999999')
ON CONFLICT ("userId") DO UPDATE
SET
  "gender" = NULL,
  "preferredAudience" = 'ALL',
  "pricePreference" = 'NO_PREFERENCE',
  "onboardingStatus" = 'SKIPPED',
  "completedAt" = NULL,
  "skippedAt" = COALESCE("customer_profiles"."skippedAt", NOW()),
  "updatedAt" = NOW();

INSERT INTO "provider_applications" (
  "id",
  "userId",
  "providerType",
  "status",
  "revisionNumber",
  "legalFullName",
  "gender",
  "biography",
  "experienceYears",
  "submittedAt",
  "reviewedAt",
  "reviewedById",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid(),
  user_account."id",
  'INDIVIDUAL',
  'APPROVED',
  1,
  'Đối tác thử nghiệm',
  'MALE',
  'Tài khoản đối tác dùng để kiểm thử cục bộ.',
  3,
  NOW(),
  NOW(),
  (SELECT "id" FROM "internal_accounts" WHERE "status" = 'ACTIVE' ORDER BY "createdAt" LIMIT 1),
  NOW(),
  NOW()
FROM "users" AS user_account
WHERE user_account."phone" = '0777777777'
  AND NOT EXISTS (
    SELECT 1
    FROM "provider_applications" AS application
    WHERE application."userId" = user_account."id"
      AND application."status" = 'APPROVED'
  );

INSERT INTO "user_role_assignments" (
  "id",
  "userId",
  "role",
  "sourceApplicationId",
  "assignedAt"
)
SELECT
  gen_random_uuid(),
  user_account."id",
  'PROVIDER',
  application."id",
  NOW()
FROM "users" AS user_account
JOIN LATERAL (
  SELECT "id"
  FROM "provider_applications"
  WHERE "userId" = user_account."id" AND "status" = 'APPROVED'
  ORDER BY "reviewedAt" DESC NULLS LAST, "createdAt" DESC
  LIMIT 1
) AS application ON TRUE
WHERE user_account."phone" = '0777777777'
ON CONFLICT ("userId", "role") DO UPDATE
SET "sourceApplicationId" = EXCLUDED."sourceApplicationId";

INSERT INTO "provider_profiles" (
  "id",
  "userId",
  "sourceApplicationId",
  "providerType",
  "displayName",
  "biography",
  "experienceYears",
  "status",
  "serviceAreaName",
  "serviceAreaLatitude",
  "serviceAreaLongitude",
  "serviceRadiusKm",
  "setupCompletedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid(),
  user_account."id",
  application."id",
  'INDIVIDUAL',
  'Đối tác thử nghiệm',
  'Tài khoản đối tác dùng để kiểm thử cục bộ.',
  3,
  'ACTIVE',
  COALESCE(source_provider."serviceAreaName", 'Khu vực Hà Nội'),
  COALESCE(source_provider."serviceAreaLatitude", 21.0285),
  COALESCE(source_provider."serviceAreaLongitude", 105.8542),
  COALESCE(source_provider."serviceRadiusKm", 12),
  NOW(),
  NOW(),
  NOW()
FROM "users" AS user_account
JOIN LATERAL (
  SELECT "id"
  FROM "provider_applications"
  WHERE "userId" = user_account."id" AND "status" = 'APPROVED'
  ORDER BY "reviewedAt" DESC NULLS LAST, "createdAt" DESC
  LIMIT 1
) AS application ON TRUE
LEFT JOIN LATERAL (
  SELECT
    "serviceAreaName",
    "serviceAreaLatitude",
    "serviceAreaLongitude",
    "serviceRadiusKm"
  FROM "provider_profiles"
  WHERE "userId" <> user_account."id" AND "status" = 'ACTIVE'
  ORDER BY "createdAt"
  LIMIT 1
) AS source_provider ON TRUE
WHERE user_account."phone" = '0777777777'
ON CONFLICT ("userId") DO UPDATE
SET
  "status" = 'ACTIVE',
  "setupCompletedAt" = COALESCE("provider_profiles"."setupCompletedAt", NOW()),
  "updatedAt" = NOW();

INSERT INTO "provider_wallets" (
  "id",
  "providerId",
  "balanceAmount",
  "heldAmount",
  "currencyCode",
  "createdAt",
  "updatedAt"
)
SELECT gen_random_uuid(), provider."id", 200000, 0, 'VND', NOW(), NOW()
FROM "provider_profiles" AS provider
JOIN "users" AS user_account ON user_account."id" = provider."userId"
WHERE user_account."phone" = '0777777777'
ON CONFLICT ("providerId") DO UPDATE
SET
  "balanceAmount" = GREATEST("provider_wallets"."balanceAmount", 200000),
  "updatedAt" = NOW();

INSERT INTO "provider_members" (
  "id",
  "providerId",
  "userId",
  "role",
  "status",
  "canProvideServices",
  "membershipVersion",
  "availabilityVersion",
  "displayName",
  "joinedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid(),
  provider."id",
  user_account."id",
  'OWNER',
  'ACTIVE',
  TRUE,
  1,
  0,
  provider."displayName",
  NOW(),
  NOW(),
  NOW()
FROM "provider_profiles" AS provider
JOIN "users" AS user_account ON user_account."id" = provider."userId"
WHERE user_account."phone" = '0777777777'
ON CONFLICT ("providerId", "userId") DO UPDATE
SET
  "status" = 'ACTIVE',
  "canProvideServices" = TRUE,
  "leftAt" = NULL,
  "updatedAt" = NOW();

INSERT INTO "provider_working_hours" (
  "id",
  "providerId",
  "dayOfWeek",
  "startMinute",
  "endMinute"
)
SELECT gen_random_uuid(), provider."id", day_of_week, 420, 1320
FROM "provider_profiles" AS provider
JOIN "users" AS user_account ON user_account."id" = provider."userId"
CROSS JOIN generate_series(0, 6) AS day_of_week
WHERE user_account."phone" = '0777777777'
ON CONFLICT ("providerId", "dayOfWeek", "startMinute") DO UPDATE
SET "endMinute" = EXCLUDED."endMinute";

WITH selected_services AS (
  SELECT
    service."id",
    ((service."minPriceAmount" + service."maxPriceAmount") / 2)::integer AS price,
    COALESCE(service."defaultDurationMinutes", 60) AS duration
  FROM "services" AS service
  JOIN "service_categories" AS category ON category."id" = service."categoryId"
  WHERE service."status" = 'ACTIVE' AND category."status" = 'ACTIVE'
  ORDER BY service."sortOrder", service."createdAt", service."id"
  LIMIT 6
)
INSERT INTO "provider_application_services" (
  "id",
  "applicationId",
  "serviceId",
  "proposedPriceAmount",
  "durationMinutes",
  "description",
  "status",
  "reviewedById",
  "reviewedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid(),
  application."id",
  selected_service."id",
  selected_service.price,
  selected_service.duration,
  'Dịch vụ mẫu cho tài khoản kiểm thử.',
  'VERIFIED',
  (SELECT "id" FROM "internal_accounts" WHERE "status" = 'ACTIVE' ORDER BY "createdAt" LIMIT 1),
  NOW(),
  NOW(),
  NOW()
FROM "users" AS user_account
JOIN LATERAL (
  SELECT "id"
  FROM "provider_applications"
  WHERE "userId" = user_account."id" AND "status" = 'APPROVED'
  ORDER BY "reviewedAt" DESC NULLS LAST, "createdAt" DESC
  LIMIT 1
) AS application ON TRUE
CROSS JOIN selected_services AS selected_service
WHERE user_account."phone" = '0777777777'
ON CONFLICT ("applicationId", "serviceId") DO UPDATE
SET
  "status" = 'VERIFIED',
  "reviewedAt" = NOW(),
  "updatedAt" = NOW();

INSERT INTO "provider_services" (
  "id",
  "providerId",
  "serviceId",
  "sourceApplicationId",
  "priceAmount",
  "durationMinutes",
  "description",
  "status",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid(),
  provider."id",
  application_service."serviceId",
  provider."sourceApplicationId",
  application_service."proposedPriceAmount",
  application_service."durationMinutes",
  application_service."description",
  'ACTIVE',
  NOW(),
  NOW()
FROM "provider_profiles" AS provider
JOIN "users" AS user_account ON user_account."id" = provider."userId"
JOIN "provider_application_services" AS application_service
  ON application_service."applicationId" = provider."sourceApplicationId"
  AND application_service."status" = 'VERIFIED'
WHERE user_account."phone" = '0777777777'
ON CONFLICT ("providerId", "serviceId") DO UPDATE
SET
  "priceAmount" = EXCLUDED."priceAmount",
  "durationMinutes" = EXCLUDED."durationMinutes",
  "status" = 'ACTIVE',
  "updatedAt" = NOW();

INSERT INTO "provider_member_services" (
  "id",
  "memberId",
  "membershipVersion",
  "providerServiceId",
  "enabled",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid(),
  member."id",
  member."membershipVersion",
  provider_service."id",
  TRUE,
  NOW(),
  NOW()
FROM "provider_members" AS member
JOIN "users" AS user_account ON user_account."id" = member."userId"
JOIN "provider_services" AS provider_service
  ON provider_service."providerId" = member."providerId"
WHERE user_account."phone" = '0777777777'
  AND member."status" = 'ACTIVE'
ON CONFLICT ("memberId", "membershipVersion", "providerServiceId") DO UPDATE
SET "enabled" = TRUE, "updatedAt" = NOW();

INSERT INTO "provider_member_working_hours" (
  "id",
  "memberId",
  "membershipVersion",
  "dayOfWeek",
  "startMinute",
  "endMinute"
)
SELECT
  gen_random_uuid(),
  member."id",
  member."membershipVersion",
  day_of_week,
  420,
  1320
FROM "provider_members" AS member
JOIN "users" AS user_account ON user_account."id" = member."userId"
CROSS JOIN generate_series(0, 6) AS day_of_week
WHERE user_account."phone" = '0777777777'
  AND member."status" = 'ACTIVE'
ON CONFLICT ("memberId", "membershipVersion", "dayOfWeek", "startMinute") DO UPDATE
SET "endMinute" = EXCLUDED."endMinute";

INSERT INTO "audit_logs" (
  "id",
  "actorUserId",
  "action",
  "resourceType",
  "resourceId",
  "result",
  "metadata",
  "createdAt"
)
SELECT
  gen_random_uuid(),
  user_account."id",
  'LOCAL_TEST_ACCOUNT_BOOTSTRAPPED',
  'User',
  user_account."id",
  'SUCCESS',
  jsonb_build_object('phoneSuffix', RIGHT(user_account."phone", 4)),
  NOW()
FROM "users" AS user_account
WHERE user_account."phone" IN ('0777777777', '0999999999');

COMMIT;

SELECT
  user_account."phone",
  user_account."status",
  string_agg(
    DISTINCT role_assignment."role"::text,
    ','
    ORDER BY role_assignment."role"::text
  ) AS roles,
  provider."status" AS provider_status,
  wallet."balanceAmount" AS wallet_balance,
  COUNT(DISTINCT provider_service."id") AS provider_service_count
FROM "users" AS user_account
JOIN "user_role_assignments" AS role_assignment ON role_assignment."userId" = user_account."id"
LEFT JOIN "provider_profiles" AS provider ON provider."userId" = user_account."id"
LEFT JOIN "provider_wallets" AS wallet ON wallet."providerId" = provider."id"
LEFT JOIN "provider_services" AS provider_service ON provider_service."providerId" = provider."id"
WHERE user_account."phone" IN ('0777777777', '0999999999')
GROUP BY user_account."id", provider."status", wallet."balanceAmount"
ORDER BY user_account."phone";
