# Lambe Backend — Performance, Prisma, PostgreSQL & Ponytail Audit

**Ngày audit:** 2026-11-21  
**Phạm vi được phê duyệt:** Giai đoạn 1 (Backend Audit) và Giai đoạn 2 (Ponytail Audit)  
**Nhánh/commit làm mốc:** `feat/bookings` / `1b40ae12d464f99b2e71138c496178883560b513`  
**Trạng thái:** Audit tĩnh và các kiểm tra chỉ đọc/an toàn đã hoàn thành. Chưa triển khai refactor.

## 1. Tóm tắt điều hành

Backend Lambe là một NestJS modular monolith có phạm vi nghiệp vụ lớn, sử dụng Prisma ORM v6 với PostgreSQL, Redis cho cache/rate limit/realtime state và SSE cho realtime. Các nền tảng quan trọng đã được triển khai khá tốt: một `PrismaClient` cho mỗi Nest application context, shutdown hooks, validation toàn cục, Redis lifecycle rõ ràng, booking có advisory/row locks, các ràng buộc idempotency và wallet/commission có khóa cùng unique key bảo vệ.

Không phát hiện lỗi **Critical** có bằng chứng trong audit tĩnh. Tuy nhiên chưa thể xác nhận hệ thống đạt các SLO p95/p99 đã nêu vì production telemetry còn thiếu và không truy cập được database runtime trong môi trường audit.

Các rủi ro ưu tiên cao:

1. Không có query-level telemetry cho Prisma/PostgreSQL, event-loop lag và Redis command latency; dashboard hiện tại chỉ là process-local.
2. `backfillMissingAvatars()` đọc toàn bộ provider thiếu avatar rồi xử lý tuần tự trong một request quản trị, không có cursor/batch boundary.
3. Booking transaction bảo vệ tính đúng đắn tốt nhưng chứa nhiều truy vấn và kiểm tra dưới lock; cần đo transaction duration/lock wait trước khi thu hẹp.
4. Redis command timeout chưa bao phủ phần lớn command; Redis chậm nhưng chưa disconnect có thể giữ request promise lâu.
5. CI không cưỡng chế coverage dù Jest có khai báo threshold, và chưa chạy nhiều integration suite chuyên biệt.
6. Các truy vấn tìm provider dùng `contains`/case-insensitive qua nhiều bảng; chưa có bằng chứng query plan trên dữ liệu production và không thấy `pg_trgm`/GIN trigram trong migrations.
7. Connection budget chưa được xác định vì chưa biết chính xác số replica, pool thực tế và PostgreSQL `max_connections` của production.

## 2. Phương pháp, giới hạn và tính toàn vẹn của audit

### Đã thực hiện

- Đọc manifest, lockfile, Docker/CI, Prisma schema, migrations, module graph, các service hạ tầng chính, booking/order/wallet/commission, Redis/realtime, observability, test scripts và tài liệu benchmark hiện có.
- Quét toàn bộ `backend/src` theo các mẫu Prisma, transaction, raw SQL, concurrency, timer, realtime, logging, pagination và test.
- Chạy các kiểm tra không thay đổi dữ liệu: Prisma schema validation, TypeScript typecheck, test typecheck, lint và unit test.
- Đối chiếu các kết quả benchmark đã lưu trong repository; không tái diễn giải chúng thành production capacity.
- Thực hiện audit Ponytail độc lập với audit correctness/performance.

### Không thực hiện trong giai đoạn này

- Không sửa source code hoặc cấu hình runtime.
- Không chạy migration, seed, integration/e2e có ghi dữ liệu, booking/payment thật hoặc load test vào production.
- Không chạy `EXPLAIN ANALYZE` trên database production.
- Không nâng cấp dependency, Prisma hoặc driver.
- Không chạy build tạo `dist`; `tsc --noEmit` được dùng làm compile gate an toàn.

### Giới hạn bằng chứng

- Working tree không sạch trước audit: 764 status entries, trong đó 385 thuộc backend. Vì vậy kết quả phản ánh **working tree hiện tại**, không chỉ commit HEAD.
- Kết nối tới PostgreSQL runtime không thành công trong môi trường audit; Docker API cũng không khả dụng. Phiên bản production và các số liệu `pg_stat_*` chưa được xác minh trực tiếp.
- `npm audit` không hoàn thành do DNS tới npm registry thất bại. Không được xem tài liệu audit dependency cũ là bằng chứng hiện tại.
- Số lượng lời gọi Prisma trong source là chỉ báo tĩnh. Một Prisma call có relation load có thể phát sinh nhiều SQL statement.

