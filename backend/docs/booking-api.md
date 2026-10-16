# Booking API

Cập nhật: 13/10/2026. API prefix `/api`; mọi route đặt lịch yêu cầu
`Authorization: Bearer <user_access_token>`. Tài khoản nội bộ không dùng token
admin để đặt/nhận đơn thay người dùng. `GET /providers/:id/reviews` công khai;
luồng hỗ trợ hủy dùng `internal-token` với role ADMIN, MODERATOR hoặc SUPPORT.

## 1. Phạm vi và quy tắc

- Khách có thể chọn dịch vụ trước hoặc chọn thợ trước. Cả hai luồng kết thúc
  bằng `providerServiceId` (dịch vụ của thợ), không phải `serviceId` của catalog.
- ASAP: lấy vị trí thợ đang online từ Redis, heartbeat còn hạn, địa chỉ trong
  `serviceRadiusKm` của chính thợ. Không nhận ASAP khi đang di chuyển/làm đơn.
- SCHEDULED: thời điểm bắt đầu từ 60 phút đến 30 ngày tới, kiểm tra tâm khu vực
  phục vụ cố định và bán kính của thợ. Không yêu cầu thợ online lúc gửi/nhận lịch.
- Giờ làm việc dùng `Asia/Ho_Chi_Minh`. Datetime request phải có `Z` hoặc offset
  như `+07:00`; datetime response là UTC. Backend lưu UTC, không cộng 7 giờ vào DB.
- Lịch pending chưa hết hạn, lịch đã nhận và thời gian nghỉ đều chặn đặt trùng.
- Khoảng đệm giữa hai khách = di chuyển ước tính + 10 phút chuẩn bị + 15 phút
  dự phòng. Công thức di chuyển hiện là `ceil(km * 1.5 / 20 * 60)` phút, không
  phải ETA đường bộ/thời gian thực. Khoảng nghỉ không có vị trí nên không thêm
  đệm di chuyển cho chính khoảng nghỉ.
- ASAP ước tính bắt đầu sau 5 phút phản hồi + di chuyển + 10 phút chuẩn bị;
  giữ lịch từ lúc gửi yêu cầu. Nhận đơn sẽ tính lại thời gian đến và kiểm tra lịch.
- Mỗi đơn hiện chỉ chứa một dịch vụ; mỗi hồ sơ thợ chỉ phục vụ một đơn cùng lúc,
  kể cả hồ sơ tổ chức. Chưa có điều phối nhiều nhân viên trong một tổ chức.
- Giá/phí/thời lượng/địa chỉ và hoa hồng được snapshot lúc tạo. Hiện phí di
  chuyển bằng 0, hoa hồng 10% giá dịch vụ; client không gửi tổng tiền/hoa hồng.

## 2. Tìm kiếm và xem giờ trống

`POST /discovery/providers/search` trả HTTP 200:

```json
{
  "serviceId": "catalog-service-uuid",
  "customerAddressId": "owned-address-uuid",
  "bookingType": "SCHEDULED",
  "scheduledAt": "2026-10-14T14:00:00+07:00",
  "radiusKm": 10,
  "limit": 20
}
```

Có thể dùng `latitude`/`longitude` thay địa chỉ trong tìm kiếm. Với ASAP bỏ
`scheduledAt`. `radiusKm` 1-50 (mặc định 10) là bán kính tìm của khách, không
ghi đè bán kính thợ. `limit` 1-50 (mặc định 20).

Kết quả bổ sung `available`, `reason`, `expectedStartAt`, `expectedEndAt`,
`suggestedSlots`, `requiresProviderConfirmation`, `estimateSource`.
Thợ đủ điều kiện được xếp trước, rồi khoảng cách. Có tối đa 300 ứng viên;
`meta.searchLimited=true` nghĩa là danh sách có thể chưa bao phủ hết khu vực.
Khi chọn thợ trước, dùng `GET /providers/:id/public` để lấy `services[].id`.

`GET /providers/:id/availability?providerServiceId=...&customerAddressId=...&date=2026-10-14&limit=20`
trả HTTP 200, `data`:

