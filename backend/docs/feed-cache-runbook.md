# Vận hành cache Beauty Feed

Cập nhật 20/11/2026. PostgreSQL giữ dữ liệu chuẩn. Các cờ cache và gợi ý mặc định đều tắt; cấu hình mẫu nằm trong `.env.example`.

## Triển khai theo thứ tự

1. Sao lưu database đích và kiểm tra nơi khôi phục theo quy trình vận hành hiện có.
2. Giữ `FEED_CACHE_ENABLED=false`, `FEED_CACHE_INDEX_ENABLED=false`, `FEED_RECOMMENDATIONS_ENABLED=false` khi triển khai code.
3. Chạy `npm run prisma:generate`, `npm run build` và `npm run prisma:deploy` trên đúng môi trường đích. Hai migration mới là `20261120100000_feed_cache_outbox` và `20261120103000_feed_engagements`; migration upload Feed trước đó cũng phải được áp dụng.
4. Tại staging, bật `FEED_CACHE_ENABLED=true` và để index tắt. Worker bắt đầu xử lý outbox đã tích lũy; snapshot bài được nạp khi đọc.
5. Đăng nhập Admin, đọc `GET /api/internal/feed/cache/status`. Dashboard quản trị cũng hiển thị các số liệu này. Chờ backlog giảm và không có cảnh báo kéo dài.
6. Có thể gọi `POST /api/internal/feed/cache/rebuild` bằng token Admin để đổi generation và nạp trang đầu. Thao tác được ghi audit. Các trang/bộ lọc còn lại tự dựng khi được đọc, mỗi trang tối đa `limit+1` bài.
7. Đo riêng list/detail, cache lạnh/nóng, counts, cursor và thay đổi kiểm duyệt. Sau khi object cache ổn định mới bật `FEED_CACHE_INDEX_ENABLED=true` ở staging.
8. Theo dõi staging tối thiểu 24 giờ, gồm tải đại diện và thử mất Redis. Chỉ triển khai cờ bật lên production khi các ngưỡng được nghiệm thu trên dữ liệu đại diện. Có thể bật lần lượt trên nhóm máy chủ canary nếu môi trường có nhiều replica.

## Cấu hình

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `FEED_CACHE_ENABLED` | false | Object cache và worker outbox |
| `FEED_CACHE_INDEX_ENABLED` | false | Timeline page index; cần object cache bật |
| `FEED_CACHE_POST_TTL_SECONDS` | 120 | TTL snapshot; jitter ±10% |
| `FEED_CACHE_TIMEOUT_MS` | 100 | Hạn chờ thao tác cache trong luồng đọc |
| `FEED_CACHE_INDEX_TTL_SECONDS` | 300 | TTL chỉ mục trang |
| `FEED_CACHE_LOCK_TTL_SECONDS` | 5 | Lease dựng trang |
| `FEED_CACHE_BATCH_SIZE` | 50 | Số event tối đa mỗi vòng worker |
| `FEED_CACHE_WORKER_INTERVAL_MS` | 5000 | Khoảng nghỉ tối thiểu; scheduler kiểm tra mỗi giây |
| `FEED_RECOMMENDATIONS_ENABLED` | false | Thu thập event và gợi ý thử nghiệm theo quy tắc |

## Tính nhất quán và giới hạn