## 3. Xác minh công nghệ

| Thành phần | Kết quả xác minh | Nguồn |
|---|---|---|
| NestJS | `11.1.28` đã cài; manifest dùng `^11.0.1` | `package-lock.json`, `npm ls` |
| Node.js local audit | `24.15.0` | runtime hiện tại |
| Node.js build/CI | Node 22 (`node:22-bookworm-slim`, GitHub Actions Node 22) | Dockerfile, CI workflow |
| npm local | `11.12.1` | runtime hiện tại |
| Prisma CLI | `6.19.3` | `npx prisma --version` |
| Prisma Client | `6.19.3` | lockfile và runtime inspection |
| Prisma major | **Prisma ORM v6**, không phải v7 | version + generator |
| Prisma generator | `prisma-client-js` | `prisma/schema.prisma` |
| Driver adapter | **Không sử dụng Prisma driver adapter** | không có adapter package/config |
| DB engine path | Prisma v6 Query Engine (Node-API) | Prisma runtime |
| PostgreSQL dev/CI | image `postgres:16-alpine` | CI workflow |
| PostgreSQL local baseline lịch sử | `16.14` | tài liệu benchmark 2026-10-30 |
| PostgreSQL production | **Chưa xác minh trực tiếp** | database runtime không truy cập được |
| Redis npm client | `redis@6.2.1` | lockfile, `npm ls` |
| Redis container | `redis:7-alpine` | compose/CI |
| Redis local baseline lịch sử | `7.4.11` | tài liệu benchmark 2026-10-30 |
| Realtime transport | SSE + Redis Pub/Sub; không thấy Nest WebSocket gateway | source scan |

### Kết nối PostgreSQL

- Prisma datasource dùng `provider = "postgresql"`, `url = DATABASE_URL`, `directUrl = DIRECT_URL`.
- `DATABASE_URL` production trỏ tới Neon pooled endpoint; `DIRECT_URL` trỏ tới direct endpoint.
- Không thấy `connection_limit` hoặc `pool_timeout` trong connection string hiện tại.
- Vì đây là Prisma v6, pool phía ứng dụng thuộc Prisma Query Engine; cấu hình `pg.Pool`/driver adapter của Prisma v7 không áp dụng.
- Chưa đủ dữ liệu để thay đổi pool. Cần thu thập: số backend replicas, pool size thực tế/replica, PostgreSQL `max_connections`, reserved connections và peak active connections.

**Công thức bắt buộc khi sang giai đoạn triển khai:**

`Tổng kết nối tiềm năng = số backend instances × pool size mỗi instance`

Không đề xuất tăng `connection_limit` hoặc thêm PgBouncer trước khi có các số liệu trên. Neon pooled endpoint đã là một lớp pooling cần được tính vào thiết kế.

## 4. Tổng quan kiến trúc

- NestJS modular monolith, phân vùng theo domain: auth/internal auth, categories/services, providers/provider applications/provider members, discovery, orders, wallet, chat, push, social feed, AI consultation, health và observability.
- `AppModule` đăng ký Config, Schedule, Observability và Throttler dùng Redis, sau đó là các domain module.
- Global validation bật whitelist, reject field lạ và transform DTO.
- Security headers, CORS allowlist production, Swagger chỉ bật ở development.
- Request ID được đưa vào `AsyncLocalStorage`; shutdown hooks đã bật.
- PostgreSQL là source of truth. Redis giữ cache, rate-limit counters, presence/GPS và realtime notification state.
- Realtime hiện tại dùng SSE, không phải WebSocket. Các nhận xét WebSocket trong yêu cầu được áp dụng tương đương cho lifecycle SSE/PubSub.

### Quy mô code được audit

| Hạng mục | Số lượng |
|---|---:|
| TypeScript source files | 568 |
| Source lines | 67,173 |
| Unit test files | 149 |
| Test lines | 16,261 |
| Documentation files | 53 |
| Prisma migration directories | 68 |
| Prisma schema lines | 2,316 |
| Models / enums | 92 / 55 |
| `@@index` / `@@unique` declarations | 153 / 35 |