```json
{
  "date": "2026-10-14",
  "timezone": "Asia/Ho_Chi_Minh",
  "providerServiceId": "provider-service-uuid",
  "durationMinutes": 60,
  "estimateSource": "CONSERVATIVE_DISTANCE",
  "requiresProviderConfirmation": true,
  "reason": null,
  "slots": [{
    "startAt": "2026-10-14T07:00:00.000Z",
    "endAt": "2026-10-14T08:00:00.000Z",
    "availability": "AVAILABLE",
    "requiresProviderConfirmation": true
  }]
}
```

Ngày tính theo Việt Nam; limit 1-48, mặc định 20, mốc bắt đầu cách nhau 15 phút.
`ESTIMATED` đánh dấu gợi ý phụ thuộc đơn chưa hoàn thành. Không trả thông tin
khách khác. Các kết quả này không giữ chỗ và không đảm bảo thợ sẽ nhận đơn.

## 3. Báo giá và tạo đơn

`POST /orders/quote` HTTP 200, body:

```json
{
  "providerServiceId": "provider-service-uuid",
  "customerAddressId": "owned-address-uuid",
  "bookingType": "SCHEDULED",
  "scheduledAt": "2026-10-14T14:00:00+07:00"
}
```

`data` có provider, serviceName, servicePriceAmount, travelFeeAmount,
totalAmount, currencyCode, durationMinutes, distanceKm, bookingType,
scheduledAt, expectedStartAt, expectedEndAt, available, reason,
suggestedSlots, estimateSource và requiresProviderConfirmation.
Lịch bận có thể trả HTTP 200 với `available=false` và gợi ý tối đa 3 giờ
trong 7 ngày tiếp theo. Ngoài bán kính/offline trả 409; dữ liệu sai trả 400/404.

`POST /orders` dùng body trên, thêm `customerNote` tùy chọn (tối đa 500 ký tự).
Báo giá và tạo đơn nhận **đúng một** trong `customerAddressId` (địa chỉ của
chính khách) hoặc `inlineAddress`. Ví dụ địa chỉ nhập riêng cho đơn:

```json
{
  "providerServiceId": "provider-service-uuid",
  "bookingType": "SCHEDULED",
  "scheduledAt": "2026-10-14T14:00:00+07:00",
  "inlineAddress": {
    "label": "Địa chỉ đặt dịch vụ",
    "addressLine": "12 Nguyễn Huệ, Quận 1, TP.HCM",
    "latitude": 10.7731,
    "longitude": 106.703,
    "note": "Tầng 2"
  }
}
```

Khi tạo đơn có thể thêm `contactName` và `contactPhone` vào body; không gửi
hai trường này cho endpoint báo giá. Nếu bỏ trống, hệ thống
lấy từ địa chỉ đã lưu rồi đến tài khoản khách. `inlineAddress` không được lưu
vào sổ địa chỉ. Đơn phải có tên người nhận. Dữ liệu người nhận và địa chỉ được
snapshot trong đơn.
Bắt buộc header:

```http
Idempotency-Key: 63a8b5d8-5798-4f51-9eb4-e29f2be82784
```

Header dài 8-128 ký tự chữ/số/_/-. Tạo mới trả 201 và snapshot đơn
`PENDING_PROVIDER`, `providerResponseDeadlineAt`, thời gian dự kiến và lịch sử.
Retry cùng key và payload trả 201 với cùng đơn (trạng thái mới nhất), không
gia hạn thời gian giữ. Cùng key khác nội dung trả 409 `IDEMPOTENCY_KEY_REUSED`.
Mỗi lần khách chủ động đặt mới dùng key mới. Giữ key cũ khi mất mạng/timeout.

ASAP chờ phản hồi 5 phút; SCHEDULED tối đa 30 phút và không vượt mốc 15 phút
trước lịch. Tối đa 3 pending chưa hết hạn mỗi khách. Trong lúc pending chỉ giữ
lịch, chưa giữ tiền ví. Client không được gửi price/commission/status/userId.

