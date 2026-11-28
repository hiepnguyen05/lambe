# Backend upgrade implementation log — 2026-11-21

## Baseline

- Branch: `feat/bookings`; HEAD: `1b40ae12d464f99b2e71138c496178883560b513`.
- Working tree already had approximately 766 status entries before this implementation. These changes are preserved; no reset, checkout, or migration was run.
- Local Node.js: 24.15.0, npm: 11.12.1. Docker Desktop Linux engine denied API access on this host. CI uses Node.js 22, PostgreSQL 16 and Redis 7.
- PostgreSQL runtime version, Redis runtime version, pool size, replica count and performance baseline cannot be measured here without an isolated running environment. Previous repository results do not establish current p95/p99.

## WP0/WP1 changes

- Integration application setup now refuses remote PostgreSQL hosts, unexpected schema parameters and non-test database names even when `DATABASE_URL` and `TEST_DATABASE_URL` match. Unit tests cover valid and invalid targets.
- CI points migration and test URLs to the same dedicated local test database. External integrations are disabled or mocked by the test configuration; Redis uses database 15.
- `docker-compose.test.yml` creates disposable PostgreSQL 16 and Redis 7 services bound to loopback ports 55432 and 56379; the test database is stored in tmpfs. `scripts/reset-isolated-test-data.ps1` resets only this named test stack.
- Existing `scripts/quality-baseline.ts --run` has an explicit local URL/Redis 15 preflight and seeds synthetic providers, orders, chat and feed in `test/quality-baseline.runner.ts`. It has not been rerun in this session because Docker is unavailable.
- CI runs the existing specialist integration suites for feed cache, organization chat/feed/finance/reviews, provider members/notifications and Redis recovery sequentially, in addition to existing suites.
- CI executes the configured coverage thresholds and uploads coverage output. The declared Jest thresholds are unchanged.
- Category DTO formatting is normalized with Prettier.

## Outstanding evidence

- Local PostgreSQL/Redis integration runs, synthetic dataset and repeatable latency baseline require a working isolated Docker engine or equivalent test services.
- `npm run test:cov -- --runInBand` reported statements 51.89%, branches 44.17%, functions 44.94%, lines 52.23%; all are below the existing global thresholds (80%, 75%, 80%, 80%). CI now enforces these thresholds and is expected to fail until test coverage is expanded. Do not lower thresholds to hide the gap.
- Largest unit coverage gaps by uncovered statements include orders (171), order add-ons (170), Redis cache (132), member availability (111), booking (105) and member verification documents (92). Some have separate integration coverage; the current Jest unit coverage report does not aggregate those suites.
- Full `npm run check` has the local health socket failure described below. CI status has not been observed. Do not mark WP0 or WP1 fully complete until all gates pass.
- WP2–WP10 require their own metrics, tests and benchmarks; this log does not assert completion of those packages.

## Local test stack (PowerShell)

From `backend/`, start or reset test services with `./scripts/reset-isolated-test-data.ps1`. Set `NODE_ENV=test`, `DATABASE_URL`, `TEST_DATABASE_URL` and `DIRECT_URL` to the same URL, `postgresql://lambe_test:lambe_test_only@127.0.0.1:55432/lambe_booking_test_local`; set `REDIS_URL=redis://127.0.0.1:56379/15`. Disable Firebase, email and Cloudinary in this shell and use synthetic JWT keys. Then run `npx prisma migrate deploy`, the required integration scripts from `package.json`, and `npx ts-node scripts/quality-baseline.ts --run` for a guarded synthetic benchmark. Do not run the reset against the normal app compose file.

On this host, `npm run typecheck`, `npm run typecheck:test`, `npm run lint`, `npx prisma validate` and 889 of 890 unit tests passed. The remaining `health.controller.spec.ts` failed when Supertest attempted to bind `127.0.0.1` (`EACCES`); CI can verify it on a runner where local sockets are available. Docker API access was denied locally, so integration suites were not executed here.