Các module lớn nhất theo số dòng: orders (13,109), provider-members (6,410), social-feed (6,076), provider-applications (5,742), providers (4,903). Đây là các khu vực nên chia nhỏ phạm vi benchmark/review, không phải lý do tự động tách microservice.

## 5. Kết quả Performance Audit

### 5.1 Prisma lifecycle và architecture

**Đạt:**

- `PrismaService` kế thừa `PrismaClient`, gọi `$connect()` khi module init và `$disconnect()` khi destroy.
- `PostgresModule` provide/export một service; không thấy `new PrismaClient()` hoặc lớp kế thừa khác trong application source.
- `app.enableShutdownHooks()` đã được gọi.
- Không thấy Prisma driver adapter bị cấu hình nửa vời.

**Thiếu:**

- Chưa có Prisma query duration/slow-query metrics hoặc query event logging có sampling/redaction.
- Chưa biết pool utilization, wait time và timeout thực tế.
- Chưa có budget tổng connection theo số replica.

### 5.2 Query audit

Các số quét tĩnh để định hướng, không phải số SQL runtime tuyệt đối:

- 131 `findMany` occurrences.
- 176 `$transaction` occurrences.
- 147 `$queryRaw` và 8 `$executeRaw`; không thấy `$queryRawUnsafe`/`$executeRawUnsafe` trong production source.
- 43 `Promise.all` occurrences.
- 10 list/query service dùng `$transaction([findMany, count/groupBy])`.

#### Admin providers

Working tree hiện tại của `AdminProviderManagementService.findAll()` đã gộp các counter vào `groupBy(status, providerType)`, giảm từ 7 Prisma operations xuống 2 top-level operations (`findMany` + `groupBy`). Unit test hiện tại kiểm tra semantics tổng hợp.

Không được kết luận “chỉ còn 2 SQL statement” nếu chưa bật Prisma query events trên database test, vì relation select của `user`, `services`, `availabilitySessions` có thể sinh thêm SQL.

Điểm còn lại:

- Search dùng `contains`/case-insensitive cho ID/display name/service area/full name và `contains` phone; với leading wildcard, B-tree thường không giúp.
- Search là OR xuyên relation, dễ dẫn đến sequential scan khi dữ liệu lớn.
- Offset pagination có `limit <= 100` nhưng deep page vẫn có thể tăng chi phí.

#### Read-only array transactions

10 query paths bọc danh sách và count/groupBy trong `$transaction([...])`. Với isolation mặc định `ReadCommitted`, wrapper này không tự đảm bảo một repeatable snapshot giữa hai statement nhưng vẫn dùng transaction/connection. Mỗi endpoint phải làm rõ contract:

- Nếu chỉ cần kết quả gần nhất: đo và cân nhắc `Promise.all` không transaction.
- Nếu bắt buộc list/count cùng snapshot: dùng isolation phù hợp một cách tường minh và benchmark.

Không thay đồng loạt khi chưa xác nhận contract từng API.

#### Unbounded/batched work

`backfillMissingAvatars()` là vấn đề rõ ràng nhất: `findMany` không giới hạn toàn bộ provider thiếu avatar, xử lý tuần tự Cloudinary + transaction và gom toàn bộ failure trong một HTTP request. Với dữ liệu lớn, request có thể kéo dài, tăng memory, giữ resource và khó retry.

Khuyến nghị giai đoạn sau: cursor batch có giới hạn, idempotent checkpoint và giới hạn khối lượng mỗi admin invocation; chỉ đưa sang background job nếu đo được nhu cầu vận hành thực tế.

Một số `findMany` không có `take` trong quét tĩnh thực tế đã được giới hạn gián tiếp bởi `id in (...)` hoặc tập nhỏ. Không gắn nhãn N+1/unbounded nếu chưa đọc context và đo query count.

#### Redis round trips

Organization/member discovery giới hạn tối đa 50 session rồi gọi Redis position theo từng member bằng `Promise.all`. Đây là N Redis calls có bound, không phải truy vấn vô hạn. Chỉ chuyển sang batch/pipeline/Lua nếu trace cho thấy endpoint này là hot path và Redis round-trip chiếm tỷ trọng đáng kể.

