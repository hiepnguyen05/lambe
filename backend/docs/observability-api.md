# Hợp đồng tích hợp API observability — P6

Đối chiếu mã nguồn ngày 31/10/2026. Tài liệu chỉ mô tả hành vi hiện có của
`GET /api/admin/observability`; không xác nhận hoàn tất schema Swagger hoặc
đóng QA. P5 tiếp tục tạm dừng; thanh toán tiếp tục ở sandbox.

## Số liệu bổ sung ngày 23/11/2026

| Trường trong `data` | Ý nghĩa |
| --- | --- |
| `process.eventLoopDelayMs` | Số mẫu, độ trễ trung bình, tối đa và các phân vị p50/p95/p99 của event loop. Giá trị `samples: 0` cho biết bộ đo chưa ghi mẫu. |
| `process.gc` | Số lượt, tổng thời gian, thời gian tối đa và số lượt theo loại garbage collection. |
| `http.totals` | Số request đã ghi nhận khi kết thúc, số abort, số lỗi 4xx/5xx và lưu lượng trung bình kể từ khi bộ đo khởi tạo. |
| `http.routes[].sse.messages`, `http.overflow.sse.messages` | Số frame SSE được ghi ra, bỏ qua dòng trắng mở kết nối của Nest. Số đếm bao gồm các frame heartbeat nếu endpoint có gửi. |
| `postgresQueries` | Số SQL query event đã quan sát, số event từ 250 ms trở lên và histogram lấy một mẫu trên mỗi 20 event. |
| `redis` | Histogram thời gian cho GET, MGET, rate limit và publish thông báo. Có bộ đếm lỗi lệnh, lỗi kết nối, reconnect và hết thời hạn chờ kết nối. |
| `redis.cacheLookups` | Four fixed domains: categories, services, feedPosts, other. Each has hits, misses and errors; failed or unavailable reads count as errors. Disabled Redis does not count reads. Keys and returned values are never labels. |
| `events["tracking.gps"]` | Số cập nhật GPS của đơn hàng được nhận, bị từ chối do timestamp ngoài cửa sổ hợp lệ hoặc đến sai thứ tự. |

Các bộ đếm tích lũy thuộc từng process. Tính lưu lượng theo khoảng thời gian
bằng chênh lệch bộ đếm giữa hai lần thu thập có cùng `startedAt`.

## Gọi API, quyền và phản hồi lỗi

- Method/path: `GET /api/admin/observability` (prefix toàn cục `/api`). Không
  có body, tham số path hay query được controller khai báo; không có bộ lọc
  theo tài khoản, khoảng thời gian hoặc replica.
- Gửi `Authorization: Bearer <internal-access-token>`; chữ `Bearer` phải đúng
  như guard kiểm tra. User Access Token do Lambe cấp và Firebase ID token đều
  không thay thế internal token.
  JWT phải có purpose `internal_access`, sub và sessionId hợp lệ. Verifier
  kiểm tra session trong DB: chưa thu hồi/chưa hết hạn, account `ACTIVE`,
  tokenVersion khớp và có role còn hiệu lực. Quyền đọc là `ADMIN`; role được
  lấy lại từ DB, không chỉ tin roles trong JWT.
- Có thể gửi `x-request-id`; quy tắc ở phần correlation bên dưới. Response
  phản chiếu ID đã chuẩn hóa trong header `x-request-id`.
- Thành công: HTTP 200, JSON chuẩn ở phần ví dụ, `Cache-Control: no-store`.
  Đây là header của handler thành công, không phải cam kết mọi lỗi trước
  handler cũng có header này. Bootstrap còn đặt `X-Content-Type-Options:
  nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`.
- API vẫn chịu throttle toàn cục: cửa sổ `short` 10 request/1 giây và
  `medium` 120 request/1 phút; được bỏ qua trong `NODE_ENV=test`. Không xem
  việc poll nhanh hơn cache là cách lấy thêm mẫu dependency.

| HTTP | Điều kiện và cách xử lý |
| --- | --- |
| 401 | Thiếu/sai scheme hoặc token; token/session/account không còn hợp lệ. Verifier cũng chuyển lỗi tra cứu session sang 401. Dừng poll và xử lý phiên đăng nhập; không suy từ 401 rằng DB chắc chắn khỏe. |
| 403 | Phiên hợp lệ nhưng không có role `ADMIN`. Không tự retry liên tục. |
| 429 | Vượt throttle. Giãn nhịp, tôn trọng thông tin retry nếu response có cung cấp. |
| 503 | Redis rate protection không khả dụng có thể chặn request trước controller. Dùng health để chẩn đoán; không dùng dashboard làm đường bỏ qua bảo vệ. |

