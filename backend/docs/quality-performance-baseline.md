# QA performance baseline

Feed cache extension (20/11/2026): see [recorded HTTP probe](qa/feed-cache-2026-11-20.json), [upgrade checklist](feed-cache-upgrade-plan.md) and [runbook](feed-cache-runbook.md). The new opt-in `npm run feed:benchmark` measures public Feed with cache off/objects/index on an explicitly isolated local database and Redis DB 15. It changes only isolated cache generation/outbox metadata and measured Redis keys. Local results do not certify production capacity.

This is an opt-in development baseline using a Nest test application, synthetic fixtures, real isolated PostgreSQL, and dedicated Redis database 15. It measures local behavior, not production capacity. P5 development remains paused. No application, package, organization implementation, or plan changes are required.

## Run safely

Have the parent create and migrate an **empty** `lambe_booking_test_*` database. Both `DATABASE_URL` and `TEST_DATABASE_URL` must be explicitly set to the **identical complete URL**. Use `NODE_ENV=test` and a **dedicated, empty Redis instance at database 15**. Redis pub/sub channels are shared across logical databases, so another instance is needed to avoid collisions with appRedis15. Do not run other tests against these services concurrently.

For the recorded run, the parent provided `lambe_booking_test_quality_perf_20261030_01` on local PostgreSQL port 5433 with 58 migrations applied, and `redis://127.0.0.1:6382/15` in `lambe-quality-perf-redis`. The tooling does not create/migrate/drop databases or start/restart containers. Keep connection credentials in the process environment; never copy them into results or this document.

From `D:/Project/Lambe/backend`, after setting those environment variables:

```powershell
# Database-free guard, bounds, concurrency, percentile and sanitization checks:
node -r ts-node/register test/quality-baseline.check.ts

# Strict TypeScript for owned files and their imported dependencies:
node node_modules/typescript/bin/tsc --noEmit --incremental false -p test/quality-baseline.tsconfig.json
node node_modules/eslint/bin/eslint.js scripts/quality-baseline.ts test/quality-baseline.runner.ts test/quality-baseline.check.ts

# Emits exactly one sanitized JSON report; nonzero exit means refusal/failure.
node -r ts-node/register/transpile-only scripts/quality-baseline.ts --run
# Optional capture:
node -r ts-node/register/transpile-only scripts/quality-baseline.ts --run |
  Set-Content -LiteralPath test/quality-baseline.result.json -Encoding utf8
```

Run only one of the last two commands per fresh dataset. The second command demonstrates output capture, not a second required benchmark. In PowerShell, inspect `$LASTEXITCODE` from Node as well as the JSON `status`; a successful output-file write does not mean the benchmark passed. Transpile-only is the measured execution mode; run the separate strict check first.

The script refuses to connect without `--run`. It rejects a missing or mismatched database URL, any database name outside `lambe_booking_test_[a-z0-9_]+`, nonlocal hosts, Redis databases other than `/15`, Redis query overrides, and database query parameters other than `schema=public`. It never falls back to `.env` to choose a database. Preflight runs before application imports. After connection, it verifies `current_database()`, requires an empty user/order/category dataset, and takes an exclusive Redis lock. A nonempty dedicated Redis DB is also rejected; there is no `FLUSHDB`.

Synthetic database rows remain for inspection. Ask the parent to recreate the disposable database before another run. Redis cleanup removes only the exact provider GEO/heartbeat and benchmark lock keys. The dedicated Redis instance stays running. Interrupted runs may leave the lock/GEO data; have the parent inspect that dedicated instance before retrying. The lock expires after 15 minutes.

## Workload and options

Use `--name=value`; unknown, duplicate or out-of-range numeric options fail before connections.

| Option        |                Default |     Bounds |
| ------------- | ---------------------: | ---------: |
| `providers`   |                    200 |     10–500 |
| `orders`      |                   1000 | 1000–10000 |
| `messages`    |                   1000 | 1000–10000 |
| `samples`     | 100 per Discovery mode |     20–500 |
| `concurrency` |                      4 |       1–16 |
| `sse`         |                     12 |       2–30 |
| `warmup`      |   5 per Discovery mode |       1–20 |

The fixture reuses `memberTestUser`, `memberTestOrganization(..., true)` and `createTestApp`. It creates active individual providers, wallets with sufficient balance, seven days of working hours, active offerings, one published feed post per provider, and an uppercase valid `QUALITY_PERF` category/service code. The 1000 default rejected orders represent five attempts per booking group. Chat history has 1000 messages in one conversation; AI histories contain 1 and 40 messages with catalog/provider/post snapshots. The outbox contains 1000 mixed sent, failed, future, leased and pending rows. Orders and push rows are scaled together. SSE adds one message per stream after the recorded seed counts.

Firebase identity verification, media storage and mail use existing test mocks. The benchmark additionally overrides Firebase Admin, Gemini, feed storage and OSRM before compiling the test app. All integration enable flags are forced off, synthetic signing/encryption material is used, and scheduled jobs/intervals are stopped before seeding. There are no real Firebase, Gemini, SMTP, Cloudinary, payment or routing requests. Existing Jest mock support is reused; no dependencies are installed.