### 5.3 PostgreSQL index audit

- Quét schema không phát hiện cặp exact/prefix duplicate rõ ràng giữa Prisma `@@index` và `@@unique`.
- Migrations có thêm expression/partial indexes không thể đánh giá chỉ từ schema; cần đối chiếu live `pg_indexes` và `pg_stat_user_indexes`.
- Provider profile hiện có index status và các unique index quan trọng; không thấy `pg_trgm` hoặc GIN trigram cho provider search.
- Không đề xuất index mới chỉ từ source. Cần lấy query thực, cardinality và chạy `EXPLAIN (ANALYZE, BUFFERS)` trên staging/snapshot an toàn.

Candidate cần đo:

1. Provider admin search với OR + `ILIKE '%term%'` qua relation.
2. Provider list filter theo status/providerType và order `createdAt DESC, id`.
3. Booking/provider discovery theo location, status và thời gian.
4. Order/admin list filters và sort phổ biến.

Mỗi index proposal phải kèm write amplification và kích thước index; không thêm index trùng chỉ để tối ưu một query hiếm.

### 5.4 Transaction và concurrency

**Điểm mạnh đã xác minh:**

- Booking create có customer advisory transaction lock, provider/profile lock, member lock và wallet locks.
- Status transitions khóa service order row `FOR UPDATE`.
- Wallet balance/held updates khóa wallet row trước khi thay đổi.
- Commission có idempotency key dạng `order:<id>:commission`.
- Unique constraints bảo vệ client request id và booking-group attempt.
- Cancellation/payment dispute/verification dùng row locks ở các đoạn nhạy cảm.
- Không thấy bằng chứng tĩnh về lost update, double booking hoặc double commission đang tồn tại.

**Rủi ro cần đo:**

- Booking create transaction chứa nhiều reads/rechecks, JWT/eligibility/voucher, creation, wallet/calendar/audit/chat. Dù external OSRM nằm ngoài create transaction, thời gian giữ lock/connection vẫn có thể cao dưới contention.
- Provider-level advisory lock cố ý serialize write theo organization, kể cả các member khác nhau. Comment debt trong code cho biết đây là lựa chọn bảo vệ legacy/global commitments. Không được gỡ lock nếu chưa chứng minh lock order mới an toàn.
- Hầu hết interactive transactions không cấu hình `maxWait`/`timeout` tường minh.
- Không thấy `Serializable`/`RepeatableRead` production; không nên áp dụng toàn cục. Isolation phải chọn theo invariant từng nghiệp vụ.

Trước khi refactor cần metric: transaction duration, pool wait, lock wait, deadlock count, retry count và throughput theo organization/provider.

### 5.5 Redis audit

**Đạt:**

- Một Redis client chính và một subscriber duplicate lazy trên mỗi process; cả hai được đóng khi destroy.
- Reconnect/backoff và connect timeout được cấu hình.
- Generic cache fail-open; realtime/GPS/rate limiting fail-closed khi correctness/protection yêu cầu.
- GPS tạm thời lưu ở Redis với TTL mặc định 120 giây; Lua atomically loại update stale/out-of-order và dọn GEO stale.
- Order tracking hash + Pub/Sub có TTL; không ghi mọi GPS update vào PostgreSQL.
- Feed cache có lock chống stampede, TTL, generation/index flags và QA riêng.

**Cần cải thiện sau phê duyệt:**

- Phần lớn Redis command không có per-command deadline. Connect timeout không bảo vệ trường hợp connection còn sống nhưng command bị treo/chậm.
- Generic cache warning cho mọi failure có thể tạo log storm khi Redis lỗi kéo dài.
- Runtime observability tổng quát chưa có hit/miss, command latency, memory và connection count. Feed cache có counters riêng nhưng chưa thay thế metrics Redis toàn cục.
- Cần xác định fallback theo từng use case; tuyệt đối không cache số dư, commission, access control hoặc booking state cần strong consistency.

### 5.6 NestJS và Node.js

**Đạt:** global validation, security headers, bounded route labels, request IDs, graceful shutdown, Redis-backed rate limiting và production env validation tương đối chặt.

**Khoảng trống:**