Lỗi tranh chấp lịch thường là HTTP 409:

```json
{
  "code": "PROVIDER_TIME_CONFLICT",
  "message": "Thợ chưa thể nhận đơn vào thời gian này. Vui lòng chọn giờ khác.",
  "suggestedSlots": []
}
```

Các mã khác: `PROVIDER_OFFLINE`, `OUTSIDE_PROVIDER_RADIUS`,
`SERVICE_AREA_NOT_CONFIGURED`, `OUTSIDE_WORKING_HOURS`, `PROVIDER_BUSY`,
`PROVIDER_NOT_ACCEPTING_ORDERS`, `TOO_MANY_PENDING_ORDERS`.
Không phải mọi lỗi 409 đều có code/gợi ý; frontend luôn có fallback từ message.
Sau 409 tải lại báo giá/lịch trống, không tự chuyển giờ đặt nếu khách chưa chọn.

## 4. Vòng đời đơn và ví

| Method / route | Body / quy tắc |
| --- | --- |
| GET /me/orders[?status=...] | Tối đa 50 đơn của khách |
| GET /me/orders/:id | Chi tiết đơn của khách |
| POST /me/orders/:id/cancel | `{ "reason": "Thay đổi kế hoạch" }`, HTTP 200 |
| GET /me/provider/orders[?status=...] | Tối đa 50 đơn gửi tới thợ |
| GET /me/provider/orders/:id | Chi tiết, ẩn địa chỉ khi chưa nhận |
| POST /me/provider/orders/:id/accept | Không body, giữ hoa hồng và xác nhận lịch |
| POST /me/provider/orders/:id/reject | reason 3-500 ký tự, chỉ khi pending |
| POST /me/provider/orders/:id/cancel | reason 3-500 ký tự, pending/accepted |
| POST /me/provider/orders/:id/en-route | Online, GPS mới; sớm nhất 60 phút trước giờ dự kiến, không đang làm đơn khác |
| POST /me/provider/orders/:id/arrive | Chỉ từ EN_ROUTE, đã có ảnh ARRIVAL |
| POST /me/provider/orders/:id/start | Chỉ từ ARRIVED, đã có ảnh BEFORE_WORK; lịch hẹn không bắt đầu sớm quá 5 phút |
| POST /me/provider/orders/:id/complete | `{ "cashReceived": true }`, chỉ từ IN_PROGRESS, đã có ảnh AFTER_WORK |

Các action của thợ trả 200. Hủy chỉ cho phép trước EN_ROUTE. Chuyển trạng thái
lặp/sai trả 409. Accept kiểm tra lại lịch, ví khả dụng, trạng thái và điều kiện
dịch vụ trong transaction; snapshot địa chỉ vẫn dùng được sau khi xóa địa chỉ
khỏi sổ địa chỉ. Không tự đổi giá/thời lượng nếu dịch vụ đã được chỉnh sửa.

Giữ tiền: `available = balance - held`; accept tạo HOLD, cancel giải phóng HOLD,
complete chuyển HOLD thành COMMISSION và trừ balance đúng một lần. Khách không
cần xác nhận hoàn thành. Không gọi complete nếu chưa thu đủ tiền mặt.

## 4A. Bằng chứng, sự cố, thông báo và đánh giá

- `POST /me/provider/orders/:id/evidence/:type`: multipart `file`, type là
  `ARRIVAL`, `BEFORE_WORK`, `AFTER_WORK` hoặc `INCIDENT`; ảnh tối đa 5 MB, JPEG,
  PNG, WEBP hoặc GIF. Query `latitude` và `longitude` phải đi cùng nhau; ảnh
  `ARRIVAL` bắt buộc có tọa độ báo cáo từ thiết bị. Mỗi loại tối đa một ảnh/đơn.
  Tọa độ ảnh đến nơi phải trong 1 km từ địa chỉ đã chốt trong đơn.
  Tải ảnh ở trạng thái tương ứng trước khi gọi `arrive`, `start`, `complete`.