Lỗi guard/throttle dùng response lỗi Nest, không được interceptor thành công
bọc thành `data`. Các field là `statusCode` (integer), `message` (string;
kiểu lỗi validation chung có thể là string[]), và `error` (string khi có).
401/403 và ServiceUnavailableException dạng string có `error`; riêng
ThrottlerException 429 hiện trả `statusCode`/`message`, không có `error`.
Không giả
định có `success`, `timestamp`, `data` hoặc `requestId` trong body lỗi.
Ví dụ lỗi thiếu token đúng với guard hiện tại:

```json
{
  "message": "Phiên đăng nhập nội bộ không hợp lệ.",
  "error": "Unauthorized",
  "statusCode": 401
}
```

Lỗi verifier có message `Phiên đăng nhập nội bộ không hợp lệ hoặc đã hết hạn.`;
403 có message `Bạn không có quyền thực hiện thao tác này.`. Lỗi Redis storage
khi status khác `up`/`disabled` có message `Dịch vụ bảo vệ giới hạn truy cập
đang tạm thời không khả dụng.`. UI nên phân nhánh theo HTTP/statusCode, không
so sánh message hay dùng ví dụ OpenAPI làm chuỗi lỗi bắt buộc.

Lỗi lấy mẫu PostgreSQL **bên trong** service được chuyển thành
`data.dependencies.postgres.status = "unavailable"` và alert tương ứng;
handler vẫn có thể trả 200. Điều này khác 503 của throttle. Xác thực internal
vẫn cần DB trước khi tới bước lấy mẫu này.

## Ví dụ đầy đủ phản hồi 200

**Toàn bộ số liệu và thời gian sau là giả lập để minh họa, không phải dữ liệu
thực, kết quả đo tải hay bằng chứng nghiệm thu.** Ví dụ thể hiện nhánh PostgreSQL
`up`; nhánh `unavailable` được quy định riêng bên dưới. Không có field rút gọn,
comment hoặc dấu ba chấm trong JSON. Worker dùng epoch milliseconds, còn
`startedAt`, `sampledAt`, `timestamp` dùng ISO 8601 UTC.

```json
{
  "statusCode": 200,
  "success": true,
  "data": {
    "scope": "process-local-since-start",
    "startedAt": "2026-01-01T00:00:00.000Z",
    "process": {
      "uptimeSeconds": 120,
      "memoryBytes": {
        "rss": 104857600,
        "heapUsed": 41943040,
        "heapTotal": 67108864
      },
      "cpuMicroseconds": {
        "user": 1500000,
        "system": 500000
      }
    },
    "http": {
      "active": 1,
      "durationBucketUpperBoundsMs": [10, 50, 100, 250, 500, 1000, 5000, "infinity"],
      "routes": [
        {
          "route": "GET /api/admin/observability",
          "completed": 3,
          "aborted": 0,
          "clientErrors": 1,
          "serverErrors": 0,
          "duration": {
            "count": 3,
            "totalMs": 90,
            "maxMs": 50,
            "buckets": [1, 2, 0, 0, 0, 0, 0, 0]
          },
          "sse": {
            "opened": 0,
            "active": 0,
            "errors": 0,
            "aborted": 0,
            "resumeSignals": 0,
            "duration": {
              "count": 0,
              "totalMs": 0,
              "maxMs": 0,
              "buckets": [0, 0, 0, 0, 0, 0, 0, 0]
            }
          }
        }
      ],
      "overflow": {
        "completed": 0,
        "aborted": 0,
        "clientErrors": 0,
        "serverErrors": 0,
        "duration": {
          "count": 0,
          "totalMs": 0,
          "maxMs": 0,
          "buckets": [0, 0, 0, 0, 0, 0, 0, 0]
        },
        "sse": {
          "opened": 0,
          "active": 0,
          "errors": 0,
          "aborted": 0,
          "resumeSignals": 0,
          "duration": {
            "count": 0,
            "totalMs": 0,
            "maxMs": 0,
            "buckets": [0, 0, 0, 0, 0, 0, 0, 0]
          }
        }
      }
    },
    "workers": {
      "push": { "runs": 24, "errors": 0, "lastRunAt": 1767225715000 },
      "order-notice-relay": { "runs": 120, "errors": 0, "lastRunAt": 1767225719000 }
    },
    "push": { "sent": 2, "retry": 1, "failed": 0, "token-invalid": 0 },
    "events": {
      "push": { "sent": 2, "retry": 1, "failed": 0, "token-invalid": 0, "delivery-error": 0 },
      "rematch": { "offered": 3, "selected": 1, "accepted": 1 },
      "ai.intent": { "CONSULTATION": 2, "PROVIDER_SEARCH": 1, "PRICE_INQUIRY": 0, "OUT_OF_SCOPE": 0 },
      "ai.cta": { "offered": 2, "selected": 1 }
    },
    "firebase": { "successes": 2, "errors": 1, "failingSince": null },
    "dependencies": {
      "sampledAt": "2026-01-01T00:02:00.000Z",
      "postgres": {
        "status": "up",
        "rowLimit": 10000,
        "push": {
          "pending": 3,
          "retry": 1,
          "failed": 0,
          "backlog": 4,
          "countsAreLowerBounds": false,
          "failedIsLowerBound": false,
          "oldestAgeSeconds": 20,
          "oldestAgeIsLowerBound": false
        },
        "orderNotices": {
          "unpublished": 2,
          "countIsLowerBound": false,
          "oldestAgeSeconds": 10
        },
        "backlogGrowing": false
      },
      "redis": { "status": "up" }
    },
    "thresholds": {
      "routeLabels": 128,
      "queueRows": 10000,
      "cacheMs": 5000,
      "queryTimeoutMs": 750,
      "backlogCount": 1000,
      "backlogAgeSeconds": 300,
      "workerStaleMs": 60000,
      "firebaseFailureMs": 60000
    },
    "alerts": []
  },
  "timestamp": "2026-01-01T00:02:00.000Z"
}
```

