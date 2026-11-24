# Kế hoạch nâng cấp cache và khả năng mở rộng Beauty Feed

Cập nhật: 20/11/2026

## Tiến độ triển khai ngày 20/11/2026

Đã triển khai object cache, timeline page index, outbox có trigger DB, worker retry, cảnh báo email, dashboard Admin, cache/prefetch mobile và nền tảng gợi ý theo quy tắc có cờ bật riêng. Cache mặc định tắt. Đã diễn tập migration trên DB thử sạch, kiểm thử PostgreSQL/Redis thật và đo HTTP cục bộ. Chưa triển khai staging/production hay nghiệm thu trên thiết bị thật.

Bằng chứng và thao tác vận hành: [runbook](feed-cache-runbook.md), [kết quả đo](qa/feed-cache-2026-11-20.json). Các checkbox còn trống thể hiện việc chưa chạy hoặc phụ thuộc dữ liệu/môi trường bên ngoài; không được coi là hoàn tất chỉ vì đã có mã nguồn.

Đã bổ sung [bài thử hot key](qa/feed-cache-hot-key-2026-11-20.json): mỗi trường hợp 500 request, concurrency 20, cùng bài/provider; burst lạnh 20 request đồng thời. Cả sáu trường hợp hoàn tất, không có lỗi HTTP hoặc timeout cache. Số query giảm từ 6/request xuống 2 với object cache, 3 với timeline index. P95 chưa giảm đủ 25% ở mọi trường hợp; chưa đạt nghiệm thu hiệu năng production. Redis memory trong báo cáo là toàn process dùng chung các DB, CPU gồm cả API và bộ sinh tải.

Snapshot hiện chỉ chứa ID, revision, caption, snapshot tác giả và media. Provider, dịch vụ, counts, trạng thái công khai và viewer flags được đọc mới theo lô từ PostgreSQL. Đây là điều chỉnh so với snapshot dự kiến bên dưới: giá dịch vụ và hồ sơ provider có thể đổi mà không tăng revision của bài, nên chưa đưa chúng vào cache.

Key snapshot là `lambe:feed:v1:post:{id}:revision:{revision}:updated:{updatedAtMs}`. Trigger đổi generation và ghi outbox trong cùng transaction khi publication dependencies thay đổi. Worker xóa key cũ, retry và cập nhật generation Redis đơn điệu. Chỉ mục là các trang sorted set tối đa 51 ID theo generation, hash bộ lọc/cursor/limit; trang được dựng nguyên tử khi đọc, có marker kiểm tra đầy đủ. Thiết kế này thay cho một chỉ mục vô hạn cần dựng trước, đồng thời giữ đúng cursor hiện có.

- [x] Thêm MGET vào cache abstraction và fallback khi Redis không sẵn sàng.
- [x] Thêm object cache có namespace, revision và updatedAt.
- [x] Chỉ lưu các trường công khai được cho phép; kiểm tra cấu trúc dữ liệu đọc từ Redis.
- [x] Tách counts và viewer flags khỏi snapshot cache.
- [x] Đọc dịch vụ/provider hiện hành để tránh giá và trạng thái cũ.
- [x] Timeout cache độc lập, mặc định 100 ms; hết hạn thì đọc DB.
- [x] Cấu hình TTL 120 giây có jitter và validation.
- [x] Thêm kiểm thử cache hit/miss, quyền hiển thị và cách ly viewer flags.
- [x] Thêm công cụ đo HTTP chỉ đọc `scripts/benchmark-feed-cache.mjs`.
- [x] Kiểm chứng đợt 1: 97 kiểm thử Feed/cache/cấu hình đạt; typecheck mã nguồn và test đạt.
- [x] Đo baseline và cache nóng/lạnh trên PostgreSQL/Redis thật cùng bộ dữ liệu cục bộ.
- [x] Triển khai sorted set, outbox, worker và cập nhật index.
- [x] Triển khai cache mobile và chuẩn bị runbook production.
- [ ] Nghiệm thu staging/production và thiết bị thật.