## CI integration matrix

All rows run for backend pull requests and pushes, after migration against the dedicated CI database. The code owner is the corresponding backend module maintainer; each specialist suite has a 15 minute step timeout, and the whole job has a 90 minute timeout.

| Area | Script or Jest config | Owner |
| --- | --- | --- |
| Core API and booking | `test:e2e`, `test:organization-booking` | Backend orders |
| AI consultation | `test:ai-consultation` | Backend AI consultation |
| Feed cache | `test:feed-cache` | Backend social feed |
| Organization chat, feed, finance, reviews | `test:organization-chat`, `test:organization-feed`, `test:organization-finance`, `test:organization-reviews` | Backend provider organization |
| Provider members and notifications | `test:provider-members`, `test:provider-notifications` | Backend provider members |
| Redis recovery | `jest --config test/jest-integration.json redis-recovery.integration-spec.ts` | Backend infrastructure |

Coverage is checked after the integration steps so they still report their results while the coverage gap is being addressed.

## 2026-11-23 · WP0–WP2

- Four additional integration entry points now use the shared PostgreSQL test guard before constructing a client. `PostgresModule` creates `PrismaService` explicitly so Nest can resolve it while test callers can still supply a datasource override.
- The admin snapshot exposes process event loop delay, GC and aggregate HTTP counters. HTTP throughput is the average over the current process observation period. The existing request histogram supports rate and percentile calculations from snapshots retained by a collector.
- The SSE metrics use the headers Nest passes to `writeHead`. The frame counter skips the initial newline. HTTP completion logs use the server route template and request ID. They record 5xx and aborted requests, plus a 1% sample of remaining completions.
- Order tracking reports accepted GPS updates, rejected timestamps and rejected out-of-order updates through fixed counters. The telemetry contains no location coordinates or order identifiers.
- SQL telemetry records durations only. It observes one duration in every 20 Prisma query events and counts all observed events at or above 250 ms. It does not label queries by model or operation. The 250 ms cutoff is a diagnostic threshold for the counter.
- Redis metrics record duration and errors for GET, MGET, rate limit and notification publish calls. Connection errors, reconnects and connection deadlines have separate counters for the command client and subscriber. Business command deadlines remain in WP4.
- The readiness test opens a real HTTP socket, so it now lives in `test/health-readiness.e2e-spec.ts`, which the existing CI E2E command discovers. Its assertions are unchanged. Local attempts before the move reproduced `EACCES` on loopback.
- Formatting was fixed in onboarding and provider application review. Background email delivery continues to return immediately to its caller. Its failure log now omits the raw error message.
- `npm run check` passed with 896 unit tests in 150 suites. Prisma validation passed. The focused order tracking and metrics run passed 17 tests.
- Fresh unit coverage was 52.35% statements, 44.51% branches, 45.33% functions and 52.69% lines. The coverage command still fails all four existing gates.
- To revert instrumentation, revert the changes to the observability services and the Prisma and Redis module wiring together. No migration is needed.
- `lambe-control` remains unavailable in this conversation. PostgreSQL/Redis integration and overhead benchmarks await an isolated test environment (disposable local services or separate cloud test instances). Coverage and multi-instance collection remain open.

## 2026-11-23 — Cloud topology correction and bounded avatar backfill

- Verified URL schemes/hosts only, without displaying credentials: runtime PostgreSQL is Neon (pooled API URL, direct migration URL), Redis is Upstash over TLS. The application Compose file does not define PostgreSQL or Redis services. The disposable local Compose test services and CI fixtures are optional isolation tools, not the runtime architecture. See `cloud-test-environment-2026-11-23.md`.
- Updated the runtime README, which still incorrectly described a Redis container and a legacy Redis volume.
- Provider avatar backfill now scans at most 100 records per invocation by default, with a maximum of 500; it pages in sets of at most 25 by creation time and ID using a keyset condition. The command accepts `--limit` and `--cursor` for explicit continuation. Response fields are counts and resume cursor; raw media errors are omitted. Invalid portraits are counted as skipped. This change has no schema migration.
- The existing sync operation publishes outside its database transaction. Cloudinary side-effect idempotency and concurrent invocations still require characterization before the whole WP4 backfill subpackage can be marked complete.
- `npx prisma validate` and `npm run check` passed after this change (150 unit suites, 898 tests). The two added backfill tests cover batch bounds, continuation across modified rows, errors and invalid limits. Cloud integration tests and a measured performance baseline were not run in this environment.