- Trigger DB cập nhật `feed_cache_state` và ghi `feed_cache_events` cùng transaction nghiệp vụ. Rollback cũng rollback generation/event. Trigger bao phủ bài, liên kết dịch vụ, trạng thái/tên/avatar provider, trạng thái user, giá/trạng thái offering, dịch vụ và category.
- Chỉ mục dùng generation đọc từ DB và hash bộ lọc/cursor/limit. Sorted set giữ thành viên `timestamp:id` cùng score 0, đọc theo thứ tự lexicographic giảm dần; timestamp được đệm độ dài cố định để giữ đúng thứ tự khi nhiều bài cùng thời điểm.
- Mỗi trang chỉ có tối đa 51 ID. Marker và nội dung sorted set được ghi/đọc nguyên tử; trang mất một phần bị coi là cache miss. Không dựng trước một timeline vô hạn cho từng tài khoản.
- Snapshot chỉ chứa caption, media và snapshot tác giả công khai. Provider, dịch vụ, counts và viewer flags được đọc mới. `FeedLiveReadService` gộp join/count theo lô trong một lượt DB và áp dụng lại đầy đủ cổng hiển thị.
- Key snapshot có cả revision và updatedAt. Cache fill cũ không ghi đè phiên bản mới. Worker xóa key phiên bản cũ từ outbox, cập nhật generation Redis đơn điệu và retry nếu lỗi. Event có lease, chống xác nhận kết quả từ lease cũ.
- Worker xóa theo batch tối đa 500 event đã hoàn tất hơn 7 ngày. Event chưa hoàn tất được giữ để retry. Khi cache tắt, trigger vẫn ghi nhận thay đổi; cần theo dõi và xử lý backlog trước khi bật index.
- Mỗi vòng worker ngừng claim event mới sau khoảng 2 giây hoặc khi đủ batch. Event đang xử lý vẫn kết thúc theo deadline Redis trước khi vòng chạy đóng.
- Cache lỗi không làm mất dữ liệu gốc. API GET Feed công khai và GET public Feed theo tài khoản chuyển sang limiter cục bộ tối đa 5 request/giây và 30 request/phút theo khóa bảo vệ, mỗi replica. Các thao tác ghi, API quản trị, `mine`, `saved`, `following`, auth và thanh toán vẫn giữ bảo vệ Redis hiện có.

## Kiểm tra và cảnh báo

`GET /api/internal/feed/cache/status` chỉ cho Admin, trả trạng thái cờ, backlog có giới hạn đếm 10.000, tuổi event cũ nhất, số retry, lần chạy worker gần nhất, thời gian vòng worker và hit/miss object cache theo list/detail. Metrics object cache và worker là số liệu của process hiện tại; backlog dùng chung DB. `writeAttempts`/`bytesAttempted` là số lần/dung lượng thử ghi, không phải xác nhận ghi thành công.

Cảnh báo:

- `feed_cache_backlog_high`: từ 1.000 event đang chờ.
- `feed_cache_backlog_old`: event đang chờ cũ nhất từ 300 giây.
- `feed_cache_redis_unavailable`: cache bật nhưng Redis chưa sẵn sàng.

Job cảnh báo kiểm tra mỗi phút và đưa email vào mail outbox cho tối đa 50 tài khoản Admin/Support đang hoạt động có email. Khử trùng theo giờ/tài khoản. Trước lúc gửi, mail worker kiểm tra lại quyền người nhận; tài khoản bị thu hồi quyền không nhận email. Cần `MAIL_ENABLED` và SMTP hoạt động để email thực sự được giao. Kiểm thử tự động giả lập gửi thư; chưa xác nhận email đến hộp thư production.

Khi Redis hỏng, dashboard quản trị có thể bị bảo vệ Redis từ chối; dùng `/api/health`, log hạ tầng và kênh cảnh báo để chẩn đoán. Không tắt bảo vệ thao tác ghi để chữa lỗi cache.

## Dựng lại và rollback

- Sau khi Redis trống/khởi động lại, tiếp tục đọc từ PostgreSQL. Bật worker, chờ outbox ổn định và gọi API rebuild bằng Admin nếu cần nạp ngay trang đầu.
- Rebuild chỉ đổi generation rồi nạp trang đầu. Key generation cũ tự hết TTL. Không cần quét/xóa toàn bộ Redis và không dùng `FLUSHDB` vì Redis còn phục vụ rate limit và các tính năng khác.
- Nếu chỉ mục gây tăng P95, đặt `FEED_CACHE_INDEX_ENABLED=false` trước. Object cache vẫn hoạt động.
- Nếu object cache có vấn đề, đặt `FEED_CACHE_ENABLED=false` và restart đúng process theo quy trình triển khai. API trở lại truy vấn DB; trigger tiếp tục giữ event để có thể bật lại.
- Không giảm generation, không xóa pending event và không rollback dữ liệu nghiệp vụ để chữa lỗi cache.

## Kiểm chứng cục bộ

Chỉ sử dụng database có tên `lambe_booking_test_*` và Redis DB 15. `DATABASE_URL` phải trùng `TEST_DATABASE_URL`, `NODE_ENV=test`. Không dùng DB ứng dụng đang chạy.

```text
npx jest --config test/jest-feed-cache.json --runInBand
npm run test:organization-feed
npx ts-node scripts/benchmark-feed-cache-db.ts
```

