# Chất lượng và vận hành — P6

Cập nhật 31/10/2026. P5/đối tác tổ chức tiếp tục tạm ngưng phát triển. Không đổi
MoMo/SePay khỏi sandbox, không triển khai rút tiền. Tài liệu này mô tả các bảo
đảm đã triển khai và cách chẩn đoán; không phải cam kết năng lực production.

## API giám sát

`GET /api/admin/observability`, dùng Bearer **Internal Access Token**, tài khoản
ACTIVE có role **ADMIN** và session còn hiệu lực. Token khách hàng/đối tác
không dùng được; Moderator/Support không được đọc trang này. Không có body,
query hoặc bộ lọc theo người dùng. Phản hồi có `Cache-Control: no-store`.

Hợp đồng đầy đủ cho frontend, JSON mẫu có đủ field, các nhánh unavailable,
đơn vị thời gian và lỗi: [Observability API](observability-api.md).
Thiết kế từng khối màn hình nằm ở phần P6 của [tài liệu UI](../../tailieuUI.md).

Phản hồi thành công đi qua response interceptor hiện có:

```json
{
  "statusCode": 200,
  "success": true,
  "data": {
    "scope": "process-local-since-start",
    "startedAt": "2026-10-30T00:00:00.000Z",
    "process": {},
    "http": {},
    "workers": {},
    "push": {},
    "events": {},
    "firebase": {},
    "dependencies": {},
    "thresholds": {},
    "alerts": []
  },
  "timestamp": "2026-10-30T00:00:00.000Z"
}
```

Các object rỗng ở ví dụ là chỗ rút gọn, không phải hợp đồng chỉ trả object
rỗng. Các nhóm thực tế:

| Nhóm | Ý nghĩa và giới hạn |
| --- | --- |
| `process` | Uptime giây, RSS/heap theo byte, CPU tích lũy microsecond; không phải phần trăm CPU hay giới hạn RAM container. |
| `http.active` | Số request chưa kết thúc tại replica hiện tại, gồm SSE còn mở. |
| `http.routes` | Method + route template do Express xác định; completed/aborted/4xx/5xx, thời gian, SSE active/opened/resumeSignals/error/duration. Không dùng URL, UUID, query, cursor hoặc token làm nhãn. |
| `http.overflow` | Gộp các route vượt giới hạn 128 nhãn; không tạo Map tăng vô hạn theo request. |
| `http.durationBucketUpperBoundsMs` | Mốc histogram: 10, 50, 100, 250, 500, 1000, 5000 và infinity. Bucket **không cộng dồn**; không nhầm `maxMs` với p99. |
| `workers` | Lượt poll, lỗi, thời điểm poll gần nhất của push và order-notice-relay. `lastRunAt: null` là chưa quan sát, không tự coi worker khỏe hay hỏng. |
| `push`, `events.push` | Kết quả xử lý ở tiến trình này: gửi, retry, hết lượt/thất bại, token không còn hợp lệ, lỗi gửi. Số đang chờ bền vững lấy từ DB, không tăng bộ đếm enqueue trước khi transaction commit. |
| `events.rematch` | Response có ứng viên khả dụng; lần retry mới đã commit; lần nhận đơn retry đã commit. Replay Idempotency-Key không được tính thành lần chọn mới. Đây không phải số khách duy nhất. |
| `events.ai.intent`, `events.ai.cta` | Ý định của câu trả lời mới đã lưu, response có action và action hợp lệ đã ghi nhận. Không lưu prompt, nội dung hội thoại hoặc người dùng vào metrics. Action trả về chưa chứng minh UI đã render. |
| `firebase` | Kết quả lần gọi gửi FCM thực tế và thời điểm bắt đầu chuỗi lỗi liên tục; loại bỏ push mất quyền truy cập không phải lỗi Firebase. |
| `dependencies` | Thời điểm lấy mẫu, trạng thái PostgreSQL/Redis, push pending/retry/failed/backlog/oldestAge và order notice chưa publish. |

Thống kê RAM/counter/histogram là **của một tiến trình và mất khi restart**,
không phải tổng toàn cluster. Đọc DB được gộp request đồng thời và cache 5 giây,
transaction chỉ đọc, statement timeout 750 ms; mỗi tập hàng đợi bị chặn ở
10.001 dòng để phát hiện ngưỡng 10.000. Trường `*LowerBound` báo số đếm/tuổi
chỉ là cận dưới khi bị cắt; không trình bày thành số chính xác. Query có thể
hết deadline ở dữ liệu lớn: trạng thái là `unavailable`, không trả lỗi DB thô.

