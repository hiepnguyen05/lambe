# Cloud runtime and isolated tests (2026-11-23)

## Runtime topology

- Application services run locally or in Docker Compose. PostgreSQL is Neon; Redis is Upstash. Neither database runs inside the application Compose project.
- `DATABASE_URL` targets the Neon pooled endpoint for Prisma runtime traffic; `DIRECT_URL` targets the direct endpoint for migrations. `REDIS_URL` targets Upstash TCP with TLS (`rediss://`). The URLs and credentials belong in local `.env` or the deployment's secret store, never in the report.
- Before deploying migrations, check the destination database and migration status. The project owner explicitly authorized tests against the existing development Neon and Upstash on 2026-11-23. Do not use the isolated-test reset script against these services.

## WP0 and WP3 test approach

- The existing `docker-compose.test.yml` and CI services are disposable PostgreSQL/Redis test fixtures. They are optional for developers using separate cloud test instances; they do not change the runtime topology.
- The optional isolated cloud route uses a separate Neon test branch/database and a separate Upstash database. The current development route uses the owner's existing Neon and Upstash credentials with a dedicated opt-in marker and disabled external integrations. See `development-cloud-test-runbook-2026-11-23.md`.
- The integration test guard accepts loopback test databases, isolated cloud test databases, or the explicitly authorized existing development database. It rejects mismatched URLs and enabled external integrations for the development route. Booking fixtures remain after the test run.
- WP3 connection budget needs actual Neon connection limits, application replica counts and observed Prisma pool usage under a controlled load. The presence of a pooled URL alone does not establish those values.
- Database latency, Redis latency, p95/p99 and resource overhead cannot be inferred from unit tests. Capture measurements on an authorized environment before checking off the relevant work packages.

## Bounded avatar backfill

After building the backend, run `npm run provider:backfill-avatars -- --limit=100` from `backend/`. The command scans at most 100 matching providers per run in batches of 25 and returns `scanned`, `updated`, `skipped`, `failed`, and `nextCursor`. Continue using `npm run provider:backfill-avatars -- --limit=100 --cursor=<nextCursor>` until `scanned` is zero. The maximum invocation limit is 500. Failed records are skipped in that run and require explicit review or a fresh scan; a nonzero `failed` sets a nonzero exit code. The output contains counts and cursor only, no raw exception messages or personal data. Cloudinary publishing happens outside the database transaction.

Do not run this script as part of a load test. Concurrent backfill invocations and complete media-side-effect idempotency are not established yet.