## 2026-11-23 — WP4 Redis command deadlines (partial)

- GET, MGET and the Lua rate-limit increment now pass a per-command timeout to node-redis. The default is 1000 ms, configurable via validated `REDIS_COMMAND_TIMEOUT_MS` (1–5000 ms). Read cache retains its miss fallback; protected throttled requests receive 503 when the deadline expires. Public Feed retains its existing conservative fallback.
- The admin metrics record a timeout counter per fixed command group, in addition to errors and duration. Cache/connection failure logs are throttled per fixed operation to one every 30 seconds per process, while metrics count every failure. No key, Redis URL or raw exception is logged.
- This applies only to read cache and rate-limit operations. Other write, realtime and Pub/Sub paths still require isolated-cloud recovery tests before changing timeouts; see `redis-deadline-matrix-2026-11-23.md`. Native command timeouts do not establish whether an already-sent Lua increment executed server-side.
- Verified after the changes: `npx prisma validate` and `npm run check` passed (150 unit suites, 901 tests). The focused Redis/config run passed 68 tests before the last transport-error test was added; the final full suite includes that test. A real Upstash slow/half-open/reconnect test and measured before/after latency still remain open.

## 2026-11-23 — WP2 cache outcomes and WP4 Feed rate-limit bound

- The process-local admin snapshot now exposes bounded `redis.cacheLookups` counters for categories, services, Feed posts and other keys, each split into hits, misses and errors. GET/MGET count per requested key, including malformed JSON as miss and failed requests as errors. No key, value or per-user label enters telemetry. A Feed post may still fail application-level validation after a JSON hit; FeedCacheService has its own effective-hit metrics.
- Public Feed reads now pass the existing 100 ms fallback budget into the actual node-redis rate-limit command while retaining the outer deadline. This limits the pending client command after fallback, without assuming an already-sent Lua increment can be cancelled server-side. Protected requests keep the configured command deadline and fail closed.
- Focused Redis storage/metrics tests passed (25 tests before adding the runtime-label guard). Cloud measurements and recovery tests are still outstanding.
- Final verification: `npx prisma validate`, Prettier check, `git diff --check` and `npm run check` all passed; the full local unit suite reports 150 suites and 904 tests. No live Upstash or Neon benchmark was run, so this does not establish a before/after latency gain.

## 2026-11-23 — Development Neon/Upstash test target

- User explicitly authorized testing against the existing development Neon and Upstash and confirmed no important data or production release. Existing local/CI isolated test guards remain available; an explicit `TEST_TARGET=development` path requires matching URLs, a dedicated opt-in marker and all external integrations disabled.
- `scripts/probe-development-cloud.ts` reads the existing `.env` without logging credentials and probes Neon/Upstash with read-only queries. `scripts/run-development-tests.ts` prepares a temporary test environment without editing `.env`; `check`, `probe`, `status`, `migrate` and `booking` are available as npm scripts. Booking fixtures currently remain after a suite run, documented in `development-cloud-test-runbook-2026-11-23.md`.
- Offline guard tests passed 47/47; TypeScript test typecheck passed; the offline check returned `prepared`. Attempts to connect from this managed session returned PostgreSQL unavailable and Upstash unavailable (`ENOTFOUND` from the initial read-only connectivity check). Neither migrations nor integration tests were executed on the cloud database here.