- `GET /orders/:id/evidence/:evidenceId`: khách hoặc thợ trong đơn lấy signed URL
  ngắn hạn để xem ảnh. Ảnh Cloudinary lưu riêng tư; response đơn chỉ có metadata
  ảnh, không có `publicId` hoặc URL gốc. Tọa độ thiết bị hiện chưa được xác minh
  độc lập và API không thể buộc client phải chụp mới thay vì chọn ảnh sẵn.
- `POST /me/provider/orders/:id/contact-attempt`: ghi nhận thao tác bấm gọi khi
  đã ARRIVED, tối đa 5 lần, cách tối thiểu 30 giây. Đây không phải xác nhận cuộc
  gọi kết nối. Lý do hủy `CUSTOMER_UNREACHABLE` cần ít nhất hai lần ghi nhận
  cách nhau 5 phút.
- `POST /me/provider/orders/:id/cancellation-request`: body `{ "reason":
  "TRANSPORT_ISSUE", "detail": "..." }`. Các reason khác:
  `CUSTOMER_UNREACHABLE`, `LOCATION_INACCESSIBLE`, `UNSAFE_CONDITIONS`, `OTHER`.
  Chỉ áp dụng sau khởi hành. Ngoại trừ `CUSTOMER_UNREACHABLE`, cần ảnh `INCIDENT`.
  Đơn tạm giữ trạng thái và lịch; không tiếp tục `arrive/start/complete` khi chờ.
- `POST /me/orders/:id/cancellation/decision`: body `{ "approve": true,
  "note": "..." }`. Khách đồng ý sẽ hủy đơn, giải phóng lịch/HOLD; khách không đồng
  ý (`false`) chuyển `SUPPORT_REVIEW`. Sau 30 phút khách chưa phản hồi, tác vụ
  bảo trì cũng chuyển sang hỗ trợ và ghi thông báo cho hai bên.
- Nội bộ: `GET /admin/orders/cancellation-requests`, `GET
  /admin/orders/cancellation-requests/:id`, `GET
  /admin/orders/cancellation-requests/:id/evidence/:evidenceId`, `POST
  /admin/orders/cancellation-requests/:id/decision` với body như khách. Hỗ trợ
  đồng ý sẽ hủy; từ chối sẽ giữ đơn và cho thợ tiếp tục xử lý.
- `GET /me/notifications`: 50 thông báo đơn gần nhất, gồm `id`, `orderId`,
  `event`, `readAt`, `createdAt`. `PATCH /me/notifications/:id/read` đánh dấu đã
  đọc. Hiện là hộp thư lưu ở PostgreSQL để client polling; chưa có push/SSE.
- `POST /me/orders/:id/review`: sau `COMPLETED`, body `{ "rating": 5,
  "comment": "..." }`. Chỉ khách của đơn đánh giá một lần, điểm 1-5. `GET
  /providers/:id/reviews` công khai điểm trung bình, số lượt và 20 đánh giá mới.

Hết hạn pending được giải phóng ngay khi có thao tác giữ/nhận lịch mới cùng thợ,
và cron dọn theo batch tối đa 500 đơn mỗi phút với `FOR UPDATE SKIP LOCKED`.
Một đơn đang làm quá giờ không tự coi là xong: khi tính lịch tiếp tục chặn
ít nhất 30 phút từ hiện tại và đánh dấu ước tính. Không tự dời lịch đã nhận.

## 5. Lịch riêng của thợ

- `GET /me/provider/calendar?from=<ISO>&to=<ISO>`: tối đa 31 ngày, 500 bản ghi.
  Trả id, orderId, startAt, endAt, holdExpiresAt, reason và thông tin đơn gọn.
  `orderId=null` là khoảng nghỉ; `holdExpiresAt` khác null là giữ chỗ tạm.
- `POST /me/provider/calendar/time-off`: body `{ "from": "...+07:00",
  "to": "...+07:00", "reason": "Nghỉ chiều" }`. Nghỉ ít nhất 15 phút,
  trong 31 ngày tới, tối đa 200 khoảng nghỉ sắp tới. Không chồng đơn/lịch nghỉ.