## What is measured

- **Discovery:** authenticated `POST /api/discovery/providers/search`, ASAP and SCHEDULED, through an ephemeral listener bound to `127.0.0.1`. ASAP uses actual Redis GEO and fresh heartbeats; scheduled uses the PostgreSQL candidate query. Each request must return 200 and the expected number of cards. Warmup is excluded. Requests within one mode are concurrent; modes run sequentially. Latency includes the local client, authorization, validation, presentation, database and Redis work. Percentiles use nearest rank; elapsed batch time is separate.
- **SSE:** concurrent authenticated chat streams, at most three per user. Measure header handshake and receipt of a complete first message event. All streams are open before a batch of synthetic messages is inserted and published through Redis. Delivery timings start at the beginning of that batch, so they include sequential insert/update/publish work across all conversations. Clients close after receipt. This is one local fan-out sample per connection, not a sustained streaming or slow-client capacity test.
- **Memory/event loop:** Node RSS sampled every 25 ms, event-loop delay at 10 ms resolution, and event-loop utilization over Discovery, query counting and SSE after seeding. RSS includes ts-node, the test harness, Prisma and the in-process HTTP clients. It is not PostgreSQL/Redis/container memory. The 10 ms resolution imposes a floor on delay observations.
- **Linux file descriptors:** `resources.fileDescriptors` records the current `/proc/self/fd` entry count at `beforeSse`, `connected` (all SSE handshakes complete), and `afterCleanup` (all client sockets destroyed, followed by the existing 50 ms cleanup wait). It reports numbers only, never descriptor targets. `cleanupWithinBound` must be true: `afterCleanup <= beforeSse + allowedGrowth`, with `allowedGrowth: 8`. The fixed allowance covers a persistent Redis subscriber and small pool/control-descriptor changes; zero descriptors or an exact return to baseline is not required. These counts include both ends of the in-process HTTP connections and all other open descriptors in the Node process. Linux missing/unreadable procfs produces `status: "unavailable"`, null readings and a failed baseline. Other platforms report `status: "unsupported_platform"`, `source: null`, null counts and `cleanupWithinBound: null`; the check is skipped explicitly.
- **Bounded query counts:** Prisma SQL query events, including queries for selected relations, with a 25 ms event-drain interval around each isolated operation. Compare 1 versus 40 AI history messages over HTTP, and 1 versus 20 authenticated feed rows through the real feed service, including viewer flags. Require no query growth and at most 20 queries. No other DB workload runs during these counts. This checks these populated read paths; it does not prove every AI/feed endpoint is free of N+1 behavior.
- **Query plans:** `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` for chat `afterSequence` (`LIMIT 51`), rematch attempted providers, latest booking attempt, and the actual push outbox CTE/locking/update claim shape. The push update runs inside a savepoint and is rolled back. Relevant tables are analyzed after seeding. Numeric plan evidence and node types survive sanitization; SQL, conditions, IDs, payloads, relation/index names and error bodies do not.

Application/driver stdout and stderr are suppressed during the run. The CLI emits only the sanitized JSON report, including on failure. A failed stage is recorded without raw errors. No HTTP body, account token, message text, URL credential, key material or environment dump is included.

## Recorded results

The latest Linux evidence is [quality-baseline.linux-fd.result.json](../test/quality-baseline.linux-fd.result.json), recorded below. The original [quality-baseline.result.json](../test/quality-baseline.result.json) and its tables remain as historical Windows reference measurements; consult each artifact's UTC timestamps and runtime metadata when comparing runs.

Historical Windows run: **passed**, 2026-10-30 14:04:21–14:04:34 UTC. Machine: Windows 10.0.26200 x64, Intel Core i7-11800H at 2.30 GHz, 16 logical CPUs, 16,888,135,680 bytes RAM. Runtime: Node 24.15.0, V8 13.6.233.17-node.48, Prisma 6.19.3, PostgreSQL 16.14 and Redis 7.4.11. Both services were local; hardware/container resource allocation was not separately controlled.

Dataset: 200 individual providers, 1000 rejected orders in 200 booking groups, 1000 seeded chat messages, 200 published feed posts, 41 AI messages and 1000 mixed outbox rows. The SSE phase added 12 messages in separate conversations. Each Discovery mode used five sequential warmups and 100 measured requests at concurrency four, returning 20 cards per response.

| Measurement                                       | p50 ms | p95 ms |  p99 ms |
| ------------------------------------------------- | -----: | -----: | ------: |
| Discovery ASAP                                    | 54.446 | 92.702 | 105.792 |
| Discovery SCHEDULED                               | 55.146 | 75.727 | 104.248 |
| SSE handshake, 12 connections                     | 39.586 | 58.915 |  58.915 |
| SSE batch insert to event receipt, 12 connections | 54.709 | 92.159 |  92.159 |
| Event-loop delay                                  | 10.420 | 15.565 |  19.907 |

RSS peak was 512,339,968 bytes (about 488.6 MiB), including the test harness and clients. Event-loop utilization was 0.456, with a maximum sampled delay of 24.920 ms. The 12-sample SSE p95 and p99 are both the maximum observed sample; these are especially noisy tail estimates.