- Chưa đo event-loop lag ở runtime production.
- Chưa có heap/GC profile hoặc soak test đủ dài để loại trừ memory leak.
- Một số thao tác admin dài chạy trong request lifecycle, rõ nhất là avatar backfill.
- Logging chủ yếu là Nest text logger; request ID có trong AsyncLocalStorage nhưng chưa được bind đồng nhất vào structured JSON logs.

### 5.7 SSE, GPS và multi-instance realtime

- Không thấy `@WebSocketGateway`/`@SubscribeMessage`; Lambe dùng SSE.
- SSE controllers và Redis Pub/Sub có cleanup listener, reconnection/resume support ở các đường chính.
- GPS có freshness/sequence/session/version validation.
- Route chỉ recalculated sau khoảng thời gian/di chuyển tối thiểu; OSRM có timeout.
- Chưa có soak test multi-instance với slow client, mass reconnect và Redis recovery. Baseline hiện có chỉ 12 SSE connections nên không thể suy ra capacity production.

## 6. Observability Audit

### Hiện có

- HTTP active/completed/errors và fixed latency buckets theo bounded route labels.
- SSE opened/active/errors/aborted/resume/duration.
- Process uptime, RSS/heap và cumulative CPU usage.
- Một số worker/push/rematch/AI/Firebase counters với allowlist label.
- PostgreSQL dependency snapshot có timeout/bounds và cache 5 giây.
- Redis dependency status up/down/disabled.

### Chưa đáp ứng mục tiêu production

| Mục tiêu | Trạng thái |
|---|---|
| HTTP request rate/error/latency buckets | Có, process-local |
| p50/p95/p99 toàn hệ thống | Chưa có aggregation bền vững; chỉ có thể xấp xỉ từ buckets |
| CPU/RAM | Có process snapshot |
| Event-loop lag | Chưa có runtime metric |
| PostgreSQL active/idle connections | Chưa có |
| Slow query/query duration | Chưa có |
| Lock waits/deadlocks | Chưa có |
| PostgreSQL cache hit ratio | Chưa có |
| Redis hit/miss toàn cục | Chưa có |
| Redis command latency/memory/connections | Chưa có |
| SSE active/disconnect/throughput | Có một phần; chưa aggregate multi-instance |
| GPS update rate | Chưa có metric chuyên biệt đầy đủ |

Custom dashboard hiện tại hữu ích cho vận hành nhanh nhưng reset khi process restart và không aggregate replicas. Không nên mở rộng nó thành một metrics platform tự xây. Giai đoạn sau nên giữ dashboard vận hành và xuất standard metrics qua stack được chọn, với cardinality/redaction budget rõ ràng.

Không thấy logging request body/token/OTP có hệ thống. Tuy nhiên một số đường log raw error object (ví dụ gateway/network/media cleanup) cần structured sanitization vì upstream error có thể mang URL, header hoặc payload nhạy cảm. Đây là rủi ro, chưa phải bằng chứng secret đã bị log.

## 7. Test, CI và quality gates

### Kết quả chạy trong audit

| Gate | Kết quả | Ghi chú |
|---|---|---|
| `npx prisma validate` | PASS | schema hợp lệ |
| `npm run typecheck` | PASS | production TypeScript |
| `npm run typecheck:test` | PASS | test TypeScript |
| `npm run lint` | FAIL | 4 Prettier errors trong 2 category DTO files |
| `npm test -- --runInBand` | 148/149 suites PASS; 883/884 tests PASS | một health readiness test bị `connect EACCES 127.0.0.1:52394` trong sandbox; chưa đủ bằng chứng là regression sản phẩm |
| Integration/e2e | NOT RUN | tránh ghi dữ liệu vào database hiện tại |
| Production build | NOT RUN | sẽ tạo `dist`; ngoài audit-only constraint |
| `npm audit --omit=dev` | BLOCKED | DNS `ENOTFOUND registry.npmjs.org` |

### Khoảng trống gate

- Jest có global coverage thresholds (75% branch, 80% function/line/statement), nhưng `npm test`/`npm run check` không chạy coverage nên CI không thực sự enforce thresholds.
- CI chạy e2e, AI integration và organization-booking, nhưng chưa gọi nhiều suite chuyên biệt: feed-cache, organization chat/feed/finance/reviews, provider member/capability/verification/notification và Redis recovery.
- Không có `CONSTRAINTS.md`; các SLO của yêu cầu hiện mới là prose và chưa được nối với automated gates.
- Chưa có query-count regression tests cho admin providers, member discovery và các booking transition trọng yếu.