Kiểm chứng bản cuối: 128 test unit liên quan Feed/cache/cấu hình/rate limiter/email; 10 test PostgreSQL/Redis thật; 25 test Feed qua AppModule đầy đủ với cache bật; 59 test mobile Feed; frontend build và 11 test hiện có đạt. Các số này là phạm vi đã chạy, không phải tuyên bố toàn bộ repository đã được nghiệm thu. Typecheck backend và phân tích mobile cũng đã chạy; xem runbook cho điều kiện môi trường.

Cách kiểm tra trên môi trường cục bộ/staging đã chạy API: đặt `FEED_BENCH_BASE_URL`, `FEED_BENCH_LABEL` (ví dụ `off`, `cold`, `warm`) và tùy chọn `FEED_BENCH_POST_ID`, rồi chạy `node scripts/benchmark-feed-cache.mjs` từ thư mục backend. Chạy hai cấu hình cache tắt/bật trên cùng dữ liệu và cùng mức concurrency; lưu kết quả cùng DB query metrics trước khi đánh giá hiệu năng. Script xuất JSON ra stdout, không thay đổi DB.

Fallback áp dụng cho dữ liệu cache và các API GET Feed công khai. Khi Redis lỗi, các đường đọc này vẫn có limiter cục bộ tối đa 5 request/giây và 30 request/phút mỗi khóa/replica. API ghi, quản trị và các phạm vi riêng tư khác vẫn giữ bảo vệ Redis hiện có.

Mục tiêu của kế hoạch là giảm tải PostgreSQL và độ trễ đọc Feed mà không làm lộ dữ liệu cá nhân, không trả bài đã ẩn hoặc đã xóa, và không khiến Redis trở thành nguồn dữ liệu bắt buộc. PostgreSQL tiếp tục là nguồn dữ liệu chuẩn; Redis lưu snapshot nội dung công khai và chỉ mục timeline có thể tái tạo.

## Trạng thái tổng quan

- [x] Khảo sát API và luồng dữ liệu Feed hiện tại.
- [x] Xác nhận Redis hiện chỉ phục vụ rate limit, chưa cache dữ liệu Feed.
- [x] Đối chiếu mô hình công khai của Meta, Instagram, Threads và ByteDance.
- [x] Chọn hướng object cache kết hợp timeline index và outbox.
- [x] Hoàn thiện cache abstraction cho thao tác hàng loạt và sorted set.
- [x] Cache chi tiết bài công khai.
- [x] Xây dựng Redis timeline page index.
- [x] Đồng bộ cache đáng tin cậy qua outbox.
- [x] Tách dữ liệu công khai khỏi counts và viewer flags.
- [x] Bổ sung cache cục bộ và prefetch cho mobile.
- [ ] Kiểm thử tải, bảo mật và khả năng phục hồi.
- [ ] Bật production theo từng giai đoạn.

## Nguyên tắc kiến trúc

- [x] PostgreSQL là nguồn dữ liệu chuẩn và bền vững.
- [x] Redis chỉ giữ dữ liệu có thể tái tạo từ PostgreSQL.
- [x] Không cache KYC, thông tin kiểm duyệt nội bộ hoặc membership version.
- [x] Không dùng chung `liked`, `saved`, `followed` giữa các tài khoản.
- [x] Bài pending, rejected, hidden hoặc deleted không được phục vụ từ cache công khai.
- [x] Redis lỗi phải chuyển sang đọc PostgreSQL, không làm Feed ngừng hoạt động.
- [x] Mọi cache key phải có namespace và schema version.
- [x] Mọi cache mutation phải kiểm tra revision hoặc event sequence để chống dữ liệu cũ ghi đè dữ liệu mới.

Luồng mục tiêu:

```text
PostgreSQL transaction
  ├─ cập nhật bài Feed
  └─ ghi FeedCacheEvent
            │
            ▼
      Feed cache worker
            │
     ┌──────┴────────┐
     ▼               ▼
Redis timeline    Redis post snapshot
     │               │
     └──────┬────────┘
            ▼
Counts và viewer flags từ PostgreSQL
            │
            ▼
       API response
```

