-- Read only inventory for deciding KYC/evidence retention. No IDs or URLs leave the DB.
-- Age buckets are descriptive; they do not authorize deletion.
WITH sources(source) AS (
  VALUES ('provider_application_documents'), ('provider_member_documents'),
         ('order_evidence'), ('order_safety_evidence')
), media AS (
  SELECT 'provider_application_documents' AS source, "createdAt" AS created_at
  FROM provider_application_documents
  UNION ALL
  SELECT 'provider_member_documents', "createdAt"
  FROM provider_member_documents
  UNION ALL
  SELECT 'order_evidence', "capturedAt"
  FROM order_evidence
  UNION ALL
  SELECT 'order_safety_evidence', "createdAt"
  FROM order_safety_evidence
)
SELECT sources.source, COUNT(media.created_at) AS total,
       MIN(media.created_at) AS oldest,
       COUNT(*) FILTER (WHERE media.created_at < NOW() - INTERVAL '90 days') AS older_than_90_days,
       COUNT(*) FILTER (WHERE media.created_at < NOW() - INTERVAL '365 days') AS older_than_365_days
FROM sources LEFT JOIN media ON media.source = sources.source
GROUP BY sources.source
ORDER BY sources.source;