## Field, đơn vị và nullability

Trong các bảng, `integer` là số JSON nguyên không âm, `number` là số JSON
không âm có thể có phần lẻ. Field bắt buộc và không null trừ nơi ghi rõ.
Object/array cha trong ví dụ luôn có mặt, kể cả khi counter bằng 0 hoặc
`routes`/`alerts` rỗng. Dấu chấm trong key `ai.intent`, `ai.cta` là ký tự
thuộc key, nên truy cập bằng `events["ai.intent"]` và `events["ai.cta"]`.

| Path | Kiểu / ý nghĩa |
| --- | --- |
| `statusCode` | integer, 200 khi thành công. |
| `success` | boolean, true khi thành công ở endpoint này. |
| `timestamp` | string ISO UTC do global transform tạo khi bọc kết quả; không phải thời điểm mọi counter được cập nhật. |
| `data` | object snapshot. Handler này không cung cấp `message`/`meta` trong response thành công. |
| `data.scope` | string literal `process-local-since-start`. |
| `data.startedAt` | string ISO UTC lúc instance metrics được tạo. |
| `data.process.uptimeSeconds` | number, giây sống của tiến trình Node; có thể có phần lẻ. |
| `data.process.memoryBytes.rss` | integer, byte resident memory. |
| `data.process.memoryBytes.heapUsed`, `.heapTotal` | integer, byte heap đang dùng/tổng heap; không phải hạn mức RAM container. |
| `data.process.cpuMicroseconds.user`, `.system` | integer, microsecond CPU tích lũy của tiến trình; không phải phần trăm CPU. |
| `data.http.active` | integer gauge request đang mở, gồm SSE và có thể gồm chính request lấy snapshot. |
| `data.http.durationBucketUpperBoundsMs` | array cố định gồm 7 number theo ms và string `infinity` ở cuối, như ví dụ. |
| `data.http.routes` | array tối đa 128 object route; không có yêu cầu sắp xếp phục vụ UI. |
| `data.http.routes[].route` | string method + template đã chuẩn hóa, ví dụ `GET /api/admin/observability`. |
| `data.http.overflow` | object thống kê cho mọi nhãn mới vượt cap; cùng shape stats với route, **không có** field `route`. |
| `data.workers.push`, `data.workers["order-notice-relay"]` | object worker cố định, mỗi object có ba field ở bảng dưới. |
| `data.push.sent`, `.retry`, `.failed`, `["token-invalid"]` | integer counter kết quả xử lý; đồng thời phản chiếu bốn counter cùng tên trong `data.events.push`. Không phải số bản ghi DB hiện tại. |
| `data.events` | object có đúng các nhóm allowlist được liệt kê dưới đây; mọi leaf là integer counter. |
| `data.firebase.successes`, `.errors` | integer số lần gọi `messaging.send` thành công/lỗi được quan sát. |
| `data.firebase.failingSince` | integer epoch milliseconds hoặc null; lần lỗi đầu sau thành công gần nhất; thành công xóa về null. Không có gửi mới thì chuỗi lỗi không tự hết. |
| `data.dependencies` | object mẫu dependency dùng chung/cache, có `sampledAt`, `postgres`, `redis`. |
| `data.dependencies.sampledAt` | string ISO UTC tạo sau khi hai nhánh dependency hoàn tất; có thể cũ hơn `timestamp`. |
| `data.dependencies.redis.status` | enum string `up`, `down`, `disabled`, `unavailable`. `unavailable` khi getStatus ném lỗi/trả status ngoài ba giá trị chuẩn. Không có field latency hay thời điểm riêng của Redis. |
| `data.thresholds` | object hằng số hiện tại; chi tiết bên dưới. |
| `data.alerts` | string[] các mã trong allowlist cảnh báo bên dưới, có thể rỗng. |