- Final local verification for the development target: Prisma schema valid; npm run check passed (151 suites, 945 tests); 49 focused preflight tests passed; Prettier and git diff --check passed. npm run dev-cloud:check prepared the test target; npm run dev-cloud:probe returned postgres/redis unavailable, and npm run dev-cloud:booking stopped at postgres_connection without running the booking suite. Real Neon/Upstash migration and integration results remain unverified in this managed session.

## 2026-11-23 - Development cloud probe from the owner's PowerShell

- Owner ran dev-cloud:probe on the Windows host: Neon pooled PostgreSQL reported database neondb, server version 18.7 (84da7d8), max_connections 901, active 1 and idle 5 for this database at the time of the sample. Upstash responded successfully; DBSIZE returned zero keys.
- dev-cloud:status exited successfully (exitCode 0). The owner started dev-cloud:booking but has not supplied a completion status; the booking suite must not be counted as passed yet.
- The 901 setting is a snapshot reported by PostgreSQL, not a confirmed usable application connection budget. Reserved slots, Neon pooling behavior, application replica count, actual per-instance Prisma pool size, and peak usage under load remain unmeasured. The probe samples one moment and does not establish p95/p99 latency or Redis recovery behavior.

## 2026-11-24 — Local integration, baseline and Redis half-open recovery

- Docker test PostgreSQL 16.15 and Redis 7.4.12 became available. The development Neon/Upstash probe also returned `up` (Neon 18.7, `max_connections=901`, one active and six idle sessions in a point-in-time snapshot, Redis `DBSIZE=0`). The existing development booking run passed 36/36. A separate local test database was migrated and the booking suite passed another 36/36, including 40 concurrent reservation requests. The suite leaves synthetic fixtures in its test database.
- The isolated performance harness initially failed because its Feed fixture used the new default `moderationStatus=PENDING`; public Feed now requires `APPROVED`. After setting the fixture status, the fresh isolated run passed. Discovery p95: ASAP 62.885 ms and SCHEDULED 60.237 ms, 100 requests each at concurrency 4; query counts stayed 9→9 for both 1→40 AI messages and 1→20 Feed posts; 12 SSE handshakes had p95 44.573 ms. See `qa/performance-baseline-fixed-2026-11-23.json`. The failed RED artifact is `qa/performance-baseline-2026-11-23.json`. These are Windows loopback synthetic results, not production p95 or a before/after optimization gain.
- The full local integration matrix passed booking 36, organization booking 21, organization chat 13, organization Feed 28, organization finance 18, organization reviews 19, provider members 75, and provider notifications 18. E2E 81/81, AI consultation 25/25 and Feed cache 14/14 passed after their fixtures/Redis URL checks were updated to match current publication policy and the loopback test stack. The E2E, AI and Feed rerun used the re-created tmpfs test database after Docker restarted.
- A real loopback TCP proxy reproduced a half-open Redis reply that was **not** bounded by node-redis `withCommandOptions({timeout})` once the command was sent. Redis `observeCommand` now also bounds the reply wait, retires the ambiguous socket and reconnects without replaying the mutation. The command queue is capped at 1,000. The real Redis suite passed 4/4, covering GET/MGET/rate-limit, cache write/tracking read, two-client Pub/Sub reconnect and listener cleanup, and shutdown with an in-flight half-open read. Shutdown destroys the socket so it cannot wait indefinitely for a reply. The native command timeout remains useful for queued commands; a timed-out server-side mutation may still have executed and callers must not assume rollback.
- CI now runs the dedicated booking and Redis deadline suites. The isolated Redis test guard accepts explicit loopback DB15 on a configurable port. The dependency audit completed: 30 total advisories (7 high, 23 moderate); `npm audit --omit=dev` reported 13 (4 high, 9 moderate), but this is a conservative dependency-tree view and not a reachability assessment of the pruned runtime image. The lockfile SHA256 at audit time was `C2E84E0532BE59DE94A72891201AE9AF173C20237C8175CBEF0472DA52BA72F1`.
- Coverage still blocks WP1: 52.66% statements, 44.74% branches, 45.57% functions and 53.03% lines versus 80/75/80/80 thresholds. The E2E/integration suites are not included in that unit coverage report. No threshold was lowered. The remaining program-wide items (connection budget under load, production metrics aggregation, query/index decisions, broader concurrency and multi-instance soak, k6 matrix, Ponytail parity and rollout) are not yet complete.
- Final `npm run check` passed: production and test typechecks, ESLint and 956 unit tests in 152 suites. Prettier check for touched TypeScript and `git diff --check` passed.
- A second read-only Neon probe returned PostgreSQL 18.7, `max_connections=901`, `superuser_reserved_connections=4`, `reserved_connections=0`, and one active/six idle connections for this database. The configured server ceiling after those reserved slots is 897, but Neon pooled endpoint behavior and other consumers still prevent treating 897 as available application capacity. The current Compose file starts one API instance; its future maximum replicas and actual Prisma v6 pool size remain unconfirmed, so WP3's `instances × pool size` budget is not complete.

