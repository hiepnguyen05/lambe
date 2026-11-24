# Quality and security evidence — 2026-10-30

**Parent addendum — 31/10/2026:** after the original 37-case suite, a full-AppModule
test of ADMIN-only observability with real PostgreSQL aggregates was added.
The updated suite passed **38/38** with test typecheck/lint on the final Node 22
builder; log `tasks/quality-observability-postgres-e2e.log`. The deployed image
also passed its full 77-case E2E run before that addition. Its subsequent
physical dependency audit reports 0 High/Critical and 10 Moderate entries;
see [runtime evidence](quality-runtime-dependencies-2026-10-31.md). Historical
counts and scoped worker statements below remain historical evidence.

## Scope and execution boundary

P5 development remains PAUSED. The **initial evidence phase** owned only `test/quality-security.e2e-spec.ts` and this document; that phase made no application source, package, lockfile, migration or plan changes. A later explicitly authorized hardening phase changed the Cloudinary service, mail service and mail-outbox service plus their three specs, as recorded below. The parent separately applied the dependency overrides and lock refresh. These statements describe distinct phases, not a claim that current source or packages are unchanged.

**Current handoff status:** application source is frozen. Following the documentation pass, the parent authorized the necessary security-test fixture correction for injected CI targets, recorded below; no application source changed. The parent reports overrides `body-parser: 2.4.0`, `multer: 2.5.0`, `qs: 6.16.2` applied with `npm install --package-lock-only --ignore-scripts --no-audit`. Local package/lock metadata was read to confirm those exact targets. The parent's final-image audit and Linux Node 22 regression supersede the historical advisory counts and pre-integration test runs below. No final-image pass is claimed by this worker.

No Strix, cloud scan, destructive shared-cache operation or requests to the running application on port 5000 were performed by this work. No secrets were read or printed, and no commits were made. The parent-owned lock-only refresh is not an installation performed by this evidence worker.

The suite imports the full **AppModule**, applies the real `configureApp`, and makes HTTP requests to ephemeral listeners bound to `127.0.0.1`. Initial host execution used the parent-created `lambe_booking_test_quality_security_20261030_01` database on port 5433 (parent reports 58 migrations applied) and Redis at `redis://127.0.0.1:6379/15`. The corrected fixture now requires explicit injected database/Redis URLs and validates `current_database()` against the injected database name before seeding; it does not force those host addresses or that specific database. Redis must use **logical database 15**, not Redis server version 15, with a live connection required. The existing compose declaration is Redis 7 Alpine; no server image upgrade was attempted by this work.

The shared `createTestApp` helper overrides Firebase verification, media storage and mail delivery. Those substitutions are disclosed: these are not real Firebase, SMTP or Cloudinary tests. All authorization guards, database ownership queries, DTO validation, multipart interceptors and upload pipes under examination are actual application code. All external integration enable flags are explicitly false, with synthetic test signing/encryption keys. Nest env-file loading is disabled before importing AppModule; an env-file existence guard also prevents the generated Prisma client from opening `.env` files. No `.env` contents are printed or used by the final fixture.

Cleanup targets only seeded IDs and this run's unique `quality-security-<UUID>` throttle namespace. There is no FLUSHDB/FLUSHALL, database reset or table truncation. Failed setup is guarded against an undefined ID becoming an unscoped deletion. Other agents may continue using DB15.

## Existing coverage reviewed (source inventory, not rerun here)

| Area                    | Existing evidence inspected                                                                 | Existing negative coverage / remaining reason for this suite                                                                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication          | `app-validation.e2e-spec.ts`, `user-auth.e2e-spec.ts`, JWT guard/session unit tests         | Missing/invalid token, extra auth fields, verified phone, profile/address ownership; consolidate HTTP evidence for revoked/expired/blocked sessions, signed wrong-purpose tokens, subject/session mismatch and signature tampering. |
| Upload and private URLs | `provider-registration.e2e-spec.ts`, member-verification tests, image validation unit tests | KYC roles, private documents, raster restrictions already covered; add real HTTP byte validation, size/path rejection and proof that denied requests never call storage.                                                            |
| Chat                    | `chat-realtime.e2e-spec.ts`, `organization-chat.integration-spec.ts`                        | Outsider SSE denial, reconnect, worker assignment/version boundaries, image recheck after revocation; add a compact full-app read/write/nonowner/storage-side-effect boundary.                                                      |
| AI                      | `ai-consultation.integration-spec.ts`                                                       | History/send/refresh/delete ownership, privacy filtering, retries and malformed input; those tests use mocked Gemini and skip production throttling. Add a real Redis-backed HTTP 20/minute check using the actual controller.      |
| Feed                    | `organization-feed.integration-spec.ts`                                                     | Worker/owner boundaries, moderation visibility, forged metadata and upload checks; add public output canaries and pagination validation to the focused suite.                                                                       |
| Push                    | `push-devices.e2e-spec.ts`, `push.e2e-spec.ts`                                              | Token transfer/rotation, no FCM token response, outsider revocation; add malformed/extra registration field checks plus persistence assertions after denied revocation.                                                             |
| Booking/internal        | Organization booking, finance, reviews, member tests; `internal-operations.e2e-spec.ts`     | Assignment ownership, malformed queries, internal role restrictions and session invalidation; add existing-order/evidence concealment, invalid coordinates/price injection and user/internal token separation.                      |

Existing files were reviewed, not represented as passing runs in this task. This suite complements their deeper lifecycle/race coverage.

## New runnable HTTP evidence

**28 tests passed** in this worker's last recorded focused HTTP execution (1 suite, 0 snapshots; 7.491 seconds as reported by Jest). This Windows run predates the parent's later module/business-metrics integration and dependency refresh; it is historical evidence, not the frozen source's final regression result.

| Surface                                                  | Observed result                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Auth, chat, AI, managed feed, orders and internal routes | Seven real route families each return 401 for missing and malformed bearer tokens.                                                                                                                                                                                                                                                                                             |
| Token/session boundaries                                 | User token rejected on internal auth; internal token rejected on user auth. Revoked and expired sessions and a blocked user return 401. Signed registration token, signed mismatched subject/session token and altered signature return 401.                                                                                                                                   |
| Internal roles                                           | SUPPORT can read its own internal account, receives 403 for account management and valid-image admin upload; no media upload call occurs. ADMIN reaches the actual upload pipe/service.                                                                                                                                                                                        |
| Request IDs                                              | Allowed IDs, including exactly 100 characters, survive both 200 and 401 HTTP responses. IDs of 101 characters, script-shaped input and spaces are replaced by a UUID. Sampled success/error bodies contain no hash, stack, database URL or credential markers. This proves the tested response-header behavior, not log-wide redaction.                                        |
| Existing-resource ownership                              | Outsider receives 404 for chat detail/history/SSE, AI history, an existing order, existing order evidence and an existing KYC document URL. Outsider AI deletion leaves the row intact. Positive owner reads succeed; document owner gets `Cache-Control: no-store`. No private URL is generated for denied requests.                                                          |
| Unauthorized writes                                      | Well-formed outsider chat and AI messages return 404; message counts are unchanged and Gemini is not invoked.                                                                                                                                                                                                                                                                  |
| Input                                                    | Invalid UUIDs return 400 on chat, AI and order reads. Separately tested overlong AI text, extra user ID and malformed message ID return 400. Invalid booking coordinates plus an injected price field, feed limit 51 and invalid cursor return 400. No AI message or Gemini call results. The combined booking case does not independently prove every nested coordinate rule. |
| Public feed                                              | A seeded published post is returned; private report detail canary, storage public IDs and account-sensitive field names are absent. An existing hidden post is 404 and absent from the provider-filtered public list. Existing organization-feed tests separately cover organization review-note hiding.                                                                       |
| Push                                                     | Unauthenticated registration is 401. Invalid platform, short token, invalid device ID and extra user ID are each 400. Successful registration omits the FCM token. Outsider revoke is 404 and leaves `revokedAt` null; owner revoke succeeds. No real push is delivered.                                                                                                       |
| Content and limits                                       | HTML bytes labeled PNG, scripted SVG labeled PNG and an empty image each return 400 before media storage. A real 1x1 PNG reaches storage and gets 201. An invalid folder returns 400; a file over 5 MiB returns 413 without storage calls. SVG/plain text on the private chat image route return 400; valid PNG content from an outsider returns 404 without private upload.   |

## Rate-limit proof and its limits

`AppModule` defines global `short` (10 / 1000 ms) and `medium` (120 / 60000 ms) policies, both with `skipIf: NODE_ENV === 'test'`. Thus ordinary full-app e2e requests **do not prove production throttling**, even when decorators exist or a test calls a route repeatedly.