## 8. Benchmark và load testing

### Bằng chứng lịch sử trong repository

Baseline local 2026-10-30, dataset nhỏ/warm:

| Scenario | p95 | p99 |
|---|---:|---:|
| Discovery ASAP | 92.702 ms | 105.792 ms |
| Discovery scheduled | 75.727 ms | 104.248 ms |
| SSE handshake (12 samples) | 58.915 ms | 58.915 ms |
| SSE delivery | 92.159 ms | 92.159 ms |
| Event-loop delay | 15.565 ms | 19.907 ms |

Linux Node 22 / 2 CPU / 1 GiB baseline ghi nhận ASAP p95 103.175 ms, scheduled p95 81.436 ms, RSS khoảng 293.6 MiB. Query-count tests lịch sử giữ AI history ở 14 queries và feed ở 9 queries khi tăng page size trong phạm vi test.

Feed cache hot-key QA 2026-11-20 cho thấy object cache giảm query count, nhưng index mode không thắng object-only ở list p95 trong mẫu đó. Đây là tín hiệu cần đo lại, không phải quyết định production.

Các số trên **không chứng minh** p95 ≤ 200 ms/p99 ≤ 500 ms production vì dataset nhỏ, cache warm và topology khác production.

### Khoảng trống k6

- Không có Grafana k6 script/config trong repository.
- `scripts/load-test.mjs` là custom Node runner, không phải k6.
- Chưa có smoke/load/stress/spike/soak ở 100/200/500 VUs cho full workflow đã nêu.
- Chưa có correlation giữa load test và CPU/RAM/PostgreSQL connections/Redis latency.

Không chạy load test trong audit này vì chưa có isolated test environment và user đã cấm tác động dữ liệu thật.

## 9. Security findings

### Kiểm soát tích cực

- Không thấy raw SQL unsafe APIs trong production source.
- `.env`/secret files không được git track theo kiểm tra hiện tại.
- Production env validation yêu cầu Redis/Firebase, JWT secret separation, KYC key, CORS allowlist, HTTPS callback và MoMo host chính thức.
- Rate limiting dùng Redis và có fail-closed behavior cho các đường bảo vệ quan trọng.

### Rủi ro cần xử lý

1. Raw error object ở một số integration log cần redaction/allowlist fields.
2. Dependency vulnerability status hiện tại chưa xác minh do registry unavailable; bằng chứng cũ không thay thế lần scan mới.
3. Observability chưa đủ để phát hiện nhanh pool exhaustion, slow query, lock wait và Redis degradation.

Không phát hiện secret leak hoặc SQL injection có bằng chứng trong audit này. Điều này không đồng nghĩa penetration test đã hoàn thành.

## 10. Ponytail Audit

Phần này chỉ đánh giá khả năng giảm độ phức tạp; không đề xuất xóa khóa, idempotency, validation, security hoặc telemetry cần cho correctness.

1. `shrink:` Mười read-only list paths dùng `$transaction([findMany, count/groupBy])` nhưng isolation mặc định không cung cấp repeatable snapshot; sau khi xác nhận API contract, bỏ transaction wrapper ở path không cần snapshot hoặc khai báo isolation rõ ràng ở path thực sự cần.
2. `delete:` Khi k6 suite đạt feature/threshold parity, xóa custom `scripts/load-test.mjs` và percentile/threshold plumbing thay vì duy trì hai load-test frameworks song song; chưa xóa trước khi parity được chứng minh.
3. `yagni:` Feed cache index mode chưa cho lợi ích ổn định so với object-only trong benchmark hiện có; giữ sau feature flag trong giai đoạn đo, rồi loại bỏ index-specific code nếu production trace không chứng minh lợi ích.
4. `shrink:` Không mở rộng custom process-local observability aggregator thành một monitoring platform; giữ admin snapshot nhỏ, xuất metrics chuẩn và để backend quan sát bên ngoài thực hiện aggregation/retention/percentile.

`net: -120 to -300 lines, -0 deps possible.`

### Thành phần Ponytail không được phép loại bỏ