Với mỗi `W` bằng `data.workers.push` hoặc
`data.workers["order-notice-relay"]`:

| Path | Kiểu / ý nghĩa |
| --- | --- |
| `W.runs` | integer, lượt poll thực sự chạy và kết thúc, kể cả poll rỗng. |
| `W.errors` | integer, lượt poll có lỗi; một poll lỗi chỉ tăng một lần dù có nhiều thao tác. |
| `W.lastRunAt` | integer epoch milliseconds hoặc null; cập nhật ở cuối lượt poll. Null là chưa quan sát, không phải xác nhận worker khỏe/hỏng. |

### HTTP, SSE và histogram

Gọi `R` là mỗi `data.http.routes[]` hoặc `data.http.overflow`. Tất cả field
dưới đây có mặt trong cả hai; riêng `route` chỉ nằm trong phần tử `routes`.

| Path | Kiểu / ý nghĩa |
| --- | --- |
| `R.completed` | integer số request đã kết thúc qua finish/close, **gồm cả abort**; không chỉ các request 2xx thành công. |
| `R.aborted` | integer số request kết thúc khi `response.writableFinished` chưa true. |
| `R.clientErrors` | integer số request kết thúc với status 400–499. |
| `R.serverErrors` | integer số request kết thúc với status >= 500. |
| `R.duration` | object timing HTTP từ lúc vào middleware tới finish/close. |
| `R.sse.opened`, `.active` | integer lượt stream mở và gauge stream còn mở. |
| `R.sse.errors` | integer, tối đa một lỗi cho mỗi stream khi response phát event `error`; không tự đếm lỗi nghiệp vụ trong payload SSE. |
| `R.sse.aborted` | integer stream đóng trước khi response hoàn tất; client rời trang cũng có thể làm tăng. |
| `R.sse.resumeSignals` | integer số stream mở có tín hiệu resume; không phải số event replay, thiết bị hay số reconnect chính xác. |
| `R.sse.duration` | object timing từ khi phát hiện SSE lúc writeHead tới finish/close. |

Mỗi object timing `T` (`R.duration` và `R.sse.duration`) có:

| Path | Kiểu / đơn vị |
| --- | --- |
| `T.count` | integer số quan sát đã kết thúc. Stream/request đang mở chưa đóng góp duration. |
| `T.totalMs` | number tổng thời gian ms. |
| `T.maxMs` | number thời gian lớn nhất ms, khởi tạo 0; không phải p95/p99. |
| `T.buckets` | integer[8] số quan sát trong từng khoảng, **không cộng dồn**. Tổng bucket bằng count. |

Khoảng bucket lần lượt là `[0,10]`, `(10,50]`, `(50,100]`, `(100,250]`,
`(250,500]`, `(500,1000]`, `(1000,5000]`, `(5000,+∞)` ms. Không đưa string
`infinity` vào phép tính số. Thời gian không hữu hạn được chuẩn hóa thành 0,
thời gian âm thành 0. HTTP dùng `performance.now()`; không trừ các timestamp
ISO để thay thế histogram.

Nhãn method chỉ nhận `GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS`, còn lại thành
`OTHER`. Template chỉ lấy `request.route.path` do Express resolve sau
middleware, không lấy URL/originalUrl/baseUrl. Template phải là string dài
không quá 240 ký tự khớp `^/[A-Za-z0-9_/:.{}*()-]*$`; ngoài điều kiện hoặc
route chưa match thành `<unmatched>`. Sau 128 nhãn khác nhau, nhãn mới gộp
vào `overflow`; các nhãn đã có vẫn tăng tại phần tử cũ. Không tạo nhãn từ
user ID, requestId, query, token hoặc giá trị cursor.