**Chưa có attribution booking về AI**, nên không tính tỷ lệ chuyển đổi từ
click thành đơn bằng cách đoán theo các sự kiện gần nhau. Chưa có kho metrics
bền vững hoặc gửi cảnh báo ra email/Slack. Một hệ thống giám sát ngoài có thể
poll endpoint này; không chia sẻ token Admin với ứng dụng khách hàng.

## Ngưỡng cảnh báo hiện tại

Các giá trị là hằng số trong `observability-metrics.service.ts`, không có biến
môi trường mới cần điền. `alerts` là mã trạng thái để bảng điều khiển trình bày:

- `postgres_unavailable`, `redis_unavailable`: không đọc được dependency.
- `outbox_backlog_high`: ít nhất 1.000 push hoặc order notice đang chờ.
- `outbox_backlog_old`: có hàng đợi tồn ít nhất 300 giây; gồm cả retry bị trì hoãn.
- `outbox_backlog_growing`: lớn hơn lần lấy mẫu trước; một lần tăng không chứng minh tắc nghẽn.
- `worker_stale:push`, `worker_stale:order-notice-relay`: worker từng được quan sát nhưng không poll trong 60 giây.
- `firebase_failures_sustained`: chuỗi lỗi gọi FCM kéo dài 60 giây, được xóa khi có lần gửi thành công.

Dashboard vẫn giữ giới hạn truy cập toàn cục và có thể trả **503 khi Redis
throttling hỏng**. Nó không phải lối bỏ qua giới hạn. Khi đó dùng health và
công cụ vận hành bên dưới. 401: token/session không hợp lệ; 403: thiếu quyền;
429: vượt giới hạn. Không tự lặp vô hạn khi gặp 401/403/429.

## Redis và realtime

Redis publisher dùng kết nối lại với backoff tối đa 3 giây. Khởi động chỉ chờ
đến `REDIS_CONNECT_TIMEOUT_MS` (mặc định 3.000 ms), sau đó vẫn retry nền.
Không xếp hàng command nghiệp vụ trong bộ nhớ khi offline: vị trí/rate limit
cần Redis trả lỗi tạm thời; cache đọc thông thường có thể quay về PostgreSQL.
Subscriber có thể khôi phục đăng ký và dọn đăng ký sau reconnect.

PostgreSQL giữ chat message và order notification. Redis Pub/Sub là tín hiệu
đánh thức, **không phải nơi lưu duy nhất**. Chat đồng bộ lại bằng sequence;
order notice chưa publish được relay thử lại mỗi giây. Redis mất dữ liệu GEO
sau restart cần app thợ gửi heartbeat/vị trí mới; không khôi phục thợ online
bằng tọa độ cũ không còn đáng tin. Không tự đổi Redis down thành danh sách
thợ rỗng và báo rằng không có thợ.

`GET /api/health` được miễn riêng hai cửa sổ throttle Redis để có thể báo tình
trạng Redis khi dependency này hỏng. Health không trả thông tin tài khoản,
URL kết nối hay credential. Không dùng health 200 làm bằng chứng FCM/Gemini
đang hoạt động. Giám sát cần đọc trạng thái trong response và `alerts`.

Probe PostgreSQL được gộp và cache một giây; phản hồi chờ tối đa một giây,
không sinh thêm probe khi query cũ chưa kết thúc. Health 200 có `degraded`
khi Redis down để công cụ chẩn đoán vẫn đọc được; Docker health check chỉ coi
`data.status === "ok"` là khỏe. Log server dùng json-file xoay 10 MB × 3 file;
poll worker rỗng chỉ tăng heartbeat metrics, không ghi log mỗi giây.

SSE reconnect có thể có `after`, `afterSequence` hoặc Last-Event-ID tùy API.
Đây là tín hiệu resume, không xác định được thiết bị hay đếm chính xác số lần
khách reconnect. Client đóng màn hình là disconnect, không tự quy thành lỗi
máy chủ. Client giữ cursor, retry có backoff/jitter và lấy bù dữ liệu; không
xóa danh sách đang hiển thị khi kết nối lại.

## Khi hàng chờ push tăng

1. Đối chiếu `sampledAt`, `startedAt` và replica: số liệu có thể chậm 5 giây
   hoặc vừa reset sau deploy. Xem queue due, retry trì hoãn và lease riêng.
2. Kiểm tra worker còn poll, Firebase được bật và service account đúng project.
   Không gửi thử thật hàng loạt để đo tải.