- Provider/customer/member advisory locks và wallet row locks.
- Idempotency keys/unique constraints cho booking, payment và commission.
- Redis stale-position Lua validation.
- DTO validation, env validation, rate limiting và redaction.
- SSE cleanup/reconnect semantics.
- Provider-level serialization hiện tại cho tới khi contention benchmark và lock-order tests chứng minh phương án an toàn hơn.

## 11. Danh sách technical debt theo ưu tiên

### P0 — Critical

Không có finding P0 đã được chứng minh.

### P1 — Thực hiện trước tối ưu sâu

| ID | Debt/Risk | Tiêu chí đóng |
|---|---|---|
| P1-01 | Thiếu DB/Redis/query telemetry và event-loop lag | Có metrics aggregate, bounded labels, redaction và dashboard/alerts |
| P1-02 | Avatar backfill unbounded trong request | Cursor batches, bounded work, idempotent retry tests |
| P1-03 | Booking transaction duration/lock contention chưa đo | Có duration/lock/pool metrics và concurrency tests |
| P1-04 | Redis command deadlines chưa đầy đủ | Timeout/fallback matrix + recovery tests |
| P1-05 | Coverage và integration gates chưa enforce đầy đủ | CI chạy coverage và suite matrix được phê duyệt |
| P1-06 | Connection budget production chưa biết | Ghi nhận replicas, pool, max connections, peak/wait |
| P1-07 | Current quality gate chưa xanh | Lint xanh; health test chạy trong môi trường cho phép socket |

### P2 — Tối ưu sau khi có baseline

| ID | Debt/Risk | Tiêu chí đóng |
|---|---|---|
| P2-01 | Provider search có nguy cơ seq scan | Query plan + index decision có write-cost evidence |
| P2-02 | Read-only transaction wrappers | Contract từng endpoint + before/after benchmark |
| P2-03 | Deep offset pagination | Data volume/query plan chứng minh nhu cầu keyset |
| P2-04 | Member discovery N Redis calls (bounded 50) | Trace chứng minh bottleneck trước batch/pipeline |
| P2-05 | SSE multi-instance/slow-client chưa soak | k6/compatible soak + FD/listener/memory evidence |
| P2-06 | Feed index cache mode chưa chứng minh giá trị | Production-like A/B benchmark hoặc loại bỏ |

### P3 — Duy trì

- Chuẩn hóa structured logging và request ID propagation.
- Review raw error logging/redaction.
- Ghi lại SLO/constraints thành automated checks sau khi được phê duyệt.
- Cập nhật dependency audit trong môi trường có registry access.

## 12. Kế hoạch đề xuất sau phê duyệt

Không triển khai ở giai đoạn hiện tại. Thứ tự an toàn được đề xuất:

1. Tạo isolated test/staging environment và chốt measurement protocol.
2. Bổ sung observability tối thiểu để lấy baseline đúng: query/transaction/pool/lock, Redis latency, event-loop lag.
3. Làm xanh quality gates và coverage/integration matrix.
4. Viết characterization/concurrency tests trước khi đụng booking/wallet/commission.
5. Tối ưu module độc lập: admin providers/backfill → Redis timeouts → provider search/index → booking transaction.
6. Mỗi thay đổi có benchmark trước/sau, contract test và rollback plan.
7. Xây k6 smoke/load/stress/spike/soak cho test data cô lập ở 100/200/500 VUs.
8. Chạy Ponytail review trên diff, chỉ merge simplification không làm mất correctness/security/performance evidence.

## 13. Kết luận và quyết định chờ phê duyệt

Lambe đã có nền tảng correctness tốt hơn mức một backend CRUD thông thường, đặc biệt ở booking, wallet, commission, Redis realtime và environment validation. Vấn đề lớn nhất hiện tại không phải thiếu thêm abstraction mà là thiếu telemetry production-grade và thiếu benchmark có thể liên kết trực tiếp tải với database/Redis/runtime.

Chưa có cơ sở để nâng Prisma, đổi driver adapter, tăng pool, thêm PgBouncer, chuyển toàn bộ query sang raw SQL, thêm queue framework hoặc tách microservice.

Audit dừng tại Giai đoạn 2. Mọi thay đổi implementation, schema, migration, dependency và production deployment phải chờ phê duyệt riêng.