The focused HTTP fixture reads the actual resolved AppModule options with `getOptionsToken()`, retains the production policy limits/TTLs, and removes only that test bypass. It registers the actual **AuthController, UploadController and AiConsultationController**, production **ThrottlerGuard**, and **RedisThrottlerStorage** through fresh CacheModule instances. It reuses the full app's real application services and real authentication/role guard instances, not permissive stand-ins. The only key-generation adjustment adds a per-run namespace while preserving the controller/handler/policy/IP hash scope. Trust proxy remains false. NODE_ENV stays `test`; external integrations remain off.

Observed over HTTP:

- Firebase exchange's actual decorator permits three malformed 400 requests across two independent fixtures; remaining-short becomes 0; the fourth is 429 with `Retry-After-short: 1`. Changing X-Forwarded-For each time does not evade the limit. After 1100 ms a new request again reaches DTO validation (400).
- Admin upload's actual 2/second policy counts two 403 role denials; a request to the second fixture returns 429. This also establishes enforcement before the route's role guard.
- AI's actual 20/minute policy permits twenty 400 input denials, paced to avoid the separate global short window; request 21 on another fixture is 429 with a positive medium retry delay. Gemini's observed call count does not increase.
- Matching namespaced Redis throttle keys actually exist. The fixture requires Redis status `up`, so it cannot silently pass through the in-memory fallback.

This proves real HTTP guard/metadata/storage integration and shared limits for the exercised routes. It does not test deployment proxy configuration, every route decorator, a 60-second recovery, network partitions, Redis restart/reconnect or production multi-host traffic. The parent owns a separate Redis reconnect change and dedicated restart experiment on port 6381; those results are not claimed here. The shared Redis server was not stopped.

## Proven observations versus hypotheses

No application authorization bypass or sensitive public-response disclosure was reproduced by the initial HTTP tests. That phase did not patch application source. The later log-privacy hardening addresses a separately confirmed disclosure in server logs, described below; it does not establish an HTTP-response disclosure. Setup failures caused by invalid fixture enum/code/review-constraint data were corrected in the test, not treated as security defects. The first restricted-environment run could not reach PostgreSQL; reruns with local-service access exercised real services.

Source-inspected limitations, **not proven reachable exploits**:

- Shared image validators recognize raster signatures; these checks do not fully decode an image or establish polyglot safety. The scripted-SVG deny checks are not a complete sanitizer. Actual Cloudinary decoding/delivery behavior remains untested because storage is substituted. The passing PNG test must not be described as proving all image formats safe.
- Public-response checks cover seeded/sampled routes and payloads. They do not establish universal absence of sensitive data in every route or log.
- Gemini, Firebase, SMTP, payment gateways and media delivery are disabled or substituted. Provider verification, private URL signature expiry, third-party moderation, payment callbacks and actual delivery cannot be inferred from these results.
- Authorization lifecycle races and WebSocket/SSE behavior beyond the outsider SSE denial remain the responsibility of the existing specialized tests, which were not rerun here.

## Historical installed dependencies and advisory snapshot (before overrides)

Initial inventory time: 2026-10-30, before the parent's override/lock refresh. Local Node: **24.15.0**. The Dockerfile declares Node 22; this worker did not inspect the image or its exact patch version. Every version in this historical inventory was compared with the then-installed checkout package's `package.json`, without reading env files or package configuration secrets. This worker ran no install, audit fix or lock rewrite. The later parent-reported physical old-image checks and dependency changes are recorded separately below; do not use this inventory as the new image's package list.

Initial direct runtime declarations and installed/locked versions (all pairs agreed at that time):

| Package                                                | Exact version |
| ------------------------------------------------------ | ------------- |
| @nestjs/common, @nestjs/core, @nestjs/platform-express | 11.1.28       |
| @nestjs/config                                         | 4.0.4         |
| @nestjs/jwt                                            | 11.0.2        |
| @nestjs/schedule                                       | 6.1.3         |
| @nestjs/swagger                                        | 11.4.7        |
| @nestjs/throttler                                      | 6.7.1         |
| @prisma/client                                         | 6.19.3        |
| argon2                                                 | 0.45.1        |
| class-transformer                                      | 0.5.1         |
| class-validator                                        | 0.15.1        |
| cloudinary                                             | 2.11.0        |
| cookie                                                 | 1.0.2         |
| dotenv                                                 | 18.0.3        |
| firebase-admin                                         | 14.5.0        |
| nodemailer                                             | 10.0.10       |
| redis                                                  | 6.2.1         |
| reflect-metadata                                       | 0.2.2         |
| rxjs                                                   | 7.8.2         |
| sepay-pg-node                                          | 1.0.0         |

The initial `npm audit --omit=dev --json --ignore-scripts` failed with registry DNS ENOTFOUND in the restricted environment. The permitted retry completed and exited **1 because advisories were found**, returning **12 affected package entries: 5 high, 7 moderate, 0 critical** before the dependency changes. The parent subsequently reported the same audit totals for the old image. These are historical package/path rollups, not twelve independent reachable exploits or the final image's current advisory count. Its metadata reports 294 prod, 554 dev, 110 optional and 12 peer entries; these npm classifications overlap and differ from counting physical lock paths. A full development-dependency audit was not requested or performed.