Script benchmark DB khởi động một API công khai tạm thời, dùng DB/Redis thử, đổi metadata generation và dọn các key snapshot được đo để tạo cache lạnh thật. Script không sửa bài/dịch vụ; có ghi metadata outbox phục vụ thử nghiệm. Đo 100 request mỗi trường hợp, concurrency 5, warmup 20. Không bao gồm JWT/rate limiter trong phép đo HTTP nhỏ này. Dùng `scripts/benchmark-feed-cache.mjs` nếu chỉ cần probe HTTP vào server có sẵn mà không đổi metadata DB/cache.

Kết quả ngày 20/11/2026 được lưu tại `qa/feed-cache-2026-11-20.json`. Bộ dữ liệu nhỏ cục bộ không thay thế load test production.

Đặt thêm `FEED_BENCH_HOT_KEY=true` để chạy profile hot key: cùng một bài/provider, 500 request mỗi trường hợp, concurrency 20 và burst lạnh 20 request đồng thời. Kết quả đã chạy ở `qa/feed-cache-hot-key-2026-11-20.json`: 3.000 request đo tải nóng và 120 request burst lạnh hoàn tất, không lỗi HTTP, không timeout/lỗi cache. Object cache giảm từ 6 xuống 2 query/request; index list cần 3. Đây là số lượt truy vấn, không đồng nghĩa thời gian xử lý PostgreSQL giảm cùng tỷ lệ.

Ở profile hot key, P95 list lần lượt 40,133 / 28,904 / 33,247 ms khi tắt cache / chỉ object / có index; detail 21,700 / 19,428 / 17,686 ms. Chưa đạt giảm P95 25% ở mọi trường hợp. Bắt đầu canary bằng object cache; chỉ bật index khi số đo trên dữ liệu/tải đại diện chứng minh lợi ích. Báo cáo có CPU API cùng bộ sinh tải, tổng thời gian query phía Prisma và snapshot Redis memory toàn process dùng chung các DB; không dùng chúng để kết luận CPU DB hoặc dung lượng riêng Feed.

## Mobile và gợi ý thử nghiệm

- Mobile lưu tối đa 3 trang đầu, 20 bài/trang, 512 KiB, TTL 15 phút trong file tạm phiên bản 1. Chỉ lưu nội dung công khai và counts; viewer flags được trung hòa. Không lưu managed/saved/following.
- Đổi tài khoản hoặc logout sẽ xóa cache. Khi server trả 403/404, bài bị loại khỏi các trang đã lưu. Cache offline có thể chứa nội dung chưa kịp nhận quyết định thu hồi; UI hiển thị đang dùng bản đã lưu và làm mới khi có mạng.
- Prefetch tối đa hai ảnh kế tiếp, giới hạn kích thước decode; video vẫn chỉ tạo decoder khi người dùng chủ động xem.
- `GET /api/me/feed/recommended` là endpoint riêng, tối đa 20 bài, chiến lược `rules-v1`. Chấm điểm theo độ mới, sở thích onboarding, provider đã follow, tương tác gần đây và độ phổ biến; giới hạn hai bài/provider và đọc lại visibility theo lô trước khi trả. Không cache response cá nhân cuối cùng.
- `POST /api/me/feed/posts/:id/engagements` nhận VIEW/DWELL/SKIP/OPEN_SERVICE/START_BOOKING, `clientEventId` UUID và tùy chọn `durationMs` tối đa 300.000. Event chống trùng theo tài khoản, không chứa tọa độ/token/nội dung chăm sóc. Dữ liệu client là tín hiệu không đáng tin, chỉ phục vụ ranking.
- Backend chỉ ghi event/gợi ý khi bật `FEED_RECOMMENDATIONS_ENABLED`. Mobile chỉ gửi khi build với `--dart-define=FEED_RECOMMENDATIONS_ENABLED=true`. Theo dõi VIEW/DWELL/SKIP tại trang chi tiết có xét vòng đời app/route; OPEN_SERVICE/START_BOOKING tại thao tác đặt dịch vụ.
- Chưa bật tab gợi ý mặc định. Candidate retrieval nâng cao theo vị trí, vector/ML, cache candidate riêng, đánh giá chất lượng và A/B test cần dữ liệu hành vi thật. Chúng vẫn là các mục có điều kiện trong giai đoạn tương lai của kế hoạch.