- `DELETE /me/provider/calendar/time-off/:id`: chỉ chủ sở hữu, không được xóa
  calendar block của đơn. Xóa khoảng nghỉ lặp lại vẫn trả 200.

## 6. Tính đúng đắn và hiệu năng

- PostgreSQL là nguồn quyết định lịch/ví. Exclusion constraint GiST trên
  providerId và `tsrange(startAt,endAt,'[)')` ngăn trùng khoảng active ngay cả
  khi writer không đi qua service. Khoảng đệm di chuyển được kiểm tra ở application.
- Tạo đơn khóa advisory theo khách, sau đó khóa provider, order, wallet. Các
  command cùng provider dùng chung thứ tự khóa; tiền và lịch cập nhật nguyên tử.
- Khóa theo từng provider/khách, không dùng một khóa toàn hệ thống. Redis không
  phải nguồn duy nhất để chống double booking. Không gọi Cloudinary/SMS/payment
  gateway trong transaction đặt lịch; ASAP chỉ đọc Redis vị trí trước tính toán.
- Discovery đọc hồ sơ/lịch theo batch, không query từng thợ. SCHEDULED lọc thô
  bằng bounding box + point GiST rồi đo khoảng cách cầu; ASAP dùng Redis GEO.
- Gợi ý lịch tính đệm một lần, sort và gộp các khoảng bận rồi quét khoảng trống:
  `O(B log B + G)` với B số khoảng bận, G số mốc 15 phút trong cửa sổ giới hạn.
- Chưa dùng PostGIS, geohash tự viết, bitmap cache lịch hoặc routing API. Trước
  khi vận hành lớn cần đo tải dài hạn, p95/p99, pool/lock wait, CPU Redis/DB,
  mức đầy đủ của candidate cap và tỉ lệ 409 trên dữ liệu thực.

## 7. Migration và kiểm thử

Migration `20261012120000_booking_calendar` bảo toàn snapshot đơn cũ, tạo bảng
lịch và constraint. Nếu đơn cũ đã chồng thời gian, migration cố ý thất bại;
phải kiểm tra dữ liệu, không tự hủy đơn/xóa dữ liệu để vượt constraint.
Migration `20261012123000_booking_pending_index` bổ sung index kiểm tra pending.

```powershell
npm run check
# Chạy trong terminal chỉ dành cho test; không trỏ vào DB ứng dụng:
$env:TEST_DATABASE_URL = 'postgresql://<user>:<password>@localhost:5433/lambe_booking_test_local?schema=public&connection_limit=50'
$env:DATABASE_URL = $env:TEST_DATABASE_URL
$env:REDIS_ENABLED = 'false'
$env:MAIL_ENABLED = 'false'
npx prisma migrate deploy
npm run test:e2e -- --runInBand
npm run test:booking
```

Test integration từ chối DB không có tiền tố `lambe_booking_test_`. Dữ liệu
fixture chỉ nằm trong DB đó; không chạy bộ này vào DB dùng chung. Test dùng
PostgreSQL thật, JWT/validation/controller thật, mock nguồn GPS. Kiểm thử
40 khách tranh cùng slot và 12 lần retry chỉ chứng minh tính nguyên tử của
các tình huống đó, không phải benchmark công suất production.

Chưa triển khai trong đợt này: đổi lịch/đổi thợ, nhiều dịch vụ một đơn, push
nhắc lịch, tự điều phối khi thợ trễ, tranh chấp thanh toán, tracking hành trình,
phí hủy và điều phối nhiều nhân viên của tổ chức.

## 8. Xác minh triển khai ngày 12/10/2026

- Typecheck source/test, lint, Prisma validate và build đã qua.
- 80 unit-test suites / 510 test; 25 HTTP E2E; 13 booking integration test đã qua.
- 40 khách đặt cùng slot: 1 thành công, 39 conflict; khoảng 1,2 giây cho cả
  batch trên môi trường local lần chạy đó. Không suy rộng thành SLA production.