| Installed package/path                                   | Audit classification and advisory                                                                                                                                                                                                                                                                                                                                                                                                  | Reachability assessment (source inference unless explicitly tested)                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| body-parser 2.3.0                                        | High, [compressed trailing bytes DoS](https://github.com/advisories/GHSA-27r3-jxmh-p828)                                                                                                                                                                                                                                                                                                                                           | Nest/Express JSON body parsing is in the HTTP path. Treat as a runtime candidate; compressed teardown/crash behavior was not exercised. DTO validation or the new 429 evidence does not prove this fixed.                                                                                                                                                                                                |
| multer 2.3.0                                             | High rollup: [async fileFilter teardown](https://github.com/advisories/GHSA-q7qp-rjg7-q26m); moderate [orphaned disk writes](https://github.com/advisories/GHSA-3pph-fpjx-jg34)                                                                                                                                                                                                                                                    | Multipart is reachable. Inspected interceptors use memory storage and no custom asynchronous fileFilter/diskStorage was found under source; the advisory-specific prerequisites were not demonstrated. No aborted-upload exploit test was run.                                                                                                                                                           |
| @nestjs/platform-express 11.1.28                         | Moderate transitive rollup via multer                                                                                                                                                                                                                                                                                                                                                                                              | Same underlying dependency finding, not a separate exploit. Existing package override pins multer 2.3.0; this task does not change it.                                                                                                                                                                                                                                                                   |
| @nestjs/swagger/node_modules/js-yaml 5.3.0               | Moderate, [merge-key CPU use](https://github.com/advisories/GHSA-r3ph-w7gj-g6xm)                                                                                                                                                                                                                                                                                                                                                   | Runtime-declared Swagger dependency. Inspected source has no untrusted YAML loader; Swagger setup is gated to development. No vulnerable YAML path shown. Root js-yaml 4.3.1 and NYC's 3.15.1 are dev-only separate paths.                                                                                                                                                                               |
| @nestjs/swagger 11.4.7                                   | Moderate transitive rollup via js-yaml                                                                                                                                                                                                                                                                                                                                                                                             | Same advisory chain, not another reproduced issue.                                                                                                                                                                                                                                                                                                                                                       |
| nodemailer 10.0.10                                       | Moderate: [nested comment recipient confusion](https://github.com/advisories/GHSA-8c8m-p3m8-cjg8), [group delimiter confusion](https://github.com/advisories/GHSA-m943-m63m-w62w), [quoted local part confusion](https://github.com/advisories/GHSA-85x2-q946-cp5h), [SMTP AUTH regex DoS](https://github.com/advisories/GHSA-4ffr-jq9g-5ffx), [angle-address comment handling](https://github.com/advisories/GHSA-g73g-hqqh-jr95) | Runtime mail adapter exists but delivery is off/substituted here. Recipient-parser input control and hostile SMTP-server preconditions were not established; no real mail sent.                                                                                                                                                                                                                          |
| qs 6.16.0                                                | Moderate, [comma stringify TypeError](https://github.com/advisories/GHSA-6pq8-jhm2-2vcw)                                                                                                                                                                                                                                                                                                                                           | Installed HTTP dependency, but the cited issue requires stringify with comma array format and a particular object shape. No direct source use of that API found; query validation is not an exploit proof or a fix.                                                                                                                                                                                      |
| uuid 9.0.1; gaxios 6.7.1                                 | Moderate uuid [caller-buffer bounds issue](https://github.com/advisories/GHSA-w5hq-g745-h8pq); gaxios transitive rollup                                                                                                                                                                                                                                                                                                            | Optional Google dependency paths. No direct application import or caller-controlled versioned UUID output-buffer path found. This does not prove every transitive caller safe. Other installed gaxios 7.x paths are separately listed in the inventory.                                                                                                                                                  |
| prisma 6.19.3; @prisma/config 6.19.3; deepmerge-ts 7.1.5 | Three high rollup entries from [recursive merge stack exhaustion](https://github.com/advisories/GHSA-ggr8-5vv4-36mx)                                                                                                                                                                                                                                                                                                               | Root Prisma CLI is a **devDependency**, also retained as @prisma/client's optional peer; lock records mark this chain `devOptional`, so omit-dev still reports it. Do not label these three as confirmed production HTTP issues. No untrusted recursive-configuration merge path shown. Current Dockerfile removes dev declarations and prunes peers, but the final shipped image was not verified here. |

The parent has now applied the compatible fix targets researched below. Physical verification and a new audit of the resulting final image remain parent-owned. No denial-of-service payload was sent to the running application.

## Parent-reported physical old-image verification

These findings were supplied by the parent, not independently collected by this worker. They apply to the **old image only** and do not change the historical checkout inventory or establish the contents of the image now being built.

| Package/path                                        | Physical old-image result | Evidence implication                                                                                                                                                                                                   |
| --------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prisma`, `@prisma/config`, `deepmerge-ts`          | Confirmed absent          | The three high Prisma/config/deepmerge audit rollups must not be presented as physically shipped runtime packages in that old image. Optional-peer/lock metadata and audit entries do not prove physical installation. |
| Root `node_modules/js-yaml`                         | Confirmed absent          | Root absence does not establish absence of Swagger's nested copy.                                                                                                                                                      |
| `node_modules/@nestjs/swagger/node_modules/js-yaml` | Inspection still pending  | Keep the nested js-yaml/Swagger advisory chain unresolved until its physical path/version is checked. Do not infer it absent from the root-path result.                                                                |
| `gaxios` 6.7.1 and `uuid` 9.0.1                     | Confirmed present         | These older dependency paths are physically shipped in the old image. Their presence is not proof that the cited vulnerable UUID API is reachable from application input.                                              |

Do not derive a new headline advisory count by subtracting missing packages from the old npm audit totals: its entries include dependency rollups and lock metadata. The parent's final-image audit and physical dependency checks supersede those old totals in the overall report.

## Authorized Cloudinary and mail log-privacy hardening

The parent identified a concrete server-log issue after the initial evidence phase: the existing Cloudinary unit-test error text `provider credential detail` reached logs, while mail logs included recipient/sender email and unfiltered SMTP error information. This is confirmed log disclosure evidence; it is separate from the passing HTTP response-concealment checks.

The authorized implementation was limited to these six files:

- `src/infrastructure/upload/cloudinary.service.ts` and `.spec.ts`.
- `src/infrastructure/mail/mail.service.ts` and the new `mail.service.spec.ts`.
- `src/infrastructure/mail/mail-outbox.service.ts` and `.spec.ts`.

Cloudinary upload, publication and deletion failures now log fixed operation-event strings only. SMTP verification and mail-outbox failure logs contain a fixed operation event and, when valid, only an allowlisted error `code` and an integer `responseCode` between 100 and 599. The shared allowlist contains `EAUTH`, `ECONNECTION`, `ESOCKET`, `ETIMEDOUT`, `EDNS`, `EENVELOPE`, `EMESSAGE`, `ESTREAM`, `ETLS`, `ECONNRESET`, `ECONNREFUSED`, `ENOTFOUND` and `EAI_AGAIN`. Arbitrary code strings, strings masquerading as response codes, fractions, infinity and out-of-range response codes are discarded.

Mail success/disabled-delivery events no longer include sender, recipient, subject, outbox IDs or the caller-supplied processing source. Raw error messages, stacks, commands, SMTP responses, public IDs and signed URLs are not passed to these log calls. Existing API exception messages, direct send-error propagation, retry scheduling, lease behavior and attempt limits remain unchanged. No global exception filter was introduced; Gemini/Redis/push logging belongs to other parent-coordinated work and is outside this implementation's claims.

Validation: **3 focused suites passed; 24 tests passed; 0 snapshots; 10.321 seconds**, exit 0 on Windows. These tests include both pre-existing behavior checks and the new privacy assertions; 24 is the total across the three suites, not 24 newly added tests. The Cloudinary privacy test drives all five failure operations with sensitive provider-error, public-ID, signed-URL and stack sentinels, asserts the unchanged exception messages, and checks every argument of every logger call. Mail tests exercise successful and disabled paths, allowed SMTP metadata, rejected untrusted metadata, preserved send failure propagation, outbox retry/exhaustion and processing failures without sensitive log output.

Source and test typechecks, scoped ESLint, Prettier checks and `git diff --check` all exited 0 after this implementation. Exact commands, run from `D:/Project/Lambe/backend`:

```powershell
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath src/infrastructure/upload/cloudinary.service.spec.ts src/infrastructure/mail/mail.service.spec.ts src/infrastructure/mail/mail-outbox.service.spec.ts
node node_modules/typescript/bin/tsc --noEmit --incremental false -p tsconfig.build.json
node node_modules/typescript/bin/tsc --noEmit --incremental false -p tsconfig.spec.json
node node_modules/eslint/bin/eslint.js src/infrastructure/upload/cloudinary.service.ts src/infrastructure/upload/cloudinary.service.spec.ts src/infrastructure/mail/mail.service.ts src/infrastructure/mail/mail.service.spec.ts src/infrastructure/mail/mail-outbox.service.ts src/infrastructure/mail/mail-outbox.service.spec.ts
node node_modules/prettier/bin/prettier.cjs --check src/infrastructure/upload/cloudinary.service.ts src/infrastructure/upload/cloudinary.service.spec.ts src/infrastructure/mail/mail.service.ts src/infrastructure/mail/mail.service.spec.ts src/infrastructure/mail/mail-outbox.service.ts src/infrastructure/mail/mail-outbox.service.spec.ts
git diff --check -- src/infrastructure/upload/cloudinary.service.ts src/infrastructure/upload/cloudinary.service.spec.ts src/infrastructure/mail/mail.service.ts src/infrastructure/mail/mail.service.spec.ts src/infrastructure/mail/mail-outbox.service.ts src/infrastructure/mail/mail-outbox.service.spec.ts
```

This focused logging validation predates the parent-owned lock refresh/new image. No tests or source edits were made during that documentation-only pass. The later authorized test-only CI portability correction and its host validation are recorded below; frozen-source Linux Node 22 regression and final-image validation remain parent-owned.

## CI target portability correction and latest scoped result

The parent reported that Docker full e2e failed the security suite's 28 HTTP tests because this fixture overwrote the injected PostgreSQL URL with `localhost:5433`. That was a fixture defect. The necessary correction changes only `test/quality-security.e2e-spec.ts` and this evidence document; application source remains frozen.

Before importing AppModule or opening connections, the fixture now requires:

- `NODE_ENV=test` and explicit, exactly matching `DATABASE_URL` and `TEST_DATABASE_URL` values.
- A `postgres:` or `postgresql:` URL with database pathname matching `/lambe_booking_test_[a-z0-9_]+`.
- An explicit `redis:` or `rediss:` URL for logical database `/15`.

It preserves the caller's database and Redis URLs, derives the expected database name from the validated PostgreSQL pathname, and asserts `current_database()` against that name before creating data. The temporary `DIRECT_URL` also uses the validated target. Missing/malformed targets, URL mismatch, a non-test database, production NODE_ENV and Redis DB0 are rejected. There is no localhost fallback or `.env`/application-settings fallback. Docker hosts such as `postgres:5432/lambe_booking_test_quality_regression_20261030_01` and `redis:6379/15` are accepted.

Latest scoped host validation: **37 tests passed, 1 suite passed, 0 snapshots, 13.8 seconds**, exit 0. This includes the original 28 HTTP cases plus **9 target-guard cases**; it is not 37 HTTP authorization cases. The host run explicitly supplied matching database URLs for the approved security database and the approved Redis DB15 URL. Test typecheck and scoped ESLint exited 0; formatting checks passed. The parent owns the Docker full-e2e rerun; this host pass does not claim that Docker regression has completed.

Execution command, from `D:/Project/Lambe/backend`, after explicitly supplying the approved targets:

```powershell
node node_modules/jest/bin/jest.js --config test/jest-e2e.json --runInBand --runTestsByPath test/quality-security.e2e-spec.ts
node node_modules/typescript/bin/tsc --noEmit --incremental false -p tsconfig.spec.json
node node_modules/eslint/bin/eslint.js test/quality-security.e2e-spec.ts
```

## Initial HTTP evidence: exact validation commands and results

Working directory for the following commands: `D:/Project/Lambe/backend`. The e2e command requires permission to connect to the approved local PostgreSQL/Redis services in this environment.

```powershell
node node_modules/prettier/bin/prettier.cjs --write test/quality-security.e2e-spec.ts
node node_modules/prettier/bin/prettier.cjs --write docs/quality-security-evidence.md
node node_modules/jest/bin/jest.js --config test/jest-e2e.json --runInBand --runTestsByPath test/quality-security.e2e-spec.ts
node node_modules/typescript/bin/tsc --noEmit --incremental false -p tsconfig.build.json
node node_modules/typescript/bin/tsc --noEmit --incremental false -p tsconfig.spec.json
node node_modules/eslint/bin/eslint.js test/quality-security.e2e-spec.ts
node node_modules/prettier/bin/prettier.cjs --check test/quality-security.e2e-spec.ts docs/quality-security-evidence.md
npm audit --omit=dev --json --ignore-scripts
```

- Final recorded focused Jest run: **exit 0; 1 passed suite; 28 passed tests; 0 snapshots; 7.491 s**.
- Final source typecheck: **exit 0**, no diagnostics.
- Touched test ESLint: **exit 0**, no findings. Markdown was subsequently formatted with the listed Prettier command.
- Final test typecheck: **exit 0**, no diagnostics. An earlier concurrent check reported 11 errors outside the owned files: two in `src/modules/health/health.controller.spec.ts` and nine in `test/observability.e2e-spec.ts`, all TS2558 (expected 0 type arguments, got 1). These were resolved by their owning work; no changes to those files were made by this task.
- npm audit: **exit 1, completed advisory report**, as detailed above. No `npm audit fix` or package install.

The parent's full check after the shared source freezes is still required; these focused results are not a claim that every workspace check or deployed integration passes.

## Advisory follow-up: compatible published fix candidates (2026-10-30)

The version-research follow-up read official GHSA records, npm registry metadata (`npm view`) and local package/lock metadata only; it performed no installation, exploit test, source edit or lockfile mutation. The parent has subsequently applied the three researched override targets and refreshed the lockfile. These are published fixes for the cited advisories, not a claim that every advisory is resolved or the new image's application compatibility has passed regression.

| Priority                           | Installed → recommended           | Official affected range / fix boundary                                                                                                                                                                                                  | Compatibility evidence                                                                                                                                                                                                                                                                                    |
| ---------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First: default HTTP parsing        | body-parser 2.3.0 → **2.4.0**     | [GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828): `>=2.0.0 <2.4.0`; patched `2.4.0` (1.x patched at `1.20.9`)                                                                                                   | npm confirms 2.4.0 is the latest 2.x stable release, requires Node `>=18`, and satisfies Express 5.2.1's `^2.2.1` dependency range. It fits planned Node 22.                                                                                                                                              |
| Second: multipart dependency       | multer override 2.3.0 → **2.5.0** | [High GHSA-q7qp-rjg7-q26m](https://github.com/advisories/GHSA-q7qp-rjg7-q26m): `>=2.0.0 <2.5.0`; patched `2.5.0`. [Moderate GHSA-3pph-fpjx-jg34](https://github.com/advisories/GHSA-3pph-fpjx-jg34): `>=2.2.0 <2.4.0`; patched `2.4.0`. | npm confirms 2.5.0 is the latest 2.x stable release, requires Node `>=10.16.0`, and retains busboy `^1.6.0`. Keep the existing override approach; Nest 11.1.28 pins multer **exactly 2.2.0**, so this is intentionally outside its declared exact dependency pin and needs regression evidence.           |
| Required companion for body-parser | qs override 6.16.0 → **6.16.2**   | [GHSA-6pq8-jhm2-2vcw](https://github.com/advisories/GHSA-6pq8-jhm2-2vcw): `>=6.7.0 <=6.16.0`; first patched `6.16.1`.                                                                                                                   | body-parser 2.4.0 declares qs **`^6.16.1`**. Keeping the old global 6.16.0 override would force a version outside that declared range. npm confirms 6.16.2 is published and the newest `~6.16.0` release; `>=0.6` engine. Latest 6.x is 6.17.1, but this recommendation stays on the existing minor line. |

The parent reports the following exact override values now applied, followed by `npm install --package-lock-only --ignore-scripts --no-audit`. A read-only check confirmed matching current root lock versions for all three packages:

```json
{
  "overrides": {
    "body-parser": "2.4.0",
    "multer": "2.5.0",
    "qs": "6.16.2"
  }
}
```

An explicit body-parser override is optional if a targeted lock refresh resolves 2.4.0 everywhere through Express's existing compatible range; the exact override makes the intended version reviewable. Do not add a redundant direct runtime dependency just to refresh the transitive package. These are two minor upgrades within major 2 plus one patch upgrade within qs 6.16; no Nest/Express major upgrade is needed.

**A Nest-only upgrade would have been insufficient:** the queried npm metadata reported the newest `@nestjs/platform-express@11` as **11.2.8**, still depending on multer **2.4.0**, which remains inside the high advisory's range. The previous override would also have continued forcing 2.3.0 without the parent's change. Multer 3.0.0-alpha.2 was tagged `next`; it is not needed for these fixes.

Production priority is based on the advisory's prerequisites, not a reproduced crash: body-parser's default inflation path runs before routing/authentication, so route guards/throttles cannot be treated as its fix. Multer's high advisory requires an **asynchronous fileFilter**, independently of memory/disk storage; synchronous filters are stated unaffected. The moderate issue specifically requires **diskStorage**. Earlier source inspection found neither custom async fileFilter nor diskStorage in the application; no exploitability experiment was done. This distinction supports prioritizing body-parser while still taking the available same-major multer fix.

Official npm version metadata: [body-parser 2.4.0](https://registry.npmjs.org/body-parser/2.4.0), [multer 2.5.0](https://registry.npmjs.org/multer/2.5.0), [qs 6.16.2](https://registry.npmjs.org/qs/6.16.2), [Nest adapter 11.2.8](https://registry.npmjs.org/@nestjs%2fplatform-express/11.2.8). Browser rendering of registry/npm version pages was unavailable, but the `npm view` queries below completed successfully against the registry.

Read-only queries used (working directory `backend`):

```powershell
npm view body-parser@2.4.0 version engines dependencies deprecated --json
npm view body-parser@2 version --json
npm view body-parser dist-tags --json
npm view multer@2.5.0 version engines dependencies deprecated --json
npm view multer@2 version --json
npm view multer dist-tags --json
npm view express@5.2.1 version dependencies.body-parser engines --json
npm view '@nestjs/platform-express@11' version --json
npm view '@nestjs/platform-express@11.2.8' version dependencies engines peerDependencies --json
npm view '@nestjs/platform-express@11.1.28' dependencies.multer dependencies.express --json
npm view qs@6.16.1 version engines deprecated --json
npm view 'qs@~6.16.0' version engines deprecated --json
npm view qs@6 version --json
npm view qs@6.17.1 version engines deprecated --json
```

All npm metadata queries exited 0; none of these packages reported a deprecation field in the queried version metadata. The parent has completed the lock-only refresh and started the image build; the parent owns the post-build audit, physical final-image verification and Linux Node 22 regression. The earlier Windows 28-test pass predates the parent's later module integration; neither it nor the 24-test logging pass is new regression evidence for the updated dependency versions.

## Historical checkout runtime-path inventory (before overrides)

The following is the preserved **pre-change checkout snapshot**, not a current lock or Docker runtime inventory: 302 runtime paths and 71 ambiguous dev/optional-peer paths were physically present and version-matched in this Windows checkout at inventory time. It intentionally retains old body-parser/multer/qs versions as historical evidence. Root-declared dev-only tooling is excluded from the runtime list. Optional marks lock optionality, not proof a feature is enabled. Checkout path counts differ from npm audit dependency categories and from the parent's pruned runtime-image contents.

<details>
<summary>Runtime-declared/transitive paths (302)</summary>

| Lock/installed path                                                                    | Locked   | Installed | Optional |
| -------------------------------------------------------------------------------------- | -------- | --------- | -------- |
| node_modules/@borewit/text-codec                                                       | 0.2.2    | 0.2.2     |          |
| node_modules/@epic-web/invariant                                                       | 1.0.0    | 1.0.0     |          |
| node_modules/@fastify/busboy                                                           | 3.2.2    | 3.2.2     |          |
| node_modules/@firebase/app-check-interop-types                                         | 0.3.5    | 0.3.5     |          |
| node_modules/@firebase/app-types                                                       | 0.9.6    | 0.9.6     |          |
| node_modules/@firebase/auth-interop-types                                              | 0.2.6    | 0.2.6     |          |
| node_modules/@firebase/component                                                       | 0.7.5    | 0.7.5     |          |
| node_modules/@firebase/database                                                        | 1.1.5    | 1.1.5     |          |
| node_modules/@firebase/database-compat                                                 | 2.1.7    | 2.1.7     |          |
| node_modules/@firebase/database-types                                                  | 1.0.22   | 1.0.22    |          |
| node_modules/@firebase/logger                                                          | 0.5.2    | 0.5.2     |          |
| node_modules/@firebase/util                                                            | 1.15.3   | 1.15.3    |          |
| node_modules/@google-cloud/firestore                                                   | 9.2.0    | 9.2.0     | yes      |
| node_modules/@google-cloud/firestore-api                                               | 0.2.0    | 0.2.0     | yes      |
| node_modules/@google-cloud/firestore-api/node_modules/gaxios                           | 7.3.1    | 7.3.1     | yes      |
| node_modules/@google-cloud/firestore-api/node_modules/gcp-metadata                     | 8.1.4    | 8.1.4     | yes      |
| node_modules/@google-cloud/firestore-api/node_modules/gcp-metadata/node_modules/gaxios | 7.1.3    | 7.1.3     | yes      |
| node_modules/@google-cloud/firestore-api/node_modules/google-auth-library              | 10.5.0   | 10.5.0    | yes      |
| node_modules/@google-cloud/firestore-api/node_modules/google-gax                       | 5.0.8    | 5.0.8     | yes      |
| node_modules/@google-cloud/firestore-api/node_modules/google-logging-utils             | 1.1.3    | 1.1.3     | yes      |
| node_modules/@google-cloud/firestore-api/node_modules/node-fetch                       | 3.3.2    | 3.3.2     | yes      |
| node_modules/@google-cloud/firestore-api/node_modules/proto3-json-serializer           | 3.0.4    | 3.0.4     | yes      |
| node_modules/@google-cloud/firestore-api/node_modules/retry-request                    | 8.0.4    | 8.0.4     | yes      |
| node_modules/@google-cloud/firestore-api/node_modules/teeny-request                    | 10.1.4   | 10.1.4    | yes      |
| node_modules/@google-cloud/paginator                                                   | 7.1.0    | 7.1.0     | yes      |
| node_modules/@google-cloud/projectify                                                  | 6.1.0    | 6.1.0     | yes      |
| node_modules/@google-cloud/promisify                                                   | 6.1.0    | 6.1.0     | yes      |
| node_modules/@google-cloud/storage                                                     | 8.2.0    | 8.2.0     | yes      |
| node_modules/@google-cloud/storage/node_modules/gcp-metadata                           | 6.1.1    | 6.1.1     | yes      |
| node_modules/@google-cloud/storage/node_modules/google-auth-library                    | 9.15.1   | 9.15.1    | yes      |
| node_modules/@google-cloud/storage/node_modules/google-logging-utils                   | 0.0.2    | 0.0.2     | yes      |
| node_modules/@google-cloud/storage/node_modules/gtoken                                 | 7.1.0    | 7.1.0     | yes      |
| node_modules/@google-cloud/storage/node_modules/mime                                   | 3.0.0    | 3.0.0     | yes      |
| node_modules/@grpc/grpc-js                                                             | 1.14.5   | 1.14.5    | yes      |
| node_modules/@grpc/proto-loader                                                        | 0.8.1    | 0.8.1     | yes      |
| node_modules/@js-sdsl/ordered-map                                                      | 4.4.2    | 4.4.2     | yes      |
| node_modules/@lukeed/csprng                                                            | 1.1.0    | 1.1.0     |          |
| node_modules/@microsoft/tsdoc                                                          | 0.16.0   | 0.16.0    |          |
| node_modules/@nestjs/common                                                            | 11.1.28  | 11.1.28   |          |
| node_modules/@nestjs/config                                                            | 4.0.4    | 4.0.4     |          |
| node_modules/@nestjs/config/node_modules/dotenv                                        | 17.4.1   | 17.4.1    |          |
| node_modules/@nestjs/core                                                              | 11.1.28  | 11.1.28   |          |
| node_modules/@nestjs/jwt                                                               | 11.0.2   | 11.0.2    |          |
| node_modules/@nestjs/mapped-types                                                      | 2.1.1    | 2.1.1     |          |
| node_modules/@nestjs/platform-express                                                  | 11.1.28  | 11.1.28   |          |
| node_modules/@nestjs/schedule                                                          | 6.1.3    | 6.1.3     |          |
| node_modules/@nestjs/swagger                                                           | 11.4.7   | 11.4.7    |          |
| node_modules/@nestjs/swagger/node_modules/js-yaml                                      | 5.3.0    | 5.3.0     |          |
| node_modules/@nestjs/throttler                                                         | 6.7.1    | 6.7.1     |          |
| node_modules/@nodable/entities                                                         | 3.0.0    | 3.0.0     | yes      |
| node_modules/@opentelemetry/api                                                        | 1.9.1    | 1.9.1     | yes      |
| node_modules/@phc/format                                                               | 1.0.0    | 1.0.0     |          |
| node_modules/@pkgjs/parseargs                                                          | 0.11.0   | 0.11.0    | yes      |
| node_modules/@prisma/client                                                            | 6.19.3   | 6.19.3    |          |
| node_modules/@protobufjs/aspromise                                                     | 1.1.2    | 1.1.2     | yes      |
| node_modules/@protobufjs/base64                                                        | 1.1.2    | 1.1.2     | yes      |
| node_modules/@protobufjs/codegen                                                       | 2.0.5    | 2.0.5     | yes      |
| node_modules/@protobufjs/eventemitter                                                  | 1.1.1    | 1.1.1     | yes      |
| node_modules/@protobufjs/fetch                                                         | 1.1.1    | 1.1.1     | yes      |
| node_modules/@protobufjs/float                                                         | 1.0.2    | 1.0.2     | yes      |
| node_modules/@protobufjs/path                                                          | 1.1.2    | 1.1.2     | yes      |
| node_modules/@protobufjs/pool                                                          | 1.1.0    | 1.1.0     | yes      |
| node_modules/@protobufjs/utf8                                                          | 1.1.2    | 1.1.2     | yes      |
| node_modules/@redis/bloom                                                              | 6.2.1    | 6.2.1     |          |
| node_modules/@redis/client                                                             | 6.2.1    | 6.2.1     |          |
| node_modules/@redis/json                                                               | 6.2.1    | 6.2.1     |          |
| node_modules/@redis/search                                                             | 6.2.1    | 6.2.1     |          |
| node_modules/@redis/time-series                                                        | 6.2.1    | 6.2.1     |          |
| node_modules/@scarf/scarf                                                              | 1.4.0    | 1.4.0     |          |
| node_modules/@tokenizer/inflate                                                        | 0.4.1    | 0.4.1     |          |
| node_modules/@tokenizer/token                                                          | 0.3.0    | 0.3.0     |          |
| node_modules/@types/jsonwebtoken                                                       | 9.0.10   | 9.0.10    |          |
| node_modules/@types/luxon                                                              | 3.7.5    | 3.7.5     |          |
| node_modules/@types/ms                                                                 | 2.1.0    | 2.1.0     |          |
| node_modules/@types/node                                                               | 24.13.3  | 24.13.3   |          |
| node_modules/@types/validator                                                          | 13.15.10 | 13.15.10  |          |
| node_modules/abort-controller                                                          | 3.0.0    | 3.0.0     | yes      |
| node_modules/accepts                                                                   | 2.0.0    | 2.0.0     |          |
| node_modules/agent-base                                                                | 7.1.4    | 7.1.4     |          |
| node_modules/anynum                                                                    | 1.0.1    | 1.0.1     | yes      |
| node_modules/append-field                                                              | 1.0.0    | 1.0.0     |          |
| node_modules/argon2                                                                    | 0.45.1   | 0.45.1    |          |
| node_modules/argparse                                                                  | 2.0.1    | 2.0.1     |          |
| node_modules/async-retry                                                               | 1.3.3    | 1.3.3     | yes      |
| node_modules/asynckit                                                                  | 0.4.0    | 0.4.0     |          |
| node_modules/axios                                                                     | 1.20.0   | 1.20.0    |          |
| node_modules/axios/node_modules/agent-base                                             | 6.0.2    | 6.0.2     |          |
| node_modules/axios/node_modules/https-proxy-agent                                      | 5.0.1    | 5.0.1     |          |
| node_modules/base64-js                                                                 | 1.5.1    | 1.5.1     |          |
| node_modules/bignumber.js                                                              | 9.3.1    | 9.3.1     |          |
| node_modules/body-parser                                                               | 2.3.0    | 2.3.0     |          |
| node_modules/body-parser/node_modules/content-type                                     | 2.0.0    | 2.0.0     |          |
| node_modules/buffer-equal-constant-time                                                | 1.0.1    | 1.0.1     |          |
| node_modules/buffer-from                                                               | 1.1.2    | 1.1.2     |          |
| node_modules/busboy                                                                    | 1.6.0    | 1.6.0     |          |
| node_modules/bytes                                                                     | 3.1.2    | 3.1.2     |          |
| node_modules/call-bind-apply-helpers                                                   | 1.0.2    | 1.0.2     |          |
| node_modules/call-bound                                                                | 1.0.4    | 1.0.4     |          |
| node_modules/class-transformer                                                         | 0.5.1    | 0.5.1     |          |
| node_modules/class-validator                                                           | 0.15.1   | 0.15.1    |          |
| node_modules/cloudinary                                                                | 2.11.0   | 2.11.0    |          |
| node_modules/cluster-key-slot                                                          | 1.1.2    | 1.1.2     |          |
| node_modules/combined-stream                                                           | 1.0.8    | 1.0.8     |          |
| node_modules/concat-stream                                                             | 2.0.0    | 2.0.0     |          |
| node_modules/content-disposition                                                       | 1.1.0    | 1.1.0     |          |
| node_modules/content-type                                                              | 1.0.5    | 1.0.5     |          |
| node_modules/cookie                                                                    | 1.0.2    | 1.0.2     |          |
| node_modules/cookie-signature                                                          | 1.2.2    | 1.2.2     |          |
| node_modules/cors                                                                      | 2.8.6    | 2.8.6     |          |
| node_modules/cron                                                                      | 4.4.0    | 4.4.0     |          |
| node_modules/cross-env                                                                 | 10.1.0   | 10.1.0    |          |
| node_modules/cross-spawn                                                               | 7.0.6    | 7.0.6     |          |
| node_modules/data-uri-to-buffer                                                        | 4.0.1    | 4.0.1     |          |
| node_modules/debug                                                                     | 4.4.3    | 4.4.3     |          |
| node_modules/delayed-stream                                                            | 1.0.0    | 1.0.0     |          |
| node_modules/depd                                                                      | 2.0.0    | 2.0.0     |          |
| node_modules/dotenv                                                                    | 18.0.3   | 18.0.3    |          |
| node_modules/dotenv-expand                                                             | 12.0.3   | 12.0.3    |          |
| node_modules/dotenv-expand/node_modules/dotenv                                         | 16.6.1   | 16.6.1    |          |
| node_modules/dunder-proto                                                              | 1.0.1    | 1.0.1     |          |
| node_modules/duplexify                                                                 | 4.1.3    | 4.1.3     | yes      |
| node_modules/ecdsa-sig-formatter                                                       | 1.0.11   | 1.0.11    |          |
| node_modules/ee-first                                                                  | 1.1.1    | 1.1.1     |          |
| node_modules/encodeurl                                                                 | 2.0.0    | 2.0.0     |          |
| node_modules/end-of-stream                                                             | 1.4.5    | 1.4.5     | yes      |
| node_modules/es-define-property                                                        | 1.0.1    | 1.0.1     |          |
| node_modules/es-errors                                                                 | 1.3.0    | 1.3.0     |          |
| node_modules/es-object-atoms                                                           | 1.1.2    | 1.1.2     |          |
| node_modules/es-set-tostringtag                                                        | 2.1.0    | 2.1.0     |          |
| node_modules/escape-html                                                               | 1.0.3    | 1.0.3     |          |
| node_modules/etag                                                                      | 1.8.1    | 1.8.1     |          |
| node_modules/event-target-shim                                                         | 5.0.1    | 5.0.1     | yes      |
| node_modules/express                                                                   | 5.2.1    | 5.2.1     |          |
| node_modules/express/node_modules/cookie                                               | 0.7.2    | 0.7.2     |          |
| node_modules/extend                                                                    | 3.0.2    | 3.0.2     |          |
| node_modules/fast-deep-equal                                                           | 3.1.3    | 3.1.3     |          |
| node_modules/fast-safe-stringify                                                       | 2.1.1    | 2.1.1     |          |
| node_modules/fast-xml-builder                                                          | 1.3.1    | 1.3.1     | yes      |
| node_modules/fast-xml-parser                                                           | 5.11.1   | 5.11.1    | yes      |
| node_modules/faye-websocket                                                            | 0.11.4   | 0.11.4    |          |
| node_modules/fetch-blob                                                                | 3.2.0    | 3.2.0     |          |
| node_modules/file-type                                                                 | 21.3.4   | 21.3.4    |          |
| node_modules/finalhandler                                                              | 2.1.1    | 2.1.1     |          |
| node_modules/firebase-admin                                                            | 14.5.0   | 14.5.0    |          |
| node_modules/follow-redirects                                                          | 1.16.1   | 1.16.1    |          |
| node_modules/form-data                                                                 | 4.0.6    | 4.0.6     |          |
| node_modules/form-data/node_modules/mime-db                                            | 1.52.0   | 1.52.0    |          |
| node_modules/form-data/node_modules/mime-types                                         | 2.1.35   | 2.1.35    |          |
| node_modules/formdata-polyfill                                                         | 4.0.10   | 4.0.10    |          |
| node_modules/forwarded                                                                 | 0.2.0    | 0.2.0     |          |
| node_modules/fresh                                                                     | 2.0.0    | 2.0.0     |          |
| node_modules/function-bind                                                             | 1.1.2    | 1.1.2     |          |
| node_modules/functional-red-black-tree                                                 | 1.0.1    | 1.0.1     | yes      |
| node_modules/gaxios                                                                    | 6.7.1    | 6.7.1     | yes      |
| node_modules/gcp-metadata                                                              | 9.0.4    | 9.0.4     |          |
| node_modules/gcp-metadata/node_modules/gaxios                                          | 7.3.1    | 7.3.1     |          |
| node_modules/gcp-metadata/node_modules/node-fetch                                      | 3.3.2    | 3.3.2     |          |
| node_modules/get-intrinsic                                                             | 1.3.0    | 1.3.0     |          |
| node_modules/get-proto                                                                 | 1.0.1    | 1.0.1     |          |
| node_modules/google-auth-library                                                       | 11.1.0   | 11.1.0    |          |
| node_modules/google-auth-library/node_modules/gaxios                                   | 7.3.1    | 7.3.1     |          |
| node_modules/google-auth-library/node_modules/node-fetch                               | 3.3.2    | 3.3.2     |          |
| node_modules/google-gax                                                                | 6.7.0    | 6.7.0     | yes      |
| node_modules/google-gax/node_modules/node-fetch                                        | 3.3.2    | 3.3.2     | yes      |
| node_modules/google-logging-utils                                                      | 2.0.1    | 2.0.1     |          |
| node_modules/gopd                                                                      | 1.2.0    | 1.2.0     |          |
| node_modules/gtoken                                                                    | 8.0.0    | 8.0.0     | yes      |
| node_modules/gtoken/node_modules/gaxios                                                | 7.3.1    | 7.3.1     | yes      |
| node_modules/gtoken/node_modules/node-fetch                                            | 3.3.2    | 3.3.2     | yes      |
| node_modules/has-symbols                                                               | 1.1.0    | 1.1.0     |          |
| node_modules/has-tostringtag                                                           | 1.0.2    | 1.0.2     |          |
| node_modules/hasown                                                                    | 2.0.4    | 2.0.4     |          |
| node_modules/html-entities                                                             | 2.6.0    | 2.6.0     | yes      |
| node_modules/http-errors                                                               | 2.0.1    | 2.0.1     |          |
| node_modules/http-parser-js                                                            | 0.5.10   | 0.5.10    |          |
| node_modules/http-proxy-agent                                                          | 7.0.2    | 7.0.2     | yes      |
| node_modules/https-proxy-agent                                                         | 7.0.6    | 7.0.6     |          |
| node_modules/iconv-lite                                                                | 0.7.3    | 0.7.3     |          |
| node_modules/ieee754                                                                   | 1.2.1    | 1.2.1     |          |
| node_modules/inherits                                                                  | 2.0.4    | 2.0.4     |          |
| node_modules/ipaddr.js                                                                 | 1.9.1    | 1.9.1     |          |
| node_modules/is-promise                                                                | 4.0.0    | 4.0.0     |          |
| node_modules/is-unsafe                                                                 | 2.0.2    | 2.0.2     | yes      |
| node_modules/isexe                                                                     | 2.0.0    | 2.0.0     |          |
| node_modules/iterare                                                                   | 1.2.1    | 1.2.1     |          |
| node_modules/jose                                                                      | 6.2.12   | 6.2.12    |          |
| node_modules/json-bigint                                                               | 1.0.0    | 1.0.0     |          |
| node_modules/jsonwebtoken                                                              | 9.0.3    | 9.0.3     |          |
| node_modules/jwa                                                                       | 2.0.1    | 2.0.1     |          |
| node_modules/jwks-rsa                                                                  | 4.1.0    | 4.1.0     |          |
| node_modules/jwks-rsa/node_modules/lru-cache                                           | 11.5.3   | 11.5.3    |          |
| node_modules/jws                                                                       | 4.0.1    | 4.0.1     |          |
| node_modules/libphonenumber-js                                                         | 1.13.10  | 1.13.10   |          |
| node_modules/limiter                                                                   | 1.1.5    | 1.1.5     |          |
| node_modules/load-esm                                                                  | 1.0.3    | 1.0.3     |          |
| node_modules/lodash                                                                    | 4.18.1   | 4.18.1    |          |
| node_modules/lodash.camelcase                                                          | 4.3.0    | 4.3.0     | yes      |
| node_modules/lodash.clonedeep                                                          | 4.5.0    | 4.5.0     |          |
| node_modules/lodash.includes                                                           | 4.3.0    | 4.3.0     |          |
| node_modules/lodash.isboolean                                                          | 3.0.3    | 3.0.3     |          |
| node_modules/lodash.isinteger                                                          | 4.0.4    | 4.0.4     |          |
| node_modules/lodash.isnumber                                                           | 3.0.3    | 3.0.3     |          |
| node_modules/lodash.isplainobject                                                      | 4.0.6    | 4.0.6     |          |
| node_modules/lodash.isstring                                                           | 4.0.1    | 4.0.1     |          |
| node_modules/lodash.once                                                               | 4.1.1    | 4.1.1     |          |
| node_modules/long                                                                      | 5.3.2    | 5.3.2     | yes      |
| node_modules/lru-memoizer                                                              | 3.0.0    | 3.0.0     |          |
| node_modules/lru-memoizer/node_modules/lru-cache                                       | 11.5.3   | 11.5.3    |          |
| node_modules/luxon                                                                     | 3.7.2    | 3.7.2     |          |
| node_modules/math-intrinsics                                                           | 1.1.0    | 1.1.0     |          |
| node_modules/media-typer                                                               | 1.1.1    | 1.1.1     |          |
| node_modules/merge-descriptors                                                         | 2.0.0    | 2.0.0     |          |
| node_modules/mime-db                                                                   | 1.54.0   | 1.54.0    |          |
| node_modules/mime-types                                                                | 3.0.2    | 3.0.2     |          |
| node_modules/ms                                                                        | 2.1.3    | 2.1.3     |          |
| node_modules/multer                                                                    | 2.3.0    | 2.3.0     |          |
| node_modules/multer/node_modules/media-typer                                           | 0.3.0    | 0.3.0     |          |
| node_modules/multer/node_modules/mime-db                                               | 1.52.0   | 1.52.0    |          |
| node_modules/multer/node_modules/mime-types                                            | 2.1.35   | 2.1.35    |          |
| node_modules/multer/node_modules/type-is                                               | 1.6.18   | 1.6.18    |          |
| node_modules/negotiator                                                                | 1.0.0    | 1.0.0     |          |
| node_modules/node-addon-api                                                            | 8.9.2    | 8.9.2     |          |
| node_modules/node-domexception                                                         | 1.0.0    | 1.0.0     |          |
| node_modules/node-fetch                                                                | 2.7.0    | 2.7.0     | yes      |
| node_modules/node-gyp-build                                                            | 4.8.4    | 4.8.4     |          |
| node_modules/nodemailer                                                                | 10.0.10  | 10.0.10   |          |
| node_modules/object-assign                                                             | 4.1.1    | 4.1.1     |          |
| node_modules/object-hash                                                               | 3.0.0    | 3.0.0     | yes      |
| node_modules/object-inspect                                                            | 1.13.4   | 1.13.4    |          |
| node_modules/on-finished                                                               | 2.4.1    | 2.4.1     |          |
| node_modules/once                                                                      | 1.4.0    | 1.4.0     |          |
| node_modules/parseurl                                                                  | 1.3.3    | 1.3.3     |          |
| node_modules/path-expression-matcher                                                   | 1.6.2    | 1.6.2     | yes      |
| node_modules/path-key                                                                  | 3.1.1    | 3.1.1     |          |
| node_modules/path-to-regexp                                                            | 8.4.2    | 8.4.2     |          |
| node_modules/proto3-json-serializer                                                    | 4.0.2    | 4.0.2     | yes      |
| node_modules/protobufjs                                                                | 7.6.6    | 7.6.6     | yes      |
| node_modules/proxy-addr                                                                | 2.0.8    | 2.0.8     |          |
| node_modules/proxy-from-env                                                            | 2.1.0    | 2.1.0     |          |
| node_modules/qs                                                                        | 6.16.0   | 6.16.0    |          |
| node_modules/range-parser                                                              | 1.3.0    | 1.3.0     |          |
| node_modules/raw-body                                                                  | 3.0.2    | 3.0.2     |          |
| node_modules/readable-stream                                                           | 3.6.2    | 3.6.2     |          |
| node_modules/redis                                                                     | 6.2.1    | 6.2.1     |          |
| node_modules/reflect-metadata                                                          | 0.2.2    | 0.2.2     |          |
| node_modules/retry                                                                     | 0.13.1   | 0.13.1    | yes      |
| node_modules/retry-request                                                             | 9.0.1    | 9.0.1     | yes      |
| node_modules/rimraf                                                                    | 5.0.10   | 5.0.10    | yes      |
| node_modules/rimraf/node_modules/brace-expansion                                       | 2.1.7    | 2.1.7     | yes      |
| node_modules/rimraf/node_modules/glob                                                  | 10.5.0   | 10.5.0    | yes      |
| node_modules/rimraf/node_modules/lru-cache                                             | 10.4.3   | 10.4.3    | yes      |
| node_modules/rimraf/node_modules/minimatch                                             | 9.0.9    | 9.0.9     | yes      |
| node_modules/rimraf/node_modules/path-scurry                                           | 1.11.1   | 1.11.1    | yes      |
| node_modules/router                                                                    | 2.2.0    | 2.2.0     |          |
| node_modules/rxjs                                                                      | 7.8.2    | 7.8.2     |          |
| node_modules/safe-buffer                                                               | 5.2.1    | 5.2.1     |          |
| node_modules/safer-buffer                                                              | 2.1.2    | 2.1.2     |          |
| node_modules/semver                                                                    | 7.8.5    | 7.8.5     |          |
| node_modules/send                                                                      | 1.2.1    | 1.2.1     |          |
| node_modules/sepay-pg-node                                                             | 1.0.0    | 1.0.0     |          |
| node_modules/serve-static                                                              | 2.2.1    | 2.2.1     |          |
| node_modules/setprototypeof                                                            | 1.2.0    | 1.2.0     |          |
| node_modules/shebang-command                                                           | 2.0.0    | 2.0.0     |          |
| node_modules/shebang-regex                                                             | 3.0.0    | 3.0.0     |          |
| node_modules/side-channel                                                              | 1.1.1    | 1.1.1     |          |
| node_modules/side-channel-list                                                         | 1.0.1    | 1.0.1     |          |
| node_modules/side-channel-map                                                          | 1.0.1    | 1.0.1     |          |
| node_modules/side-channel-weakmap                                                      | 1.0.2    | 1.0.2     |          |
| node_modules/statuses                                                                  | 2.0.2    | 2.0.2     |          |
| node_modules/stream-events                                                             | 1.0.5    | 1.0.5     | yes      |
| node_modules/stream-shift                                                              | 1.0.3    | 1.0.3     | yes      |
| node_modules/streamsearch                                                              | 1.1.0    | 1.1.0     |          |
| node_modules/string_decoder                                                            | 1.3.0    | 1.3.0     |          |
| node_modules/strnum                                                                    | 2.4.2    | 2.4.2     | yes      |
| node_modules/strtok3                                                                   | 10.3.5   | 10.3.5    |          |
| node_modules/stubs                                                                     | 3.0.0    | 3.0.0     | yes      |
| node_modules/swagger-ui-dist                                                           | 5.32.13  | 5.32.13   |          |
| node_modules/teeny-request                                                             | 11.0.1   | 11.0.1    | yes      |
| node_modules/teeny-request/node_modules/node-fetch                                     | 3.3.2    | 3.3.2     | yes      |
| node_modules/toidentifier                                                              | 1.0.1    | 1.0.1     |          |
| node_modules/token-types                                                               | 6.1.2    | 6.1.2     |          |
| node_modules/tr46                                                                      | 0.0.3    | 0.0.3     | yes      |
| node_modules/tslib                                                                     | 2.8.1    | 2.8.1     |          |
| node_modules/type-is                                                                   | 2.1.0    | 2.1.0     |          |
| node_modules/type-is/node_modules/content-type                                         | 2.0.0    | 2.0.0     |          |
| node_modules/typedarray                                                                | 0.0.6    | 0.0.6     |          |
| node_modules/uid                                                                       | 2.0.2    | 2.0.2     |          |
| node_modules/uint8array-extras                                                         | 1.5.0    | 1.5.0     |          |
| node_modules/undici-types                                                              | 7.18.2   | 7.18.2    |          |
| node_modules/unpipe                                                                    | 1.0.0    | 1.0.0     |          |
| node_modules/util-deprecate                                                            | 1.0.2    | 1.0.2     |          |
| node_modules/uuid                                                                      | 9.0.1    | 9.0.1     | yes      |
| node_modules/validator                                                                 | 13.15.35 | 13.15.35  |          |
| node_modules/vary                                                                      | 1.1.2    | 1.1.2     |          |
| node_modules/web-streams-polyfill                                                      | 3.3.3    | 3.3.3     |          |
| node_modules/webidl-conversions                                                        | 3.0.1    | 3.0.1     | yes      |
| node_modules/websocket-driver                                                          | 0.7.5    | 0.7.5     |          |
| node_modules/websocket-extensions                                                      | 0.1.4    | 0.1.4     |          |
| node_modules/whatwg-url                                                                | 5.0.0    | 5.0.0     | yes      |
| node_modules/which                                                                     | 2.0.2    | 2.0.2     |          |
| node_modules/wrappy                                                                    | 1.0.2    | 1.0.2     |          |
| node_modules/xml-naming                                                                | 0.3.0    | 0.3.0     | yes      |

</details>

<details>
<summary>Dev/optional-peer paths retained in this checkout (71); shipment not verified</summary>

| Lock/installed path                                  | Locked                                           | Installed                                        | Optional |
| ---------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------ | -------- |
| node_modules/@isaacs/cliui                           | 8.0.2                                            | 8.0.2                                            |          |
| node_modules/@isaacs/cliui/node_modules/ansi-regex   | 6.2.2                                            | 6.2.2                                            |          |
| node_modules/@isaacs/cliui/node_modules/ansi-styles  | 6.2.3                                            | 6.2.3                                            |          |
| node_modules/@isaacs/cliui/node_modules/emoji-regex  | 9.2.2                                            | 9.2.2                                            |          |
| node_modules/@isaacs/cliui/node_modules/string-width | 5.1.2                                            | 5.1.2                                            |          |
| node_modules/@isaacs/cliui/node_modules/strip-ansi   | 7.2.0                                            | 7.2.0                                            |          |
| node_modules/@isaacs/cliui/node_modules/wrap-ansi    | 8.1.0                                            | 8.1.0                                            |          |
| node_modules/@prisma/config                          | 6.19.3                                           | 6.19.3                                           |          |
| node_modules/@prisma/debug                           | 6.19.3                                           | 6.19.3                                           |          |
| node_modules/@prisma/engines                         | 6.19.3                                           | 6.19.3                                           |          |
| node_modules/@prisma/engines-version                 | 7.1.1-3.c2990dca591cba766e3b7ef5d9e8a84796e47ab7 | 7.1.1-3.c2990dca591cba766e3b7ef5d9e8a84796e47ab7 |          |
| node_modules/@prisma/fetch-engine                    | 6.19.3                                           | 6.19.3                                           |          |
| node_modules/@prisma/get-platform                    | 6.19.3                                           | 6.19.3                                           |          |
| node_modules/@standard-schema/spec                   | 1.1.0                                            | 1.1.0                                            |          |
| node_modules/ansi-regex                              | 5.0.1                                            | 5.0.1                                            |          |
| node_modules/ansi-styles                             | 4.3.0                                            | 4.3.0                                            |          |
| node_modules/balanced-match                          | 1.0.2                                            | 1.0.2                                            |          |
| node_modules/c12                                     | 3.1.0                                            | 3.1.0                                            |          |
| node_modules/c12/node_modules/dotenv                 | 16.6.1                                           | 16.6.1                                           |          |
| node_modules/chokidar                                | 4.0.3                                            | 4.0.3                                            |          |
| node_modules/citty                                   | 0.1.6                                            | 0.1.6                                            |          |
| node_modules/cliui                                   | 8.0.1                                            | 8.0.1                                            |          |
| node_modules/cliui/node_modules/wrap-ansi            | 7.0.0                                            | 7.0.0                                            |          |
| node_modules/color-convert                           | 2.0.1                                            | 2.0.1                                            |          |
| node_modules/color-name                              | 1.1.4                                            | 1.1.4                                            |          |
| node_modules/confbox                                 | 0.2.4                                            | 0.2.4                                            |          |
| node_modules/consola                                 | 3.4.2                                            | 3.4.2                                            |          |
| node_modules/deepmerge-ts                            | 7.1.5                                            | 7.1.5                                            |          |
| node_modules/defu                                    | 6.1.7                                            | 6.1.7                                            |          |
| node_modules/destr                                   | 2.0.5                                            | 2.0.5                                            |          |
| node_modules/eastasianwidth                          | 0.2.0                                            | 0.2.0                                            |          |
| node_modules/effect                                  | 3.21.0                                           | 3.21.0                                           |          |
| node_modules/emoji-regex                             | 8.0.0                                            | 8.0.0                                            |          |
| node_modules/empathic                                | 2.0.0                                            | 2.0.0                                            |          |
| node_modules/escalade                                | 3.2.0                                            | 3.2.0                                            |          |
| node_modules/exsolve                                 | 1.1.1                                            | 1.1.1                                            |          |
| node_modules/fast-check                              | 3.23.2                                           | 3.23.2                                           |          |
| node_modules/fast-check/node_modules/pure-rand       | 6.1.0                                            | 6.1.0                                            |          |
| node_modules/foreground-child                        | 3.3.1                                            | 3.3.1                                            |          |
| node_modules/get-caller-file                         | 2.0.5                                            | 2.0.5                                            |          |
| node_modules/giget                                   | 2.0.0                                            | 2.0.0                                            |          |
| node_modules/is-fullwidth-code-point                 | 3.0.0                                            | 3.0.0                                            |          |
| node_modules/is-stream                               | 2.0.1                                            | 2.0.1                                            |          |
| node_modules/jackspeak                               | 3.4.3                                            | 3.4.3                                            |          |
| node_modules/jiti                                    | 2.7.0                                            | 2.7.0                                            |          |
| node_modules/minipass                                | 7.1.3                                            | 7.1.3                                            |          |
| node_modules/node-fetch-native                       | 1.6.7                                            | 1.6.7                                            |          |
| node_modules/nypm                                    | 0.6.9                                            | 0.6.9                                            |          |
| node_modules/nypm/node_modules/citty                 | 0.2.2                                            | 0.2.2                                            |          |
| node_modules/ohash                                   | 2.0.11                                           | 2.0.11                                           |          |
| node_modules/p-limit                                 | 3.1.0                                            | 3.1.0                                            |          |
| node_modules/package-json-from-dist                  | 1.0.1                                            | 1.0.1                                            |          |
| node_modules/pathe                                   | 2.0.3                                            | 2.0.3                                            |          |
| node_modules/perfect-debounce                        | 1.0.0                                            | 1.0.0                                            |          |
| node_modules/pkg-types                               | 2.3.1                                            | 2.3.1                                            |          |
| node_modules/prisma                                  | 6.19.3                                           | 6.19.3                                           |          |
| node_modules/rc9                                     | 2.1.2                                            | 2.1.2                                            |          |
| node_modules/readdirp                                | 4.1.2                                            | 4.1.2                                            |          |
| node_modules/require-directory                       | 2.1.1                                            | 2.1.1                                            |          |
| node_modules/signal-exit                             | 4.1.0                                            | 4.1.0                                            |          |
| node_modules/string-width                            | 4.2.3                                            | 4.2.3                                            |          |
| node_modules/string-width-cjs                        | 4.2.3                                            | 4.2.3                                            |          |
| node_modules/strip-ansi                              | 6.0.1                                            | 6.0.1                                            |          |
| node_modules/strip-ansi-cjs                          | 6.0.1                                            | 6.0.1                                            |          |
| node_modules/tinyexec                                | 1.3.0                                            | 1.3.0                                            |          |
| node_modules/typescript                              | 5.9.3                                            | 5.9.3                                            |          |
| node_modules/wrap-ansi-cjs                           | 7.0.0                                            | 7.0.0                                            |          |
| node_modules/y18n                                    | 5.0.8                                            | 5.0.8                                            |          |
| node_modules/yargs                                   | 17.7.3                                           | 17.7.3                                           |          |
| node_modules/yargs-parser                            | 21.1.1                                           | 21.1.1                                           |          |
| node_modules/yocto-queue                             | 0.1.0                                            | 0.1.0                                            |          |

</details>