SSE chỉ được nhận diện khi writeHead có `Content-Type` khớp
`text/event-stream` (có thể kèm `;...`, không phân biệt hoa thường) và status
< 400. Có header `Last-Event-ID` hoặc query key `after`/`afterSequence` là
tăng resumeSignals **một lần**, chỉ kiểm tra sự hiện diện, không kiểm tra
cursor hợp lệ hay replay thành công. Metrics không giữ giá trị cursor.
Một stream SSE đồng thời nằm trong HTTP stats; không cộng hai nhóm thành
hai request độc lập. Middleware chốt mỗi request/stream tối đa một lần.

### Nhánh dependency PostgreSQL và cận dưới

`data.dependencies.postgres.status` chỉ có `up|unavailable`. Khi unavailable,
object chỉ có `{"status":"unavailable"}`: các field bên dưới **vắng mặt**,
không phải null hay 0. UI phải kiểm tra status trước khi đọc số hàng đợi.

Với `P = data.dependencies.postgres` khi `P.status === "up"`:

| Path | Kiểu / ý nghĩa |
| --- | --- |
| `P.rowLimit` | integer 10000, giới hạn hiển thị mỗi tập đếm. |
| `P.push.pending` | integer 0..10000, hàng chưa từng thử (`attempts = 0`), `sentAt IS NULL AND failedAt IS NULL`. |
| `P.push.retry` | integer 0..10000, hàng đã thử (`attempts > 0`) nhưng chưa gửi/chưa terminal. |
| `P.push.failed` | integer 0..10000, hàng có `failedAt IS NOT NULL`, đếm bằng tập độc lập. |
| `P.push.backlog` | integer 0..10000, tổng tập chưa gửi/chưa terminal, gồm pending và retry trước cắt ngưỡng; không cộng failed. |
| `P.push.countsAreLowerBounds` | boolean, true nếu tập chưa gửi/chưa terminal vượt 10000. Khi true, pending/retry/backlog là cận dưới; không bảo đảm pending + retry bằng backlog sau cap. |
| `P.push.failedIsLowerBound` | boolean độc lập, true nếu tập failed vượt 10000. |
| `P.push.oldestAgeSeconds` | integer giây hoặc null khi tập rỗng, tuổi từ createdAt nhỏ nhất trong tập được đọc; floor và chặn dưới 0. |
| `P.push.oldestAgeIsLowerBound` | boolean bằng điều kiện cắt tập backlog; true nghĩa tuổi có thể chỉ là cận dưới. |
| `P.orderNotices.unpublished` | integer 0..10000, số order_notifications có `publishedAt IS NULL`. |
| `P.orderNotices.countIsLowerBound` | boolean, true khi unpublished vượt 10000. |
| `P.orderNotices.oldestAgeSeconds` | integer giây hoặc null khi rỗng; lấy đầu tập sắp theo createdAt, nên vẫn lấy tuổi lớn nhất thực tế trong tập chưa publish dù count bị cap. Không có field `oldestAgeIsLowerBound` ở orderNotices. |
| `P.backlogGrowing` | boolean so tổng push.backlog + orderNotices.unpublished đã cap với **mẫu PostgreSQL thành công trước đó** trong service này. Mẫu đầu false; mẫu unavailable không thay mốc trước. Không phải tốc độ/giây hay so với lần HTTP poll trước. |

Query đọc tối đa 10001 hàng cho mỗi tập pending/failed/notices để nhận biết
vượt 10000. Tập push chưa hoàn tất sắp theo availableAt, không theo createdAt,
nên oldest push có thể chỉ là cận dưới khi cắt tập. Hàng có lease đang giữ
hoặc availableAt trong tương lai vẫn được tính; đây không phải số job due
ngay lúc đọc. Khi không có cắt ngưỡng, pending + retry = backlog.

Không có counter `queued`/`enqueued`. Muốn hiển thị **chưa thử**, dùng
`P.push.pending`; muốn hiển thị **tất cả việc chưa hoàn tất**, dùng
`P.push.backlog` và phân biệt retry. Counter enqueue trong bộ nhớ không thể
thay thế trạng thái DB đã commit; transaction rollback không tạo hàng chờ
bền vững. Các số DB có thể bao gồm công việc do replica khác tạo/xử lý;
chúng không cùng phạm vi với counters local.