## Giai đoạn 0: Đo baseline

- [x] Ghi P50, P95 và P99 của `GET /feed/posts` trên fixture cục bộ.
- [x] Ghi P50, P95 và P99 của `GET /feed/posts/:id` trên fixture cục bộ.
- [x] Đo số truy vấn PostgreSQL cho một trang Feed 20 bài.
- [x] Đo CPU process thử và tổng thời gian query PostgreSQL khi tải đồng thời.
- [ ] Đo CPU PostgreSQL và mức sử dụng connection pool trên tải đại diện.
- [ ] Ghi tỷ lệ request public, authenticated, following, saved và mine.
- [ ] Xác định `limit` và bộ lọc được dùng nhiều nhất.
- [x] Lưu kết quả vào `qa/feed-cache-2026-11-20.json` và liên kết từ performance baseline.

Điều kiện hoàn thành:

- [x] Có số liệu trước nâng cấp để so sánh trong môi trường thử.
- [x] Có kịch bản load test có thể chạy lặp lại.

## Giai đoạn 1: Mở rộng cache abstraction

Mở rộng `CacheStore` và `RedisCacheService`, không để module Feed sử dụng Redis client trực tiếp.

- [x] Thêm `getMany(keys)`.
- [x] Thêm `setMany(entries, ttl)`.
- [x] Thêm `deleteMany(keys)`.
- [x] Thêm sorted set qua `replaceSortedPage`/`readSortedPage` nguyên tử, kết hợp `timestamp:id` để giữ thứ tự khi timestamp trùng.
- [x] Thêm thao tác đổi generation hoặc sequence nguyên tử.
- [x] Thêm `setIfAbsent`, release theo token và coalescing cold read trong process.
- [x] Bổ sung no-op/fallback khi Redis bị tắt.
- [x] Bổ sung timeout ngắn cho các thao tác cache trong luồng Feed.
- [x] Không sử dụng Redis offline queue cho request nghiệp vụ.
- [x] Viết unit test cho cache enabled, disabled và unavailable.

Điều kiện hoàn thành:

- [x] API hiện tại vẫn hoạt động khi `REDIS_ENABLED=false` trong môi trường cho phép tắt Redis.
- [x] Đọc Feed công khai có fallback DB và limiter cục bộ khi Redis lỗi.
- [x] Module Feed không phụ thuộc trực tiếp thư viện `redis`.

## Giai đoạn 2: Cache snapshot bài công khai

Key dự kiến:

```text
lambe:feed:v1:post:{postId}:revision:{revisionNumber}
```

Snapshot chỉ chứa caption, provider công khai, tác giả công khai, media, dịch vụ hợp lệ và thời gian đăng.

- [x] Tạo `FeedCacheService` chịu trách nhiệm sinh key và TTL.
- [x] Tạo kiểu dữ liệu riêng `CachedPublicFeedPost`.
- [x] Không dùng trực tiếp managed Feed response làm cache value.
- [x] Loại bỏ `viewer`, review metadata và dữ liệu nội bộ khỏi snapshot.
- [x] TTL mặc định 120 giây.
- [x] Thêm TTL jitter để key không hết hạn đồng thời.
- [x] Khi cache miss, đọc PostgreSQL rồi ghi Redis.
- [x] Khi cache hit, kiểm tra visibility và revision hiện tại bằng truy vấn nhỏ.
- [x] Nếu bài không còn công khai, không phục vụ snapshot, trả 404 và dọn key qua outbox.
- [x] Nếu revision không khớp, bỏ snapshot cũ và tải lại từ PostgreSQL.
- [x] Không negative-cache 404 trong giai đoạn đầu.

Điều kiện hoàn thành:

- [x] Bài hidden/deleted không xuất hiện dù Redis còn snapshot cũ.
- [x] Bài worker pending/rejected không xuất hiện qua cache.
- [x] Response API đọc hiện có không thay đổi so với trước khi cache.

## Giai đoạn 3: Tách counts và trạng thái người xem