- Đã cập nhật fixture E2E hồ sơ thợ cho email liên hệ và ảnh chân dung public
  candidate theo API hiện có; không đổi nghiệp vụ đăng ký trong đợt đặt lịch này.
- Hai migration đặt lịch đã áp dụng vào Docker DB, không xóa dữ liệu/volume.
- Đã vá dependency `proxy-addr` từ 2.0.7 lên 2.0.8. Audit còn cảnh báo ở các
  dependency khác (ví dụ multer, js-yaml, uuid và chuỗi Prisma tooling); cần
  đợt rà soát dependency riêng, không dùng `npm audit fix --force` tùy tiện.

Kiểm tra lại ngày 13/10/2026: typecheck/lint, 510 unit test, 25 E2E và 13
booking integration test đều qua. Swagger khai báo duy nhất một header
`idempotency-key` cho tạo đơn (tên header HTTP không phân biệt hoa/thường).
Batch 40 yêu cầu tranh cùng slot hoàn tất khoảng 1,21 giây trên máy local.

Nâng cấp vòng đời đơn ngày 13/10/2026: Prisma validate, 511 unit test, 25 E2E
và 19 booking integration test đã qua trên database thử nghiệm riêng. Đã kiểm
tra địa chỉ nhập riêng, quyền xem ảnh, ảnh bắt buộc theo trạng thái, hai lần
thử liên hệ, khách/hỗ trợ duyệt hủy, giải phóng HOLD và đánh giá một lần.

## 9. Hợp đồng tích hợp mobile

Tài liệu màn hình, dữ liệu nhập/xuất, quyền hiển thị action và tiêu chí nghiệm
thu chi tiết nằm tại [Tài liệu UI](../../tailieuUI.md), mục `A.8B.8` đến
`A.8B.22`. Các nguyên tắc bắt buộc khi tích hợp:

- Client unwrap envelope `{ statusCode, success, message?, data, meta?,
  timestamp }`; trạng thái đơn trong `data` là nguồn quyết định giao diện.
- Quote, discovery và availability chỉ là thông tin tại thời điểm đọc, không
  giữ lịch. Chỉ `POST /orders` trả 201 mới tạo yêu cầu và giữ lịch tạm.
- Mobile tạo `Idempotency-Key` cho mỗi ý định đặt mới. Timeout tạo đơn phải retry
  cùng key và payload; thay địa chỉ, thợ, dịch vụ hoặc thời gian phải dùng key mới.
- Không cập nhật lạc quan cho accept, chuyển trạng thái, hủy hoặc complete. Khi
  timeout các action này, tải lại order trước khi quyết định cho phép thử lại.
- Địa chỉ/số điện thoại của khách là nullable ở phía thợ trước khi accept và sau
  các trạng thái kết thúc không được phép xem. Client không được giữ cache nhạy
  cảm để tiếp tục hiển thị khi response mới đã trả `null`.
- Trình tự evidence và action là upload `ARRIVAL` rồi arrive, upload
  `BEFORE_WORK` rồi start, upload `AFTER_WORK` rồi complete. Upload thành công
  nhưng action lỗi thì dùng lại evidence đã có, không upload trùng.
- Signed URL của ảnh bằng chứng chỉ dùng tạm thời. Client lưu `evidenceId`, gọi
  lại endpoint cấp URL khi cần xem hoặc URL hết hạn.
- Khi cancellation request ở `PENDING_CUSTOMER` hoặc `SUPPORT_REVIEW`, khóa các
  action tiếp tục công việc. Không dựng luồng hủy trực tiếp sau `EN_ROUTE`.
- Inbox notification hiện dùng polling PostgreSQL. Tải khi app mở/resume và khi
  đang xem order; chưa phụ thuộc vào FCM, WebSocket hoặc SSE.
- Datetime request phải có timezone; response UTC phải được chuyển ở presentation
  layer. Không cộng thủ công 7 giờ vào dữ liệu lưu hoặc domain model.