### Allowlist event và thời điểm tăng counter

Mỗi path ở bảng là integer bắt buộc, kể cả 0. Nhãn ngoài allowlist bị bỏ qua;
không phát sinh key tùy ý từ caller.

| Path / các key leaf | Hook và ngữ nghĩa commit/replay |
| --- | --- |
| `data.events.push`: `sent`, `retry`, `failed`, `token-invalid` | Push worker tăng khi `deliver()` trả về kết quả, sau các thao tác DB được await. `invalid` được ánh xạ thành `token-invalid`. `data.push` phản chiếu đúng bốn key này. Không cộng hai object với nhau. |
| `data.events.push["delivery-error"]` | Chỉ tăng khi `deliver()` reject ra poll; lỗi gửi được deliver xử lý thành retry/failed không tự tăng key này. Lỗi claim/query ở ngoài deliver có thể tăng worker.errors mà không tăng delivery-error. |
| `data.events.rematch.offered` | Mỗi lần đọc candidates có ít nhất một candidate available. Gọi lại endpoint có thể tăng lại; không deduplicate người dùng hoặc lượt hiển thị. |
| `data.events.rematch.selected` | Sau transaction tạo booking retry đã resolve/commit, chỉ khi `createdNew && retryOfOrderId`. Replay Idempotency-Key trả đơn có sẵn không tăng lần chọn mới. |
| `data.events.rematch.accepted` | Sau transaction accept đã commit, khi `bookingAttempt > 1`. Accept kiểm tra đơn pending; gọi lại trên đơn đã nhận bị chặn, không tính lại như một accept mới. |
| `data.events["ai.intent"]`: `CONSULTATION`, `PROVIDER_SEARCH`, `PRICE_INQUIRY`, `OUT_OF_SCOPE` | Sau transaction lưu assistant message, result của client message và cập nhật conversation đã commit; tăng một nhãn theo result.intent của câu trả lời mới. Replay clientMessageId và đọc lại kết quả đã lưu không đi qua hook này. |
| `data.events["ai.cta"].offered` | Cùng nhánh commit câu trả lời mới, tăng một lần nếu nextActions.length > 0; không tăng theo số action và không xác nhận UI đã render. Replay result không tăng. |
| `data.events["ai.cta"].selected` | Sau khi aiActionEvent.create đã lưu action còn hợp lệ trong result được refresh. Endpoint không deduplicate action submit: gửi lặp action hợp lệ có thể tạo thêm event và tăng counter. Không phải unique click hoặc booking. |

Chi tiết push cần giữ khi diễn giải: updateMany được await nhưng hook không
kiểm tra affected-row count của lease update. Do đó counter là kết quả xử lý
quan sát bởi worker, không phải ledger bảo đảm mỗi chuyển trạng thái DB đúng
một lần. Firebase successes/errors được ghi sát `messaging.send`, **trước**
bước đánh dấu sentAt; lỗi khởi tạo app/messaging trước send không tự tăng
firebase.errors. Việc loại bỏ push do mất quyền/session không đồng nghĩa lỗi
FCM. Crash sau khi FCM gửi nhưng trước khi ghi sentAt có thể gây gửi lại khi
hết lease; retry có thể tạo nhiều lần gửi/lỗi cho một hàng. Không cam kết
exactly-once hay dùng các counter để suy số thiết bị nhận thành công.

Push poll chạy mỗi 5 giây, bỏ qua khi đang xử lý hoặc Firebase không bật;
relay poll mỗi giây (và lúc init), bỏ qua khi đang chạy hoặc Redis chưa up.
Các lượt bỏ qua không cập nhật heartbeat. Poll thực sự chạy cập nhật runs,
errors và lastRunAt trong finally, kể cả không có hàng. Counter được ghi sau
commit vẫn có thể thiếu nếu process chết giữa commit và hook; chúng không
phải audit ledger bền vững.

Không có `ai.booking`, attribution đơn về AI hay tỷ lệ chuyển đổi click →
booking. Không nối các tổng AI/rematch/booking theo thời gian để suy ra quan
hệ nhân quả. Metrics không chứa prompt, tin nhắn, ID tài khoản/đơn, token hay
payload provider.

## Cache, gộp request, deadline và phân biệt health