3. Lease push là 2 phút; worker chết thì worker khác nhận lại sau khi lease
   hết. Batch tối đa 20 lượt mỗi 5 giây, gửi ngoài transaction giữ khóa DB.
4. Lỗi tạm thời retry tăng dần, tối đa 8 lượt; token invalid bị thu hồi, app
   đăng ký token mới sau khi đăng nhập. Lỗi credential cần sửa cấu hình,
   không coi là lỗi token của tất cả thiết bị.
5. Chỉ replay có chọn lọc sau khi xác minh nguyên nhân và quyền nhận hiện tại.
   Không TRUNCATE outbox, không đổi `sentAt` về null hay xóa ledger để làm sạch.

FCM là **at-least-once trong tình huống crash**: gửi thành công nhưng chết trước
khi ghi `sentAt` có thể gửi lại sau lease. Mobile deduplicate bằng notificationId
ổn định và lấy trạng thái mới từ API. Không cam kết exactly-once ngoài DB.

Một số lệnh đọc từ **PowerShell trên máy host**, không chạy từ shell container:

```powershell
Set-Location D:\Project\Lambe\backend
docker compose ps
docker exec lambe-redis redis-cli PING
docker exec lambe-postgres psql -U postgres -d lambe_db -c 'SELECT COUNT(*) FILTER (WHERE "sentAt" IS NULL AND "failedAt" IS NULL) AS pending, COUNT(*) FILTER (WHERE "sentAt" IS NULL AND "failedAt" IS NULL AND "availableAt" <= NOW() AND ("lockedUntil" IS NULL OR "lockedUntil" < NOW())) AS due, COUNT(*) FILTER (WHERE "failedAt" IS NOT NULL) AS failed FROM push_outbox;'
```

Không in token, email, số điện thoại, giấy tờ, signed URL hoặc toàn bộ payload
khi chia sẻ log. Request HTTP có `x-request-id` giới hạn 100 ký tự an toàn,
được giữ qua AsyncLocalStorage. Worker có mã lượt chạy riêng, không giả định
requestId HTTP đã được lưu xuyên hàng đợi bền vững. Log Gemini lỗi dùng mã
request và lý do đã giới hạn; correlation này chưa phải distributed tracing.

## Kiểm thử và đánh giá tải

- Kết quả và giới hạn: `quality-verification-2026-10-30.md`.
- Bảo mật/role/input/429 và dependency: `quality-security-evidence.md`.
- Baseline, dataset, p50/p95/p99, SQL plans: `quality-performance-baseline.md`.
- `npm run check`: typecheck source/test, lint và unit test; không thay thế E2E.
- Test DB phải có tên `lambe_booking_test_*`, URL chính và URL test trùng nhau;
  Redis DB15. Không chạy fixture/load trên `lambe_db`.
- Harness AppModule kiểm tra ràng buộc DB trước khởi tạo provider/ghi fixture.
  Chuỗi nghiệm thu tổng hợp dùng DB test sạch mới; một số integration fixture
  được giữ lại để phân tích, không giả định DB đã rỗng sau toàn bộ ma trận.
- Benchmark cần **Redis instance riêng**, vì Pub/Sub không cách ly theo số DB.
- Test restart chỉ nhận container `lambe-quality-redis`, label
  `lambe.task=quality-20261030`, localhost:6381/15 và cờ
  `QUALITY_REDIS_RESTART_TEST=1`. Tuyệt đối không restart Redis ứng dụng để thử.

Baseline nhỏ/dữ liệu ấm không chứng minh 1.000 người dùng đồng thời. Trước mở
rộng cần thêm traffic phân bố thực, lịch bận dày, cold cache, nhiều replica,
tài nguyên giới hạn và đo nhiều lần. Chỉ thêm index sau khi plan/query chứng
minh nhu cầu; không thêm công cụ hay dependency tải lớn chỉ để hoàn thành checkbox.

## Triển khai và rollback

1. Build và kiểm thử image builder Node 22; migrate test DB riêng, so sánh
   OpenAPI trước/sau và kiểm tra dữ liệu ứng dụng bằng số lượng/hash tổng hợp.
2. Lưu tag/digest image đang tốt và backup DB theo chính sách trước thay đổi
   schema. Đợt P6 này không thêm migration.
3. Chỉ thay container server sau khi kiểm thử đạt; không `down -v` hoặc xóa
   volume để xử lý lỗi ứng dụng. Kiểm tra health, auth-denial và log sau deploy.