## 2026-11-24 — Connection pool and coverage investigation

- A read-only Prisma `info` event probe observed a default pool of **17 connections** both from the Windows host and from a new client inside the current `lambe_server` container. Compose currently runs one API container; the arithmetic for this topology is `1 × 17 = 17` potential app connections, excluding migrations, admin tools and other clients. For an illustrative two-replica topology it would be `2 × 17 = 34`. These are configured maxima, not observed peak usage, and the future replica limit has not been specified. No pool setting was changed.
- Unit-only coverage was 52.66% statements, 44.74% branches, 45.57% functions and 53.03% lines. A combined unit-plus-E2E coverage map reached 68.08% statements, 54.43% branches, 52.60% functions and 68.18% lines. An attempt to run all unit/integration/E2E suites in one Windows Jest process exited abnormally before producing coverage. The work now runs integration groups separately and merges their coverage maps, keeping the existing 80/75/80/80 global thresholds intact. The combined E2E run passed 40/40; the first integration group passed 95/95 but still did not meet the global coverage threshold on its own.
- Combining the available Istanbul maps for unit, E2E and separately instrumented integration suites reached **80.27% statements, 67.96% branches, 71.17% functions and 80.79% lines**. This is an investigation result, not a passing CI coverage gate: to hit the unchanged thresholds on the same 10,580 branches and 2,397 functions requires about 744 additional covered branches and 212 additional covered functions. The top gaps are listed in `../../scratch/performance-coverage-merged-2026-11-24.json`; those scratch artifacts are local working evidence, not checked-in CI reports. Organization Feed passes 28/28 normally and with Jest V8 coverage, but its Istanbul coverage run crashes on this Windows Node 24 host. V8 and Istanbul maps were not merged because their statement maps differ. CI Node 22/Linux must run the final reproducible merged gate before WP1 closes.
- A new half-open Redis test proved provider position lookup could wait indefinitely after its GEOPOS command was sent. The application now applies its reply deadline to that lookup. The isolated real Redis suite passed 5/5 after the change. This covers a request-critical GPS read; other GPS mutation paths remain open in WP4.

## 2026-11-24 — Command-client Redis deadline expansion