- [x] Tách nội dung bài khỏi `_count.likes`, `_count.comments`, `_count.saves`.
- [x] Viết truy vấn theo lô lấy counts cho danh sách `postId`.
- [x] Tiếp tục lấy `liked`, `saved`, `followed` theo đúng `userId` hiện tại.
- [x] Ghép counts và viewer flags sau khi lấy snapshot cache.
- [x] Like/unlike không làm mất cache nội dung bài.
- [x] Save/unsave không làm mất cache nội dung bài.
- [x] Follow/unfollow không làm mất cache nội dung bài.
- [x] Comment/delete comment không làm mất cache nội dung bài.
- [x] Viết test hai người dùng không nhận nhầm viewer flags của nhau.

Điều kiện hoàn thành:

- [x] Redis không chứa `userId` trong public post snapshot.
- [x] Counts và viewer flags phản ánh dữ liệu mới nhất từ PostgreSQL.

## Giai đoạn 4: Redis timeline index

Không cache nguyên trang response làm thiết kế chính. Dùng sorted set chứa `postId`, còn nội dung được hydrate từ post snapshot.

Key dự kiến:

```text
lambe:feed:v1:index:global
lambe:feed:v1:index:provider:{providerId}
lambe:feed:v1:index:service:{serviceId}
```

- [x] Dùng timestamp cố định độ dài và post ID làm thứ tự lexicographic; score 0 để tránh mất bài có timestamp trùng.
- [x] Ghi trang bài public bằng `ZADD` trong Lua nguyên tử cùng marker số lượng.
- [x] Ẩn/xóa/từ chối làm đổi generation, loại mọi trang cũ khỏi đường đọc; không cần quét `ZREM` từng bộ lọc.
- [x] Đọc batch ID theo trang cursor và kiểm tra lại thứ tự/cardinality trong DB.
- [x] Hydrate nội dung bằng `getMany`.
- [x] Cache miss từng bài phải đọc lại PostgreSQL và tự sửa cache.
- [x] Nếu index thiếu hoặc hỏng, fallback truy vấn PostgreSQL.
- [x] Có API Admin rebuild generation và nạp trang đầu; các trang/bộ lọc tự rebuild theo batch khi đọc.
- [x] Không cache `mine`, `saved`, `following` trong giai đoạn này.
- [ ] Bật index provider/service ở production sau khi global index được nghiệm thu; code đã hỗ trợ cùng cờ index.

Điều kiện hoàn thành:

- [x] Thứ tự Feed và cursor giống PostgreSQL, có kiểm thử timestamp trùng.
- [x] Phân trang không trùng ID và có parity cache tắt/bật trong kiểm thử.
- [x] Index mất một phần được coi là miss và có thể tái tạo từ DB mà không mất dữ liệu nguồn.

## Giai đoạn 5: Đồng bộ bằng outbox

Tạo bảng `FeedCacheEvent` hoặc dùng outbox dùng chung nếu dự án chuẩn hóa outbox tổng quát.

Các event tối thiểu:

- [x] `FEED_POST_PUBLISHED` và `FEED_POST_CREATED` cho bài mới chờ duyệt.
- [x] `FEED_POST_UPDATED`.
- [x] `FEED_POST_HIDDEN`.
- [x] `FEED_POST_DELETED`.
- [x] `FEED_POST_APPROVED`.
- [x] `FEED_POST_REJECTED`.
- [x] `PROVIDER_FEED_VISIBILITY_CHANGED`.
- [x] `SERVICE_FEED_VISIBILITY_CHANGED`.

Thông tin event:

- [x] `postId` (nullable cho sự kiện phạm vi toàn Feed).
- [x] `providerId` (nullable cho sự kiện phạm vi toàn Feed).
- [x] `revisionNumber` và key snapshot cũ khi thay đổi một bài.
- [x] `sequence`/generation tăng đơn điệu trong transaction DB.
- [x] `eventType`.
- [x] `createdAt`, `availableAt`, `attempts`, `lockedUntil`, `processedAt`.

Worker:

- [x] Claim event bằng lease và `FOR UPDATE SKIP LOCKED`.
- [x] Retry exponential backoff khi Redis lỗi.
- [x] Xử lý event idempotent; xác nhận theo đúng lease/attempt.
- [x] Redis chỉ chấp nhận generation mới hơn, so sánh chuỗi cố định độ dài để giữ chính xác bigint.
- [x] Có giới hạn batch, deadline lệnh Redis và chống chạy trùng trong process.
- [x] Có metric backlog, tuổi event cũ nhất, số retry và thời gian vòng worker.
- [x] Có cảnh báo trên dashboard/API và email outbox khi backlog vượt ngưỡng.

Điều kiện hoàn thành:

- [x] Không có dual-write transaction giữa PostgreSQL và Redis.
- [x] Request cũ không thể ghi snapshot cũ đè lên phiên bản bài mới.
- [x] Event hết lease có thể được claim lại, đã diễn tập trên DB/Redis thật.

## Giai đoạn 6: Ma trận invalidation

- [x] Tạo bài owner/cá nhân: generation mới chỉ thấy được sau commit; trang mới nạp bài khi đọc.
- [x] Tạo bài worker pending: không xuất hiện trong trang public.
- [x] Sửa bài public: phiên bản snapshot mới và outbox dọn key cũ.
- [x] Sửa bài worker: không còn trong trang public khi chờ duyệt lại.
- [x] Xóa bài: generation mới và visibility DB loại bài khỏi đường đọc.
- [x] Owner approve: trang generation mới có thể đọc bài sau khi qua đủ cổng hiển thị.
- [x] Owner reject: generation mới và visibility DB loại bài.
- [x] Moderator hide: generation mới và visibility DB loại bài ngay trong luồng đọc.
- [x] Moderator publish: vẫn kiểm tra đầy đủ các cổng hiển thị độc lập.
- [x] Provider bị đình chỉ: chặn visibility và đổi generation trong cùng transaction.
- [x] User chủ provider bị khóa: chặn visibility và đổi generation trong cùng transaction.
- [x] Dịch vụ/category bị khóa: dịch vụ được đọc mới và lọc lại theo DB.
- [x] Đổi giá/tên dịch vụ: đọc trực tiếp dữ liệu hiện tại, không phục vụ bản cache cũ.
- [x] Thay đổi generation/event rollback cùng transaction nghiệp vụ; worker chỉ thấy sau commit.

## Giai đoạn 7: Cache phía mobile

Học theo nguyên tắc client cache của Facebook nhưng không xem dữ liệu local là nguồn chuẩn.

- [x] Lưu local snapshot công khai với schema version 1.
- [x] Hiển thị cache trước, gắn thông báo bản đã lưu và refresh từ server.
- [x] Giữ các bài đã tải trong phiên; chưa xếp hạng lại pool trên client.
- [x] Dedupe theo `postId` khi trộn cache và response mới.
- [x] Loại bỏ bài khỏi cache khi chi tiết trả 403/404 và loại khỏi UI khi mất visibility.
- [x] Prefetch tối đa hai ảnh kế tiếp.
- [x] Video giữ cơ chế khởi tạo khi người dùng chủ động xem.
- [x] Giới hạn 3 trang, 20 bài/trang, 512 KiB và TTL 15 phút.
- [x] Xóa cache khi logout hoặc đổi tài khoản; không lưu viewer flags cá nhân.
- [ ] Kiểm thử mạng yếu, offline, app background và cold start.

## Giai đoạn 8: Recommendation trong tương lai

Chỉ thực hiện sau khi timeline cache ổn định và có đủ dữ liệu hành vi.

Đã chuẩn bị endpoint gợi ý riêng `rules-v1` và thu thập event có cờ bật. Mobile đo hành vi tại trang chi tiết và thao tác mở/đặt dịch vụ; chưa đo impression toàn bộ luồng cuộn. Candidate hiện là 200 bài công khai gần nhất rồi chấm điểm theo onboarding/follow/tương tác/độ phổ biến. Các mục nguồn ứng viên theo vị trí, cache candidate và ML vẫn cần dữ liệu thật, không được đánh dấu đã nghiệm thu từ fixture.

