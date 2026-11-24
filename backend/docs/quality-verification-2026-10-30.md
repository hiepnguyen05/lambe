# Nghiệm thu chất lượng/vận hành P6 — 30–31/10/2026

Phạm vi là phần QA/vận hành độc lập trong kế hoạch. Không mở lại phát triển
P5/đối tác tổ chức; các API tổ chức hiện có chỉ được chạy regression. Không
chuyển MoMo/SePay khỏi sandbox, không thêm payout, không thêm migration.

## Thay đổi đã thực hiện

1. ADMIN-only `GET /api/admin/observability`: HTTP/SSE, process, hàng đợi,
   worker, push/rematch/AI counters và các cờ cảnh báo tổng hợp. Route label,
   bộ nhớ và truy vấn DB đều có giới hạn; đọc dependency được gộp/cache.
2. Redis tự reconnect, có deadline khởi động và không queue command nghiệp vụ
   khi offline. Sửa race handoff subscriber: giữ callback mới trước khi chờ
   readiness, cleanup chỉ gỡ đúng entry còn sở hữu. Hai test mới tái hiện
   trường hợp callback mất và subscription thất bại.
3. Health không phụ thuộc Redis throttling; gộp probe PostgreSQL/cache một
   giây, giới hạn thời gian chờ và không sinh thêm probe khi query còn treo.
   Docker chỉ coi `data.status: ok` là khỏe, không coi degraded là ready.
4. Request context bằng AsyncLocalStorage; worker có run ID riêng. Counter
   rematch/AI tăng sau commit; replay idempotent không tính lần chọn mới.
   Không giả định HTTP requestId đã đi xuyên hàng đợi bền vững.
5. Log Cloudinary, SMTP, Redis, Gemini và hai worker đã xử lý được giới hạn
   dữ liệu; không log lỗi provider thô, địa chỉ người nhận hoặc publicId KYC
   tại các điểm đã sửa. Poll worker rỗng chỉ ghi metrics. Log container server
   xoay tối đa ba file 10 MB. Đây chưa phải chứng nhận mọi log trong backend.
6. Override có mục tiêu: body-parser **2.4.0**, multer **2.5.0**, qs **6.16.2**,
   follow-redirects **1.16.2**. Không thêm runtime dependency mới, không chạy
   audit fix/force hoặc đổi major của Nest/Prisma/SDK thanh toán.
7. Công cụ baseline dùng thư viện sẵn có; công cụ so sánh OpenAPI dùng Node
   stdlib. Harness E2E từ chối DB không phải test trước khi khởi tạo provider.
   Sửa cleanup notification của fixture và giờ đặt mẫu phụ thuộc thời gian
   chạy; không nới điều kiện nhận đơn hoặc bỏ bảo vệ last-admin.

## Bằng chứng kiểm thử

Các nhóm dưới đây đã chạy trên **Linux Node 22.23.4**, PostgreSQL 16, Redis
test DB15; outbound Firebase/Gemini/mail/storage được thay thế hoặc vô hiệu
hóa. Guard, DTO, service, transaction và SQL trong phạm vi tương ứng là code
thực. Test tổ chức sử dụng API đã có, không phải triển khai thêm P5.

| Nhóm | Kết quả |
| --- | ---: |
| `npm run check`: source/test typecheck + lint + unit | 808 test / 139 suite đạt |
| HTTP E2E | 78 trường hợp duy nhất / 10 suite đạt: 77 của lượt tổng hợp + 1 case mới |
| Booking / wallet / voucher / add-on / rematch | 34 đạt |
| AI consultation | 21 đạt |
| Organization chat | 13 đạt |
| Organization feed | 23 đạt |
| Organization reviews | 19 đạt |
| Organization finance | 18 đạt |
| Organization booking | 20 đạt |
| Provider members | 75 / 3 suite đạt |
| Provider operational notifications | 18 đạt |
| Tổng HTTP E2E và integration | **319 trường hợp duy nhất đạt** |
| Flutter analyze | Không có issue |
| Flutter test | **215 đạt** |
| OpenAPI comparator self-test | **23 CLI checks đạt** |

Mốc unit/E2E và ma trận integration được ghi tại
`tasks/quality-docker-ci-final.log` và `tasks/quality-docker-ci-resume.log`.
Sau bản vá follow-redirects, image cuối còn được kiểm tra riêng bằng
`tasks/quality-release-ci-20261031.log`; trạng thái nghiệm thu image này ghi
ở mục triển khai bên dưới, không suy diễn từ lượt chạy trước. Case mới kiểm
tra dashboard qua AppModule/guard/SQL PostgreSQL thật, ADMIN thành công và
Customer/Support bị từ chối; cả suite security **38/38** được chạy lại, kèm
typecheck test và lint tại `tasks/quality-observability-postgres-e2e.log`.

### Kiểm thử sự cố Redis