- A loopback proxy RED test showed provider/member position writes remained pending after their Redis reply was withheld. The same fault was reproduced for provider online/nearby reads and cache lock/index operations. Each previously waited past the 1.5 s test guard despite a configured 100 ms command timeout.
- The existing application reply deadline now covers provider/member location reads and writes, tracking save and publish, cache batch writes/deletes, lock acquire/release, sorted Feed index read/rebuild, generation advance and generic cache delete. Timeouts retire the ambiguous command socket and reconnect it without replaying the operation. Cache operations retain their previous null/false/void fallback; realtime operations fail closed. A timed-out write can still have executed server-side, so sequence checks and lock tokens remain necessary.
- The real Redis proxy suite passed 8/8 after these changes. `npm run check` passed production/test typechecks, ESLint and 956 unit tests in 152 suites. Provider member integration passed 75/75 and Feed cache integration passed 14/14 using the local isolated PostgreSQL/Redis test stack. The first provider-member attempt lacked its separate `TEST_REDIS_URL` setting and failed during Redis preflight; the corrected rerun passed. No production-like p95 claim follows from this fault test. Subscribe/unsubscribe acknowledgements are on a separate subscriber socket and still need a bounded recovery design.
- The experimental all-suite V8 coverage run was stopped after a shared-database E2E order dependency produced an HTTP 200 where the isolated suite expects 409. Its partial run is not counted as a coverage result. The independently collected Istanbul map remains below the unchanged branch/function gates, so WP1 and Checkpoint A remain open.

## 2026-11-24 — Avatar backfill concurrent retry guard

- A new RED test demonstrated that while one backfill invocation uploads media, a second invocation can complete the same profile, yet the first would still overwrite its avatar and count the row as updated. After acquiring the existing row lock, backfill now rechecks both avatar fields. If another invocation has filled them, it rolls back without changing the profile, deletes only its own newly uploaded image, and counts the row as skipped. Manual admin sync keeps its existing overwrite behavior.
- The focused service suite passed 9/9. The full `npm run check` passed production/test typechecks, ESLint and 957 unit tests in 152 suites. The local command-client Redis fault suite remained 8/8; provider member and Feed cache integration were 75/75 and 14/14 before this avatar change. A real Cloudinary race and batch memory/time benchmark remain open, so WP4 is not marked complete.

## 2026-11-24 — Half-open Redis subscriber acknowledgement

- A RED test held the subscriber socket open while withholding a new channel's subscribe acknowledgement. The request waited past 1.5 s despite the 100 ms test budget. Subscribe and unsubscribe acknowledgements now use a deadline on the separate subscriber socket; on timeout that socket is retired and reconnected without affecting the command client. The failed listener is removed, while existing listeners receive events again after recovery.
- The real Redis proxy suite passed 9/9 after the change; the final `npm run check` passed both typechecks, ESLint and 957 unit tests in 152 suites. This remains local fault evidence; Upstash timing and repeated multi-instance restart/soak tests remain open.

## 2026-11-24 — Isolated benchmark reset and repeat protocol

- `npm run benchmark:reset-local` validates the exact Compose project name, service images, credentials, loopback ports and PostgreSQL tmpfs before stopping only the disposable `lambe-test` stack. It recreates both services and applies all 68 migrations with a hardcoded loopback test URL. The guard unit test passed, and one real reset/migration run completed successfully. The existing `scripts/reset-isolated-test-data.ps1` remains a lower-level services-only reset; the new command also migrates, so the benchmark can start from a ready clean database.
- One fresh synthetic baseline failed at query-count verification: AI history remained 9→9 SQL, but authenticated Feed measured 9→10. It is retained as `qa/performance-baseline-repeat-2026-11-24.json`. After separate full resets, three subsequent runs passed with AI and Feed both 9→9 SQL: `qa/performance-baseline-repeat2-2026-11-24.json`, `qa/performance-baseline-trace-1-2026-11-24.json` and `qa/performance-baseline-trace-2-2026-11-24.json`. Their Discovery ASAP p95 values were 70.303, 59.791 and 59.811 ms; SCHEDULED p95 values were 72.682, 69.968 and 64.011 ms. Each used 200 providers, 1000 orders, 1000 chat messages, 100 samples per mode, concurrency 4 and warm-up 5 on Windows loopback. These are repeatability evidence, not a claimed optimization gain or production latency.
- The query-count assertion remains strict. A bounded SQL-family diagnostic was added to future artifacts, storing statement type and table name without raw SQL or parameters. The failed run predates this diagnostic, so the extra query's source is still unknown; the three passing resets do not prove it was harmless. The classifier and guard checks passed locally. WP0 still lacks a representative organization workload and dedicated credentials without inherited development secrets.