- [x] Chuẩn bị thu thập VIEW/DWELL/SKIP tại chi tiết, OPEN_SERVICE/START_BOOKING khi người dùng thao tác; cờ mặc định tắt.
- [x] Chuẩn hóa positive/negative engagement signals, giới hạn dwell và khử trùng theo tài khoản/clientEventId.
- [ ] Tạo candidate từ dịch vụ quan tâm, provider theo dõi, khu vực và nội dung phổ biến.
- [x] Truy xuất pool ứng viên trước, chấm điểm và revalidate theo lô trước khi trả; chưa dùng ML.
- [ ] Cache item/provider features lâu hơn user interaction features.
- [ ] Chỉ cache candidate IDs ngắn hạn, không cache lâu response cá nhân cuối cùng.
- [x] Có rule-based scoring `rules-v1` sau cờ thử nghiệm.
- [x] Có diversity rule tối đa hai bài/provider trong kết quả gợi ý.
- [x] Có integrity filter, loại bài người xem đã báo cáo và kiểm tra lại visibility trước khi trả.
- [ ] Chỉ triển khai ML sau khi có offline evaluation và A/B test rõ ràng.

## Kiểm thử bắt buộc

### Unit và integration

- [x] Cache hit và cache miss.
- [x] Redis disabled và Redis unavailable.
- [x] Batch read có một phần key miss.
- [x] Revision cũ không ghi đè revision mới.
- [x] Outbox retry và reclaim lease.
- [x] Index mất/thiếu marker tự tái tạo, khóa nguyên tử và batch giữ đúng vị trí.
- [x] Cursor Redis tương thích cursor PostgreSQL.
- [x] Response trước và sau cache có cùng contract.

### Bảo mật và quyền riêng tư

- [x] Người A like bài không làm người B nhận `liked=true`.
- [x] Bài pending/rejected không xuất hiện công khai.
- [x] Bài bị ẩn/xóa trước lúc đọc không được trả từ cache.
- [x] Provider hoặc tài khoản bị khóa không còn xuất hiện.
- [x] Managed metadata không xuất hiện trong public cache.
- [x] Snapshot không lấy trường token/điện thoại/KYC từ model; caption/media công khai vẫn tuân theo consent và kiểm duyệt Feed.
- [x] Không truy vấn/cache bảng hình ảnh KYC hoặc ảnh bằng chứng đơn hàng.

### Hiệu năng và phục hồi

- [x] Probe HTTP cache lạnh trên fixture cục bộ, có xóa key được đo và đổi generation.
- [x] Probe HTTP cache nóng: 100 request/trường hợp, concurrency 5, warmup 20.
- [x] Load test cục bộ cùng bài/provider: 500 request/trường hợp, concurrency 20; burst lạnh 20 request đồng thời.
- [x] Giả lập Redis unavailable/disconnect/timeout và kiểm tra fallback; chưa dừng Redis đang phục vụ ứng dụng khác.
- [x] Diễn tập event hết lease được claim lại và retry trên DB/Redis thật.
- [x] Diễn tập mất index, marker không đầy đủ và tự dựng lại trang từ DB.
- [x] Ghi p50, p95, p99, hit/miss, DB queries và Redis process memory trong bài thử cục bộ.
- [ ] Theo dõi dài hạn các chỉ số trên và dung lượng riêng namespace Feed ở staging/production.

## Cấu hình đã triển khai

```env
FEED_CACHE_ENABLED=false
FEED_CACHE_INDEX_ENABLED=false
FEED_RECOMMENDATIONS_ENABLED=false
FEED_CACHE_POST_TTL_SECONDS=120
FEED_CACHE_INDEX_TTL_SECONDS=300
FEED_CACHE_LOCK_TTL_SECONDS=5
FEED_CACHE_BATCH_SIZE=50
FEED_CACHE_WORKER_INTERVAL_MS=5000
FEED_CACHE_TIMEOUT_MS=100
```