`test/redis-recovery.integration-spec.ts` đã qua **1 test tích hợp thực** trên
Node **22.23.4 Windows**, dùng Docker CLI để stop/start duy nhất Redis tạm
`lambe-quality-redis` trên localhost:6381/15. Container phải có label đúng;
DB hai biến URL phải trùng và có tên `lambe_booking_test_*`.

Đã kiểm chứng: client đang chạy tự reconnect, subscriber nhận wakeup trở lại,
client khởi tạo lúc Redis down không giữ startup vô hạn, chat lưu được trong
DB test và đọc lại, order notice chưa publish được relay sau phục hồi. Không
restart Nest hay Redis ứng dụng. Log: `tasks/quality-redis-recovery-node22.log`.

**Giới hạn:** test AppModule bỏ global throttle theo NODE_ENV=test. Production
vẫn fail-closed 503 ở route cần Redis-backed throttling khi Redis hỏng. Kết
quả chứng minh lưu bền vững/khôi phục, không cam kết mọi HTTP write vẫn được
phục vụ khi Redis down. Node 24 Windows đã dừng bất thường trong một lượt
Jest; không tính lượt đó là test đạt. Node 22 tạm dùng npm cache, không thay
Node mặc định của máy hoặc dependency dự án.

### Fixture phụ thuộc giờ chạy

Case travel-buffer ban đầu lấy giờ hiện tại cộng hai ngày; gần đêm thì slot
thứ hai kéo qua nửa đêm và bị `OUTSIDE_WORKING_HOURS`. Fixture nay đặt 10:00
Việt Nam, kiểm tra thợ bận trả chính xác `PROVIDER_TIME_CONFLICT`, thợ khác
còn khả dụng. Nhóm 20 test đã chạy lại và đạt. Không thay thuật toán giờ làm,
không bổ sung hỗ trợ ca qua đêm hoặc tính năng P5.

## Hiệu năng: kết quả đo, không phải SLA

Artifact: [Linux FD baseline](../test/quality-baseline.linux-fd.result.json).
Container 2 CPU/1 GiB, Node 22.23.4, 200 đối tác cá nhân, 1.000 đơn lịch sử
REJECTED, 1.000 chat message, 200 Feed post và 1.000 push outbox giả lập.
Mỗi loại tìm kiếm có 100 mẫu, concurrency 4, dữ liệu ấm, loopback cùng máy.

| Tác vụ | p50 | p95 | p99 |
| --- | ---: | ---: | ---: |
| Discovery ASAP | 64,553 ms | 103,175 ms | 136,151 ms |
| Discovery SCHEDULED | 60,275 ms | 81,436 ms | 114,476 ms |
| 12 SSE handshake | 31,063 ms | 75,403 ms | 75,403 ms |
| Commit batch → 12 SSE client | 32,433 ms | 55,111 ms | 55,111 ms |

RSS peak **307.834.880 byte**, khoảng 293,6 MiB. FD **35 → 65 → 41**, đạt
ngưỡng cleanup ≤43, không tuyên bố trở về đúng baseline. Một số kết nối pool
được giữ lại. AI history 1→40 result vẫn **14 SQL**; Feed 1→20 post vẫn **9 SQL**.
Đã đo EXPLAIN ANALYZE BUFFERS cho chat afterSequence, hai truy vấn rematch và
claim push; chưa có bằng chứng cần thêm index nên không thêm index đoán trước.

Không đo năng lực tối đa hay cam kết nghìn người dùng đồng thời. Lịch bận dày,
cache lạnh, nhiều replica, vận chuyển mạng thật/thiết bị, member calendar và
FCM thật chưa được mô phỏng bởi baseline này. Chi tiết và các lượt đo cũ tại
[performance baseline](quality-performance-baseline.md).

## Security và dependency

38 test trong suite security có guard test-target và HTTP thực: auth domain,
session, BOLA, role-negative, input/upload/privacy và Redis-backed 429. Cùng
các suite booking/member/Feed/push kiểm tra quyền và cạnh tranh. Không chạy
Strix/pentest chủ động, không gửi source lên dịch vụ quét bên ngoài.

[Security evidence](quality-security-evidence.md) phân biệt những gì kiểm
thử, những gì chỉ suy luận theo source và advisory. Kiểm thử upload sử dụng
storage mock; unit kiểm tra tham số authenticated/expiry không thay thế thử
thực trên Cloudinary. Không khẳng định không còn mọi lỗ hổng/PII khó nhận diện.

[Runtime dependency evidence](quality-runtime-dependencies-2026-10-31.md)
phân biệt image, package vật lý, npm rollup và advisory riêng lẻ. Prisma CLI,
config và deepmerge không có trong runtime đã prune; không dùng số audit của
builder để mô tả runtime. Các bản vá chỉ được coi đóng gói khi filesystem của
image cuối xác nhận; advisory không phải bằng chứng khai thác được Lambe.
Image cuối được audit lại độc lập: **0 Critical, 0 High, 10 Moderate** package
entry. Đây là số npm advisory/rollup, không phải số exploit đã chứng minh.
Không nâng major hoặc coi các cảnh báo Moderate còn lại là đã xử lý.

## Triển khai và hợp đồng

