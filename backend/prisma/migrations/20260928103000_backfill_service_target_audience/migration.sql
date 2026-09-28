UPDATE "services" AS service
SET "targetAudience" = 'MEN'
FROM "service_categories" AS category
WHERE service."categoryId" = category."id"
  AND service."targetAudience" = 'ALL'
  AND (
    category."code" LIKE '%_NAM'
    OR category."code" LIKE 'NAM_%'
    OR category."slug" LIKE '%-nam'
  );

UPDATE "services" AS service
SET "targetAudience" = 'WOMEN'
FROM "service_categories" AS category
WHERE service."categoryId" = category."id"
  AND service."targetAudience" = 'ALL'
  AND (
    category."code" LIKE '%_NU'
    OR category."code" LIKE 'NU_%'
    OR category."slug" LIKE '%-nu'
  );