| Query-count comparison                       | Small page | Larger page | SQL queries, small → larger |
| -------------------------------------------- | ---------: | ----------: | --------------------------: |
| AI history over authenticated HTTP           |  1 message | 40 messages |                     14 → 14 |
| Authenticated feed service with viewer flags |     1 post |    20 posts |                       9 → 9 |

Both populated paths passed the 20-query bound and zero-growth check.

| EXPLAIN shape                  | Execution ms | Top-level actual rows | Root shared hit blocks | Observed access                                   |
| ------------------------------ | -----------: | --------------------: | ---------------------: | ------------------------------------------------- |
| Chat `afterSequence`           |        0.180 |                    51 |                      8 | Index Scan under Limit                            |
| Rematch provider attempts      |        0.059 |                     5 |                      3 | Bitmap Index / Heap Scan                          |
| Rematch latest attempt         |        0.042 |                     1 |                      3 | Index Scan under Limit                            |
| Push outbox claim, rolled back |        0.746 |                     1 |                     75 | Index Scan, Incremental Sort, LockRows and update |

All four root plans recorded zero shared read blocks in this warm run. Shared hit counts are taken at the root and must not be added to child counts. The outbox candidate index scan discarded 330 rows by its filter in this sample; one fast uncontended claim on 1000 rows is insufficient evidence of behavior with a large accumulated outbox.

Historical validation for that run: database-free guard/helper checks, scoped strict TypeScript, touched-file ESLint and the live benchmark passed. Concurrent-work typecheck errors outside the owned files were subsequently resolved; the parent completed the final Node 22 check (808 unit), HTTP/integration matrix and deployment, as recorded in [verification](quality-verification-2026-10-30.md). Synthetic data was retained and benchmark-owned Redis GEO/lock keys were cleaned. No commits were created.

The earlier passing [Linux Node 22 baseline](../test/quality-baseline.linux.result.json), using Node 22.23.4 with two CPUs and a 1 GiB container memory limit, remains a reference: Discovery p95 ASAP **112.769 ms**, SCHEDULED **126.247 ms**, RSS peak **318,005,248 bytes**. It predates descriptor instrumentation and supplies no FD evidence.

### Latest Linux descriptor baseline — documented 2026-10-31

The parent-supplied [Linux FD result](../test/quality-baseline.linux-fd.result.json) is **passed**, recorded 2026-10-30 14:37:00.010–14:37:23.847 UTC on fresh synthetic database `lambe_booking_test_quality_perf_linux_20261030_02`, Redis DB15, Node **22.23.4**, Prisma 6.19.3, PostgreSQL 16.14 and Redis 7.4.11. The parent reports a **2 CPU / 1 GiB** container limit. The artifact's machine fields expose the WSL host's 16 logical CPUs and 8,181,059,584 bytes RAM; they are not the container limits. Dataset/options match the 200-provider, 1000-order/message workload above, with 100 samples per Discovery mode, concurrency four and 12 SSE connections.

| Latest Linux measurement                 | Result                                            |
| ---------------------------------------- | ------------------------------------------------- |
| FD before SSE                            | 35                                                |
| FD with all 12 SSE clients connected     | 65                                                |
| FD after cleanup                         | 41                                                |
| Allowed post-cleanup bound               | 35 + 8 = 43                                       |
| FD cleanup check                         | `measured`, `cleanupWithinBound: true`; growth +6 |
| Discovery ASAP p95                       | 103.175 ms                                        |
| Discovery SCHEDULED p95                  | 81.436 ms                                         |
| RSS peak                                 | 307,834,880 bytes (about 293.6 MiB)               |
| AI history queries, 1 → 40 messages      | 14 → 14                                           |
| Authenticated feed queries, 1 → 20 posts | 9 → 9                                             |

This supplies the previously pending Linux `/proc/self/fd` evidence. Cleanup passed the fixed allowance; the count did not return exactly to 35. Query counts passed zero growth and the 20-query bound. These are local harness measurements with the limitations described above. This documentation pass read the existing result only: no benchmark rerun, service restart, deployment or dataset change. Both older artifacts and their measurements are preserved.

## Limits and follow-up

The dataset exercises **individual** providers only. Organization/member candidate, verification and review aggregation paths are not represented. Scheduled candidate searches cap at 300 individual candidates, so provider counts above that limit do not imply all rows were evaluated. Rejected historical orders do not model a dense live reservation calendar, travel churn or contention. The chat SQL plan covers message retrieval, not its separate authorization/attachment queries. Rematch plans cover attempt reads, not a full HTTP rematch/booking operation. Outbox EXPLAIN covers one uncontended claim; outbound push delivery is disabled.

Small sample tails, local loopback, warm caches, query logging and competing machine work affect these numbers. No production SLA, throughput target or hard latency gate is claimed. Compare the same dataset/options/runtime on an otherwise quiet machine; increase samples within the bounds only when an additional run is warranted. Final health/observability and backend check results are recorded in [verification](quality-verification-2026-10-30.md); those results do not turn this baseline into a production capacity certification.