## 2026-11-24 — Fresh unit coverage gate

- After the reset guard and avatar tests, `npm run test:cov -- --runInBand` ran 958/958 tests in 153 suites but failed the unchanged 80/75/80/80 gate: statements 52.70% (7324/13895), branches 44.90% (4668/10396), functions 45.32% (1057/2332) and lines 53.09% (6820/12845). WP1/CI remains red. The separate integration and E2E suites are still absent from this unit-only report; exploratory union coverage earlier in this log also missed branches and functions.

## 2026-11-24 — Dependency reachability triage

- Re-ran `npm audit --omit=dev` (13 dependency-tree entries: 4 high, 9 moderate), checked the dependency chain, and inspected installed packages in the currently running pruned application image. Prisma CLI/config and its high findings are absent from that runtime image; Firebase/Google transitive packages with moderate advisories are present. Swagger YAML parsing is configured only in development. See `dependency-audit-triage-2026-11-24.md` for advisory links, path evidence and the separate-PR decisions. This is not proof that the moderate findings are exploitable or resolved.
- `npm audit fix --dry-run` proposed broad changes across test/build and runtime packages; no lockfile mutation was made. The current lockfile hash remains `C2E84E0532BE59DE94A72891201AE9AF173C20237C8175CBEF0472DA52BA72F1`.

## 2026-11-24 — Live 503 investigation and booking read latency

- The running November 21 image returned `Redis rate limiting unavailable.` for public categories/services during paced and staggered read-only HTTP load. Redis reconnect messages coincided with 503s. The immediate failure path is known; the underlying Upstash/network/client cause is not yet isolated. See `qa/live-backend-performance-2026-11-24.md`.
- Public GETs for categories and services now share the existing Feed read fallback: a stricter local per-replica throttler only during Redis failure. Booking and all writes continue to fail closed. New route-boundary tests proved the previous 503 behavior and reject fallback for writes/admin/booking paths.
- The 100 ms public-read fallback previously also shortened the Redis command deadline on the shared command socket. Since a command deadline retires that socket, one modestly slow Feed request could cascade into other routes' 503s. The storage now returns its local fallback at 100 ms while the Redis command retains the configured 1000 ms recovery deadline. This is a code-level failure mechanism, not proof of the full Upstash incident cause on the old image.
- Saved-address and provider-offering reads now start together; the offering projection is limited to fields required by quote, availability and create recheck. Calendar block and pending-reschedule reads also start together. All booking writes still revalidate in the transaction under the existing locks.
- Read-only development PostgreSQL paired probes showed address/offering p50/p95 387/487 → 329/409 ms over 60 pairs (paired median saved 51 ms), and calendar/reschedule 195/260 → 116/181 ms over 40 pairs (saved 62 ms). This is query-pair latency, not endpoint latency under load. The offering JSON sample shrank 3035 → 1685 bytes. See `qa/booking-and-public-read-optimization-2026-11-24.md`.
- A 12-second-per-mode read-only concurrency probe found 4-worker throughput 9.40 → 10.78 RPS with p95 549 → 449 ms, and 12-worker throughput 27.69 → 32.09 RPS with p95 510 → 550 ms. No query errors occurred. Thus the 12-worker p95 did not improve; pool wait and order effects were not measured. No whole-booking or production capacity claim follows.
- Final `npm run check` passed production/test typechecks, ESLint and 968/968 unit tests in 153 suites. Redis fault suite passed 9/9. Booking integration passed 36/36 and organization booking passed 21/21 against isolated PostgreSQL/Redis. The first organization test attempt accidentally inherited Firebase enabled and failed at test setup; the corrected isolated run passed. One silent booking run exited 1 with no diagnostics, followed by a normal 36/36 run. A later organization run passed 21 test cases but errored during Prisma teardown (`Engine is not yet connected`); the immediate rerun passed 21/21. Track this test setup instability separately.