Chỉ `dependencies` được cache trong bộ nhớ **mỗi service/process** 5000 ms
kể từ lúc đọc hoàn tất, gồm cả mẫu unavailable. Khi hết hạn, mọi request đồng
thời dùng chung một promise đang đọc; không khởi tạo query riêng cho từng
poll. Cache còn hạn được trả ngay. Không có nhánh trả mẫu cũ trong khi refresh.
PostgreSQL và Redis status được đọc song song. Sau khi dependency resolve,
service mới clone metrics local và tính alerts; các nhóm không phải snapshot
nguyên tử cùng một thời điểm. Object cache được clone trước khi trả.

PostgreSQL dùng transaction read-only, `statement_timeout` cục bộ 750 ms,
Prisma `maxWait: 1000` ms và transaction `timeout: 2000` ms. Đây là các giới
hạn khác nhau, không phải SLA response HTTP 750 ms: còn thời gian chờ
transaction, auth, throttle và xử lý HTTP. Lỗi/timeout lấy mẫu bị bắt và chỉ
trả status unavailable, không lộ SQL/error thô. Redis nhánh này chỉ gọi
`cache.getStatus()` đồng bộ; không thực hiện PING mới hay probe FCM/Gemini.

| Hành vi | `/api/admin/observability` | `/api/health` |
| --- | --- | --- |
| Redis | Status trong mẫu dependencies có thể cũ tối đa khoảng TTL 5 giây sau khi lấy mẫu. | Gọi getStatus trực tiếp mỗi check, sau khi chờ DB probe; fresh theo trạng thái client tại lúc gọi, **không phải Redis PING mới**. RedisCacheService trả disabled nếu tắt, up nếu client.isReady, còn lại down. |
| PostgreSQL | Aggregate queue bounded, cache 5 giây, các deadline như trên. | SELECT 1, cache kết quả 1 giây, gộp probe. Chờ tối đa 1 giây bằng Promise.race; query quá hạn không bị hủy, vẫn giữ probe dùng chung tới khi query settle để không nhân probe. |
| Redis down | Có thể bị throttle trả 503 trước handler; nếu handler tới được thì nhánh status có thể sinh redis_unavailable. | Miễn cả short/medium throttle để vẫn chẩn đoán được Redis down. DB up + cache down trả 200 với data.status degraded. |
| DB down | Nếu qua xác thực được, mẫu postgres unavailable vẫn có thể đi cùng 200. | DB probe thất bại trả 503 với body riêng gồm success:false, status:unavailable, services:{database:down,cache:<status>}; đây không phải success envelope. |

Health thành công có `data.status: "ok"` khi DB up và cache không down
(kể cả disabled), `data.services.database: "up"` và `data.services.cache`.
Không dùng health 200 để khẳng định FCM/Gemini khỏe, queue trống hoặc mọi
worker đang poll. Không đồng nhất cache status ở health với dependency status
đã cache của dashboard.

## Ngưỡng và mã cảnh báo

| Path | Giá trị / đơn vị |
| --- | --- |
| `data.thresholds.routeLabels` | 128 nhãn route. |
| `data.thresholds.queueRows` | 10000 hàng mỗi tập. |
| `data.thresholds.cacheMs` | 5000 ms TTL dependency. |
| `data.thresholds.queryTimeoutMs` | 750 ms statement timeout. |
| `data.thresholds.backlogCount` | 1000 hàng. |
| `data.thresholds.backlogAgeSeconds` | 300 giây. |
| `data.thresholds.workerStaleMs` | 60000 ms. |
| `data.thresholds.firebaseFailureMs` | 60000 ms. |

Mọi leaf thresholds là integer không null, hiện là hằng số trong metrics
service. `data.alerts[]` chỉ lấy các mã sau:

| Mã | Điều kiện |
| --- | --- |
| `postgres_unavailable` | postgres.status khác up. |
| `outbox_backlog_high` | push.backlog **hoặc** orderNotices.unpublished >= 1000; không xét tổng hai tập. |
| `outbox_backlog_old` | Tuổi push hoặc notice >= 300 giây; null được coi là 0 khi xét điều kiện. |
| `outbox_backlog_growing` | postgres.backlogGrowing true; không phải xu hướng nhiều mẫu hoặc tốc độ tăng. |
| `redis_unavailable` | redis.status down hoặc unavailable; disabled không tự phát alert này. |
| `worker_stale:push` | lastRunAt của push khác null và tuổi >= 60000 ms. |
| `worker_stale:order-notice-relay` | Điều kiện tương tự cho relay. |
| `firebase_failures_sustained` | failingSince khác null và tuổi >= 60000 ms; không yêu cầu có một lỗi mới trong từng giây. |