Trạng thái: **đã triển khai Docker local ngày 31/10/2026**. Image
`a257b1c8555a5af5f4d328384cadd63864bfa74724400ff9c7c9bb51c38f5d95`, Node 22.23.4.
Image cuối qua `npm run check` (808/808), toàn bộ E2E 77/77, comparator 23/23;
sau đó thêm case dashboard SQL thật và chạy lại security 38/38. Container
`healthy`, health trả DB/Redis `up`, không token vào dashboard trả 401.

- Image rollback đã giữ: `lambe-backend:pre-p6-20261030` (337fdc0b7822).
- App DB `lambe_db` được ghi số lượng/hash trước triển khai; mọi fixture,
  benchmark và fault test dùng DB/Redis test riêng. Có 58 migration hiện có;
  P6 không thêm migration.
- Baseline OpenAPI đang chạy: 271 path, **312 HTTP operation**, 101 schema.
  Comparator yêu cầu giữ mọi operation và schema được tham chiếu, so body,
  params, security và response; không chỉ so tổng số API.
- Runtime mới: **272 path, 313 HTTP operation**, vẫn 101 schema. Thêm duy nhất
  `GET /api/admin/observability`, không mất operation/schema được bảo vệ.
- Comparator thận trọng báo review ba parameter có enum đảo thứ tự sinh tài
  liệu. Đã so từng giá trị, kiểu, vị trí, required/default: cùng tập giá trị,
  không đổi xác thực hay contract. Không sửa comparator để im lặng bỏ khác biệt.
  Xem [kết quả review](quality-openapi-review-2026-10-31.json) và raw comparison
  `tasks/quality-openapi-comparison.json`.
- Dữ liệu trước/sau: 8 user, 1 provider, 19 order, 1 chat/31 message, 1 Feed
  post; tổng ví **165.000**, giữ **5.000**, hash tổng hợp ví đều
  `819c9fea26cd24ddda994aa9efa9b029`. Không tạo tài khoản test trong app DB.
- Migrate không thêm phiên bản: **58** đã áp dụng, không pending. PostgreSQL/
  Redis app không bị xóa volume. Log server thực tế json-file 10 MB × 3.

## Việc chưa được nghiệm thu toàn bộ

Giữ mở checkbox liên quan khi chưa đủ bằng chứng: hoàn thiện mọi response
schema Swagger của roadmap, tài liệu/deep link chưa triển khai, P5 calendar
và assignment contention, rà toàn bộ log/payload ngoài điểm đã sửa, requestId
qua durable queue, attribution AI → booking, alert chuyển tới hệ thống giám
sát ngoài và nghiệm thu bảo mật/tài liệu toàn roadmap. Không đóng mục chỉ vì
API build được hay vì module tổ chức đang tạm ngưng.

Tài liệu vận hành chính: [runbook](quality-operations-runbook.md). UI/nghiệp vụ
được bổ sung phần P6 tại `tailieuUI.md` và `tailieunghiepvu.md`; P5 vẫn tạm ngưng.

## Bản đồ tài liệu đã đồng bộ — 31/10/2026

| Nhu cầu | Tài liệu |
| --- | --- |
| Làm từng màn hình/khối dữ liệu, loading/refresh/error/reconnect | [UI](../../tailieuUI.md), phần P6 cuối tài liệu; là yêu cầu giao diện, chưa xác nhận UI mới đã được dựng. |
| Quyền vận hành, nguồn dữ liệu chuẩn, các quy tắc được giữ nguyên | [Nghiệp vụ](../../tailieunghiepvu.md), phần P6 cuối tài liệu. |
| Request/response, field/type/units/null, cache và lỗi của API mới | [Observability API](observability-api.md). |
| Cấu hình, kiểm thử tách DB, sự cố và rollback | [Runbook](quality-operations-runbook.md). |
| Ảnh hưởng tới các client chức năng hiện có | Phần P6 của [chat](customer-provider-chat-design.md), [push](push-notifications.md), [booking](booking-api.md), [AI](ai-consultation-api.md), [operations](operations-api.md). |
| Bằng chứng chat/AI và giới hạn nghiệm thu | [Chat/AI verification](chat-ai-verification.md). |
| Latency/SQL/FD và giới hạn dữ liệu giả lập | [Baseline](quality-performance-baseline.md). |
| Dependency thực có trong image, advisory còn lại | [Runtime inventory](quality-runtime-dependencies-2026-10-31.md). |
| Tương thích API và ba khác biệt enum đã review | [Comparator](quality-openapi-compatibility.md), [review JSON](quality-openapi-review-2026-10-31.json). |
| Mục đã đóng/còn mở, không tự mở lại P5 | [Kế hoạch](../../tasks/ke-hoach-cai-tien-he-thong.md). |

Đợt đồng bộ Markdown này đối chiếu source và các bằng chứng đã lưu; không
thay code, credential, schema hay trạng thái container. Không ghi số test cũ
thành một lượt test mới, không đóng thêm checkpoint chỉ vì bổ sung mô tả.