4. Lỗi code không đổi schema: chạy lại image đã lưu và xác minh health/queue.
   Counter trong bộ nhớ reset là bình thường. Không cần hạ PostgreSQL/Redis.
5. Migration Prisma đã áp dụng không tự có lệnh down an toàn. Ưu tiên forward
   fix; khôi phục backup cần đánh giá dữ liệu phát sinh và dừng ghi có kiểm soát.
   `prisma migrate resolve` không hoàn tác dữ liệu. Không thử rollback phá hủy
   trên DB ứng dụng để đánh dấu checklist.

Phần diễn tập migration/rollback liên quan schema tổ chức còn chờ mở lại P5.
Nghiệm thu push iOS/APNs, hai thiết bị thật và chất lượng tư vấn AI vẫn là
công việc riêng; unit test và metrics không thay thế các bước đó.

## Cấu hình hiện hành và điều gì không cần cấu hình thêm

P6 không thêm dịch vụ/container giám sát bắt buộc, database time series,
Prometheus API, API key metrics hoặc biến `OBSERVABILITY_ENABLED`. Dùng cơ
chế xác thực nội bộ hiện có; không đưa Internal JWT secret vào frontend.
Các giá trị trong bảng là mặc định/source và ví dụ Compose, không đọc từ
`.env` chứa credential của người dùng:

| Cấu hình | Ý nghĩa đối với P6 |
| --- | --- |
| `REDIS_ENABLED=true` | Docker/production dùng Redis cho cache/realtime/rate limit. Disabled ở development có memory throttle từng tiến trình; Redis đã bật nhưng down không tự fallback để bỏ qua giới hạn. |
| `REDIS_URL` | Trong Compose hiện tại dùng hostname dịch vụ `redis:6379`; từ host dùng localhost:6379. Không dùng localhost trong container để trỏ sang container Redis khác. Giữ số DB ứng dụng hiện có. |
| `REDIS_CONNECT_TIMEOUT_MS` | Mặc định 3000 ms; ngân sách chờ khởi động/kết nối. Không phải TTL online, timeout HTTP hay thời gian cache dashboard. |
| `PROVIDER_LOCATION_TTL_SECONDS` | Mặc định 120 giây, validation 30–600; heartbeat cũ quá TTL không chứng minh thợ online. P6 không tăng TTL để che mất kết nối. |
| `JWT_SECRET`, `INTERNAL_JWT_SECRET` | Hai secret hiện có, khác nhau; dashboard dùng internal token/session. Không đổi secret chỉ để bật dashboard. |
| `FIREBASE_ENABLED` và credential hiện có | Cờ này liên quan cả Firebase identity và worker push. Không tắt trong production như một công tắc chỉ tắt cảnh báo; các test dùng mock và tắt tích hợp thật. |
| `NODE_ENV` | Swagger `/docs` và `/docs-json` được bật ở development; không bật public Swagger ở production chỉ để chạy so sánh tài liệu. NODE_ENV=test bỏ global throttle theo cấu hình test; không dùng mode này cho server phục vụ người dùng. |
| Hằng số observability | 128 nhãn route, 10.000 dòng mỗi tập queue, cache 5 giây, statement deadline 750 ms, maxWait transaction 1000 ms/timeout 2000 ms. Chỉnh code có review nếu thật sự cần; chưa có API cấu hình từ Admin. |
| Health | Gộp probe DB, cache 1000 ms, chờ response probe 1000 ms; query treo vẫn được giữ để không phát sinh probe mới. Không phải timeout cứng hủy query DB. |
| Docker logging | Server json-file `max-size: 10m`, `max-file: 3`; đây là xoay log cục bộ, chưa có kho log tập trung. |

Không thay credential Cloudinary/Firebase/SMTP hoặc cấu hình MoMo/SePay chỉ
vì nâng các dependency đã vá. Bốn override trong package/lockfile là
body-parser 2.4.0, multer 2.5.0, qs 6.16.2 và follow-redirects 1.16.2. Giữ
`npm ci` theo lockfile để build tái lập; không tự chạy audit fix/force. Nguồn,
physical inventory và 10 advisory Moderate còn lại ở
[runtime dependency evidence](quality-runtime-dependencies-2026-10-31.md).

## Chạy lại kiểm thử đúng môi trường

Dùng terminal riêng, Node 22.x (đợt nghiệm thu 22.23.4) hoặc image builder
Docker. Đóng terminal sau khi test để không nhầm environment test với lệnh
chạy ứng dụng; không ghi các giá trị test dưới đây vào `.env` đang dùng.
Ví dụ PowerShell từ `backend/`, với DB/user Docker local mặc định của dự án:

```powershell
$qualityDatabase = 'lambe_booking_test_quality_' + (Get-Date -Format yyyyMMdd_HHmmss)
docker exec lambe-postgres createdb -U postgres $qualityDatabase
if ($LASTEXITCODE -ne 0) { throw 'Không tạo được DB test mới; dừng kiểm thử.' }
$env:NODE_ENV = 'test'
$env:DATABASE_URL = "postgresql://postgres:postgres_password@localhost:5433/$qualityDatabase"
$env:TEST_DATABASE_URL = $env:DATABASE_URL
$env:REDIS_ENABLED = 'true'
$env:REDIS_URL = 'redis://127.0.0.1:6379/15'
$env:TEST_REDIS_URL = $env:REDIS_URL
$env:JWT_SECRET = 'quality-user-synthetic-only-never-production-2026'
$env:INTERNAL_JWT_SECRET = 'quality-internal-synthetic-only-never-production-2026'
$env:KYC_ENCRYPTION_KEY = [Convert]::ToBase64String([byte[]](@(7) * 32))
$env:FIREBASE_ENABLED = 'false'
$env:GEMINI_ENABLED = 'false'
$env:GEMINI_WEB_SEARCH_ENABLED = 'false'
$env:MAIL_ENABLED = 'false'
$env:CLOUDINARY_ENABLED = 'false'
$env:MOMO_ENABLED = 'false'
$env:SEPAY_ENABLED = 'false'
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) { throw 'Migration test thất bại; dừng kiểm thử.' }
npm run check
npm run test:e2e -- --runInBand
npm run test:booking
npm run test:ai-consultation
```

Đây là credential **mặc định local được khai báo trong dự án** và các secret
**giả lập**, không phải mẫu production. Nếu đã đổi user/password/cổng local,
sửa URI của terminal test tương ứng, vẫn giữ tên DB có prefix bắt buộc và
hai biến DB trùng nhau. KYC mẫu được tạo đúng 32 byte; không dùng khóa này
cho hồ sơ thật. Kiểm tra exit code từng lệnh; đoạn ví dụ không phải script
chạy liên tục dù bước trước đã lỗi.

Nếu chạy từ container test, thay DB host/port thành `postgres:5432` và Redis
thành hostname của Redis **test** trên cùng network; không dùng địa chỉ host
localhost:5433 trong container. Khi disabled cloud flags, cần dùng các fixture
và mock của suite, không yêu cầu gửi thử thật SMS/email/FCM/thanh toán.

Các nhóm regression tổ chức hiện có được chạy trong đợt QA chỉ để tránh lỗi
lan sang API đã triển khai: organization-chat/feed/reviews/finance/booking,
provider-members và provider-notifications. Không lấy kết quả đó để mở lại
P5 hoặc đánh dấu các yêu cầu organization còn thiếu là xong. Một số fixture
được giữ lại cho phân tích; dùng DB mới cho ma trận tổng hợp, không TRUNCATE
`lambe_db` và không FLUSHDB/FLUSHALL Redis dùng chung.

Benchmark và Redis restart có quy trình **khác** các test trên:

- Benchmark: cần DB đã migrate còn rỗng và **instance Redis riêng** DB15,
  `--run` rõ ràng; Pub/Sub không cách ly theo logical DB. Làm theo
  [baseline](quality-performance-baseline.md), không dùng app Redis hoặc DB ứng dụng.
- Restart test: chỉ container `lambe-quality-redis` mang label cố định
  `lambe.task=quality-20261030`, localhost:6381/15, cờ
  `QUALITY_REDIS_RESTART_TEST=1`, hai Redis URL/DB URL tương ứng. Tên/label
  được guard trong test, không đổi tùy ý theo ngày. Tắt mọi suite khác đang
  dùng Redis test này trước khi restart. Không restart `lambe-redis`.
- Windows Node 24 đã dừng bất thường trong một lượt; kết quả restart hợp lệ
  được chạy lại bằng Node 22.23.4. Log/bằng chứng ở báo cáo, không coi crash
  hạ tầng kiểm thử là một test đạt hoặc tự nới assertion để tránh lỗi.

Khi chỉ thay Markdown như đợt đồng bộ tài liệu này, kiểm tra liên kết, JSON
ví dụ và đối chiếu contract/source; không cần chạy lại tải, tạo tài khoản,
gửi tích hợp thật hay thay container đang phục vụ.