`alerts` là kết quả tính khi đọc snapshot, **không phát email, Slack, webhook
hay cảnh báo ra ngoài**. Không có severity, ack, lịch sử cảnh báo hoặc global
incident ID trong response. Cảnh báo queue dựa trên mẫu cache; cảnh báo worker
và Firebase dựa trên state local mới đọc. `alerts: []` không chứng minh mọi
dependency hay worker chưa từng quan sát đang khỏe.

## Correlation và phạm vi số liệu

`x-request-id` chỉ được giữ nếu là string khớp `^[A-Za-z0-9._-]{1,100}$`.
Giá trị không hợp lệ, rỗng hoặc không phải string được thay bằng randomUUID,
không truncate và không trả 400. RequestId được đặt trên request, header
response và AsyncLocalStorage; context chỉ giữ requestId, không giữ request,
user hoặc token. Nó không phải nhãn metric và không có trong body snapshot.
Bootstrap chưa khai báo exposedHeaders cho x-request-id; UI khác origin cần
kiểm tra cấu hình CORS trước khi dựa vào việc JavaScript đọc được header này.

`runWithRequestId` áp dụng cùng giới hạn cho mã correlation worker. Hai worker
push/relay gọi với undefined nên mỗi lượt thực sự chạy nhận UUID riêng.
Log poll dùng field **requestId** cho mã lượt này; không có field `runId` độc
lập trong API. Không giả định requestId HTTP được lưu và truyền xuyên outbox;
đây chưa phải distributed tracing.

HTTP/SSE, event counters, worker heartbeat, Firebase, memory/CPU và alerts
local thuộc **một process**, reset khi restart/tạo lại instance. `startedAt`
giúp nhận biết reset; uptime là tuổi tiến trình, không nhất thiết bằng tuổi
instance metrics tuyệt đối. Load balancer có thể trả mẫu từ replica khác ở
lần poll kế tiếp. Không tính delta khi đổi process và không cộng lặp DB queue
giữa các replica cùng đọc một DB. Không có kho time series hoặc tổng cluster
được endpoint này cung cấp.

## Nguồn đối chiếu và tài liệu liên quan

- [Controller](../src/infrastructure/observability/observability.controller.ts),
  [metrics/allowlist](../src/infrastructure/observability/observability-metrics.service.ts),
  [dependency cache/query/alerts](../src/infrastructure/observability/observability.service.ts),
  [middleware HTTP/SSE](../src/infrastructure/observability/observability.middleware.ts).
- [Request context](../src/common/http/request-context.ts),
  [request ID middleware](../src/common/http/middleware/request-id.middleware.ts),
  [global transform](../src/common/http/interceptors/transform.interceptor.ts),
  [bootstrap](../src/bootstrap/configure-app.ts).
- [Internal JWT guard](../src/modules/internal-auth/guards/internal-jwt-auth.guard.ts),
  [role guard](../src/modules/internal-auth/guards/internal-roles.guard.ts),
  [session verifier](../src/modules/internal-auth/application/internal-access-verifier.service.ts),
  [Redis throttle](../src/infrastructure/cache/redis-throttler.storage.ts),
  [health](../src/modules/health/health.service.ts).
- [Push hooks](../src/modules/push/application/push-outbox.service.ts),
  [relay hooks](../src/modules/orders/application/notifications/order-notification-relay.service.ts),
  [rematch offered](../src/modules/rematch/application/rematch.service.ts),
  [rematch selected](../src/modules/orders/application/booking/order-booking.service.ts),
  [rematch accepted](../src/modules/orders/application/orders.service.ts),
  [AI hooks/replay](../src/modules/ai-consultation/application/ai-consultation.service.ts).
- [Runbook vận hành](quality-operations-runbook.md),
  [baseline hiệu năng và giới hạn phép đo](quality-performance-baseline.md),
  [bằng chứng bảo mật](quality-security-evidence.md),
  [bằng chứng QA hiện có](quality-verification-2026-10-30.md),
  [bằng chứng runtime dependency](quality-runtime-dependencies-2026-10-31.md),
  [đối chiếu OpenAPI](quality-openapi-compatibility.md).

Các liên kết evidence giữ phạm vi/ngày chạy và giới hạn của chính tài liệu đó.
Lượt viết hợp đồng này chỉ đọc mã và kiểm tra tài liệu/JSON cục bộ, không chạy
Docker, network, regression hay nghiệm thu lại các kết quả được liên kết.