- [x] Thêm validation kiểu và min/max cho các biến môi trường.
- [x] Mặc định tắt cache Feed cho đến khi staging đạt yêu cầu.
- [x] Cho phép tắt cache Feed độc lập với Redis rate limit/location.
- [x] Không log toàn bộ cache payload.

## Quan sát vận hành

- [x] Metric object hit/miss theo list/detail, timeout và lỗi.
- [x] Tổng thời gian thao tác cache và thời gian thử ghi.
- [x] Cache miss phản ánh nhu cầu nạp body từ DB; tình trạng mất Redis có cảnh báo riêng.
- [x] Counter dung lượng thử ghi snapshot.
- [x] Metric outbox backlog có giới hạn đếm và oldest event age.
- [x] Thời gian vòng worker và lần chạy gần nhất.
- [x] Log chỉ event name, không chứa caption/media URL/SMTP credentials.
- [x] Có dashboard Feed cache trong giao diện Admin và API vận hành.
- [x] Có cảnh báo Redis unavailable/backlog; email outbox khử trùng và kiểm tra lại quyền người nhận.
- [ ] Nghiệm thu dashboard và email đến hộp thư thật trên staging/production.

## Triển khai production

- [ ] Deploy code với `FEED_CACHE_ENABLED=false`.
- [ ] Chạy migration outbox.
- [ ] Rebuild index ở staging.
- [x] Chạy toàn bộ test Feed backend/mobile trong môi trường cục bộ/thử riêng.
- [ ] Chạy load test và kiểm thử Redis failure.
- [ ] Bật cache chi tiết bài tại staging.
- [ ] Bật global timeline index tại staging.
- [ ] Theo dõi staging tối thiểu 24 giờ.
- [ ] Bật production theo tỷ lệ nhỏ hoặc từng endpoint.
- [ ] Theo dõi error rate, DB load, hit rate và cache backlog.
- [ ] Chỉ mở provider/service index sau khi global index ổn định.

Rollback:

- [ ] Đặt `FEED_CACHE_ENABLED=false`.
- [ ] API quay lại đọc PostgreSQL trực tiếp.
- [ ] Dừng cache worker nhưng giữ outbox để có thể xử lý lại.
- [ ] Không rollback dữ liệu PostgreSQL nghiệp vụ.
- [ ] Redis Feed namespace có thể xóa và tái tạo độc lập.

## Tiêu chí nghiệm thu

- [ ] Không thay đổi API response contract.
- [ ] Không có dữ liệu cá nhân trong public cache.
- [ ] Hidden/deleted/pending/rejected không được phục vụ từ cache.
- [ ] Redis ngừng hoạt động nhưng Feed vẫn đọc được từ PostgreSQL.
- [ ] Toàn bộ test Feed backend và mobile đạt.
- [ ] PostgreSQL read queries của Feed giảm tối thiểu 40%.
- [ ] P95 API đọc Feed giảm tối thiểu 25% so với baseline.
- [ ] Cache hit chi tiết bài đạt tối thiểu 70% trong tải đại diện.
- [ ] Không có outbox event quá hạn vượt ngưỡng vận hành đã cấu hình.
- [x] Có runbook rebuild cache, rollback cờ và xử lý Redis outage.

## Tài liệu tham khảo kiến trúc

- [TAO: The power of the graph](https://engineering.fb.com/2013/06/25/core-infra/tao-the-power-of-the-graph/)
- [Cache made consistent](https://engineering.fb.com/2022/06/08/core-infra/cache-made-consistent/)
- [Scaling the Instagram Explore recommendations system](https://engineering.fb.com/2023/08/09/ml-applications/scaling-instagram-explore-recommendations-system/)
- [How Meta built the infrastructure for Threads](https://engineering.fb.com/2023/12/19/core-infra/how-meta-built-the-infrastructure-for-threads/)
- [Inside Facebook's video delivery system](https://engineering.fb.com/2024/12/10/video-engineering/inside-facebooks-video-delivery-system/)
- [Monolith: Real Time Recommendation System With Collisionless Embedding Table](https://arxiv.org/abs/2209.07663)
