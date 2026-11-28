# Booking API

> Cập nhật P5C 28/10/2026: tổ chức đặt theo worker cụ thể bằng `memberId`.
> Discovery có nhiều thẻ cùng `providerId`; quote/create và rematch ràng buộc
> cặp tổ chức/người thực hiện. Xem [contract đầy đủ](organization-booking-api.md)
> để phân biệt với đơn cá nhân và đơn legacy chưa phân công.

Cập nhật: 13/10/2026. API prefix `/api`; mọi route đặt lịch yêu cầu
`Authorization: Bearer <user_access_token>`. Tài khoản nội bộ không dùng token
admin để đặt/nhận đơn thay người dùng. `GET /providers/:id/reviews` công khai;
luồng hỗ trợ hủy dùng `internal-token` với role ADMIN, MODERATOR hoặc SUPPORT.

## P6 — Rematch, khôi phục và tích hợp frontend (31/10/2026)

P6 bổ sung quan sát vận hành; API, mã lỗi, quote và bước khách xác nhận retry
giữ nguyên. P5 tiếp tục tạm ngưng phát triển.

- Quote mới vẫn quyết định giá/phí trước khi gửi; discovery/availability và
  `nextAction=REMATCH` không giữ lịch hoặc tự tạo đơn. Khách chọn thợ, xem và
  xác nhận quote mới rồi retry; 201 vẫn là `PENDING_PROVIDER`, chỉ `ACCEPTED`
  mới xác nhận thợ nhận đơn. Timeout giữ nguyên Idempotency-Key/payload.
- `events.rematch.offered` tăng **một lần mỗi response** candidates có ít nhất
  một ứng viên `available=true`, không tính từng card/khách duy nhất hoặc chứng
  minh UI đã render. Đọc lại cùng danh sách khả dụng có thể tăng thêm.
- `events.rematch.selected` tăng sau commit tạo **đơn retry mới**; replay cùng
  Idempotency-Key trả đơn đã có không tăng. `events.rematch.accepted` chỉ tăng
  sau commit nhận đơn có `bookingAttempt > 1`, không phải nhận mọi đơn hoặc
  hoàn thành dịch vụ. Counters thuộc một tiến trình, reset khi restart, không
  thay thế trạng thái đơn hay tỷ lệ chuyển đổi toàn hệ thống.
- Redis tự reconnect nhưng không queue command nghiệp vụ offline. Khi Redis
  throttling đang bật bị hỏng, request vẫn có thể bị chặn 503; không biến lỗi
  dependency thành danh sách thợ rỗng. Nếu GEO mất sau restart, app thợ phải
  gửi heartbeat/GPS mới; backend không khôi phục online bằng tọa độ cache cũ.
  Địa chỉ snapshot của đơn nguồn phục vụ rematch không phải GPS hiện tại của thợ.
- Frontend giữ draft và trạng thái chờ/lỗi, backoff rồi đọc lại đơn khi được
  phép; 409 xử lý bằng tải lại trạng thái/quote theo contract hiện có. Đơn và
  notification đã commit ở PostgreSQL vẫn bền vững; SSE/FCM là tín hiệu để đọc
  lại, không là bằng chứng thao tác tiếp theo đã thành công.

Xem [Observability API](observability-api.md), [runbook P6](quality-operations-runbook.md)
và [bằng chứng kiểm chứng P6](quality-verification-2026-10-30.md). Các kết quả
kiểm thử/hiệu năng có ngày bên dưới là lịch sử theo lần chạy, không phải SLA.

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
- Giá/phí/thời lượng/địa chỉ và hoa hồng được snapshot lúc tạo. Phí di chuyển
  được tính theo bậc khoảng cách; hoa hồng 10% giá dịch vụ sau voucher của thợ,
  không tính trên phí di chuyển. Client không gửi tổng tiền/hoa hồng. Xem
  [pricing-vouchers-api.md](pricing-vouchers-api.md) cho biểu phí và voucher.

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
`suggestedSlots`, `requiresProviderConfirmation`, `estimateSource`,
`distanceKm` (đường chim bay), `estimatedTravelDistanceKm` và
`estimatedTravelFeeAmount` (ước tính phí theo cùng quy tắc với báo giá).
Giá trị ở danh sách có thể thay đổi khi thợ di chuyển; dùng `/orders/quote`
để hiển thị số tiền chính thức ngay trước khi gửi yêu cầu.
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
travelDistanceKm, distanceSource, quoteToken, subtotalAmount, discountAmount,
voucherCode, voucherIssuer, totalAmount, currencyCode, durationMinutes,
distanceKm, bookingType,
scheduledAt, expectedStartAt, expectedEndAt, available, reason,
suggestedSlots, estimateSource và requiresProviderConfirmation.
Lịch bận có thể trả HTTP 200 với `available=false` và gợi ý tối đa 3 giờ
trong 7 ngày tiếp theo. Ngoài bán kính/offline trả 409; dữ liệu sai trả 400/404.
`quoteToken` chỉ có khi `available=true`, có hiệu lực 5 phút. Khoảng cách tính
phí lấy từ OSRM (`distanceSource=OSRM`) hoặc hệ số dự phòng khi OSRM không khả
dụng (`CONSERVATIVE_DISTANCE`). Đây là khoảng cách tính tiền; `distanceKm` là
khoảng cách đường chim bay dùng kiểm tra bán kính thợ.

`POST /orders` dùng body trên, bắt buộc thêm `quoteToken` từ báo giá và có thể
thêm `customerNote` (tối đa 500 ký tự). Server xác thực token, người dùng, nội
dung địa chỉ/giờ/dịch vụ/voucher và giá; nếu báo giá hết hạn, giá đổi hoặc thợ
di chuyển quá 500m thì trả 409 (`QUOTE_EXPIRED`, `QUOTE_CHANGED` hoặc
`QUOTE_MISMATCH`). Client phải tải lại quote để khách xem tổng tiền mới.
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
Ứng dụng phải hiển thị đang chờ thợ phản hồi, chỉ báo đặt lịch thành công sau
khi đơn chuyển `ACCEPTED`. Với `REJECTED` hoặc `EXPIRED`, cho khách chọn thợ
khác và giữ lại địa chỉ, dịch vụ, thời gian đã nhập.
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
| GET /me/orders[?status=...&limit=...&cursor=...] | Danh sách đơn khách, 1-50 đơn/trang; mặc định 50; `meta.nextCursor` để tải tiếp |
| GET /me/orders/:id | Chi tiết đơn của khách |
| POST /me/orders/:id/cancel | `{ "reason": "Thay đổi kế hoạch" }`, HTTP 200 |
| GET /me/provider/orders[?status=...&limit=...&cursor=...] | Danh sách đơn thợ, 1-50 đơn/trang; mặc định 50; `meta.nextCursor` để tải tiếp |
| GET /me/provider/orders/upcoming | Năm đơn `ACCEPTED` chờ khởi hành, theo `expectedStartAt` tăng dần; dùng cho trang chủ, gồm đơn đã đến giờ nhưng chưa khởi hành |
| GET /me/provider/orders/:id | Chi tiết, ẩn địa chỉ khi chưa nhận |
| POST /me/provider/orders/:id/accept | Không body, giữ hoa hồng và xác nhận lịch |
| POST /me/provider/orders/:id/reject | reason 3-500 ký tự, chỉ khi pending |
| POST /me/provider/orders/:id/cancel | reason 3-500 ký tự, pending/accepted |
| POST /me/provider/orders/:id/en-route | Online, GPS mới; sớm nhất 60 phút trước giờ dự kiến, không đang làm đơn khác |
| POST /me/provider/orders/:id/arrive | Chỉ từ EN_ROUTE; body GPS `latitude`, `longitude`, `accuracyMeters`, `capturedAt` |
| POST /me/provider/orders/:id/start | Chỉ từ ARRIVED, đã có ảnh BEFORE_WORK; lịch hẹn không bắt đầu sớm quá 5 phút |
| POST /me/provider/orders/:id/complete | `{ "cashReceived": true }`, chỉ từ IN_PROGRESS, đã có ảnh AFTER_WORK |
| POST /me/provider/orders/:id/payment-dispute | `{ "reason": "Khách chưa thanh toán đủ..." }`, 10-500 ký tự; IN_PROGRESS và đã có AFTER_WORK |

Các action của thợ trả 200. Hủy chỉ cho phép trước EN_ROUTE. Chuyển trạng thái
lặp/sai trả 409. Accept kiểm tra lại lịch, ví khả dụng, trạng thái và điều kiện
dịch vụ trong transaction; snapshot địa chỉ vẫn dùng được sau khi xóa địa chỉ
khỏi sổ địa chỉ. Không tự đổi giá/thời lượng nếu dịch vụ đã được chỉnh sửa.

Với đơn `SCHEDULED`, phản hồi đơn có `departureAvailableAt` (giờ hẹn trừ
60 phút); `ASAP` trả `null`. Mobile hiển thị chi tiết lịch hẹn khi đơn đặt trước
ở `ACCEPTED`, khóa nút khởi hành đến mốc API trả về và chỉ mở bản đồ hành trình
sau khi thợ chuyển đơn sang `EN_ROUTE`. Xác nhận nhận lịch không tự khởi hành.
Khởi hành chỉ được phép từ `departureAvailableAt` đến trước `scheduledAt`.
Từ giờ hẹn trở đi, API trả `409 APPOINTMENT_PASSED` và mobile khóa nút,
yêu cầu hai bên đồng ý giờ mới trước khi khởi hành. Kiểm tra nằm trong
transaction khóa đơn; không đổi trạng thái, giữ tiền hay thông báo khi bị chặn.
Mốc cảnh báo vận hành `scheduleOverdueAt` sau 15 phút không phải thời gian
gia hạn khởi hành. Đơn `ASAP` giữ nguyên khả năng khởi hành ngay.
API đơn sắp tới trả `travelDistanceKm` của đơn tại lúc đặt để hiển thị quãng
đường di chuyển; đây không phải khoảng cách GPS được cập nhật theo thời gian thực.

Giữ tiền: `available = balance - held`; accept tạo HOLD, cancel giải phóng HOLD,
complete chuyển HOLD thành COMMISSION và trừ balance đúng một lần. Khách không
cần xác nhận hoàn thành. Không gọi complete nếu chưa thu đủ tiền mặt.

Nếu chưa thu đủ tiền, thợ mở `PAYMENT_DISPUTE`: lịch được giải phóng nhưng
HOLD hoa hồng vẫn ACTIVE và khách nhận thông báo. Khách không thể đánh giá cho
tới khi đơn thực sự `COMPLETED`. Nội bộ dùng `GET
/admin/orders/payment-disputes` để xem đơn đang chờ và `POST
/admin/orders/payment-disputes/:id/decision` với body
`{ "decision": "CONFIRM_UNPAID", "note": "..." }` hoặc `CONFIRM_PAID`.
`CONFIRM_UNPAID` chuyển `DISPUTED` và tiếp tục giữ tiền cho thu hồi/xử lý thủ
công. Dùng `GET /admin/orders/payment-disputes?status=DISPUTED` để theo dõi
những đơn đã xác nhận chưa thanh toán (mặc định danh sách là `PAYMENT_DISPUTE`).
Sau khi đã xác minh thanh toán, `CONFIRM_PAID` cho phép chuyển từ cả
`PAYMENT_DISPUTE` hoặc `DISPUTED` sang `COMPLETED`, khấu trừ hoa hồng một lần.
Không có API tự động hoàn khoản đang giữ trong tranh chấp. Các thao tác chỉ
dành cho ADMIN, SUPPORT hoặc MODERATOR; ghi chú quyết định chỉ có trong chi
tiết nội bộ và audit, không trả về chi tiết đơn cho khách/thợ.

### Projection khoản giữ cho đối tác — cập nhật 02/11/2026

`GET /me/provider/orders`, `GET /me/provider/orders/:id` và response action dùng
`presentForProvider` có thêm `commissionHold`:

```json
{ "commissionHold": { "amount": 30000, "status": "ACTIVE" } }
```

Trường này là `null` nếu chưa có hold. `amount` lấy từ `walletHold.amount`
thực tế của đơn, không suy ra từ totalAmount, tỷ lệ hoặc tổng heldAmount của ví.
`status` có thể là `ACTIVE`, `CAPTURED`, `RELEASED`. Chỉ `ACTIVE` nghĩa là đang
giữ; `CAPTURED` là đã khấu trừ. Không trả holdId, walletId, số dư ví hoặc ghi
chú quyết định nội bộ. Projection khách không có `commissionHold`.

Metadata chung cho hai phía: `paymentDisputeReason`, `paymentDisputeOpenedAt`,
`paymentDisputeDecidedAt` cùng status/totalAmount/currencyCode của đơn.
Reason là khai báo của thợ, không phải kết luận bên nào có lỗi. Không có API
khách/thợ tự xác nhận kết quả đối soát, hoàn khoản giữ hoặc tự đổi sang COMPLETED.

Mobile kiểm tra lại chi tiết trước khi mở tranh chấp. POST lỗi/mất phản hồi
được đối soát bằng GET, không tự replay. Kết quả chưa rõ khóa thao tác tiến
trình và yêu cầu tải lại; backend vẫn là nơi kiểm tra quyền/trạng thái/transaction.
PAYMENT_DISPUTE/DISPUTED tiếp tục polling đơn hiện có, không được đánh giá.
Sau CONFIRM_PAID, khách mới có thể đánh giá nếu chưa có review.

## 4A. Bằng chứng, sự cố, thông báo và đánh giá

- `POST /me/provider/orders/:id/evidence/:type`: multipart `file`, type là
  `ARRIVAL`, `BEFORE_WORK`, `AFTER_WORK` hoặc `INCIDENT`; ảnh tối đa 5 MB, JPEG,
  PNG, WEBP hoặc GIF. Query `latitude` và `longitude` phải đi cùng nhau; ảnh
  `ARRIVAL` bắt buộc có tọa độ báo cáo từ thiết bị. Mỗi loại tối đa một ảnh/đơn.
  Tọa độ ảnh đến nơi phải trong 1 km từ địa chỉ đã chốt trong đơn.
  Ảnh `ARRIVAL` là tùy chọn. Ảnh `BEFORE_WORK` và `AFTER_WORK` vẫn bắt buộc trước `start` và `complete`.
- `arrive` kiểm tra GPS trong 30 giây gần nhất, độ chính xác tối đa 100 m và
  cách tọa độ địa chỉ đã chốt không quá 300 m. Kết quả đo được lưu cùng đơn.
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
- `GET /me/notifications`: mặc định trả 50 thông báo đơn gần nhất; có thể dùng
  `?limit=1..50&cursor=<id thông báo cuối của trang trước>` để lấy trang tiếp.
  Dữ liệu gồm `id`, `orderId`, `event`, `recipientRole` (`CUSTOMER` hoặc
  `PROVIDER`), `readAt`, `createdAt`; `meta.nextCursor` là `null` khi hết trang.
  Vai trò nhận thông báo được tính từ chủ đơn, không dựa vào vai trò đang mở
  trên app. `PATCH /me/notifications/:id/read` đánh dấu đã đọc. Khi khách xử
  lý yêu cầu hủy, thông báo `CANCELLATION_REQUESTED` tương ứng cũng được đánh
  dấu đã đọc trong cùng giao dịch. Hiện là hộp thư lưu ở PostgreSQL để client
  polling. FCM đã được tích hợp; xem `push-notifications.md` về phạm vi và
  giới hạn kiểm chứng trên thiết bị thật.
- `GET /me/notifications/events?after=<id>`: SSE có Bearer token, phát từng
  thông báo của chính tài khoản; `id` và `data` chứa `orderId`, `event`,
  `recipientRole`, `createdAt`. Kết nối tự đóng sau 30 giây để xác thực lại;
  client mở lại với `after` là ID cuối đã nhận. PostgreSQL lưu bản ghi cùng
  giao dịch đơn, Redis phát tín hiệu sau commit; khi Redis lỗi, SSE đọc lại DB
  mỗi 10 giây. FCM nhắc mở app khi chạy nền; nội dung chính thức vẫn đọc từ DB.
- `POST /me/orders/:id/reschedule`: khách đề xuất giờ mới bằng
  `{ "scheduledAt": "2026-10-25T14:00:00+07:00" }` cho đơn `SCHEDULED`
  đã `ACCEPTED` và chưa khởi hành. Giờ đề xuất giữ tối đa 30 phút, không làm
  mất lịch cũ. Thợ cũng có thể đề xuất qua `POST /me/provider/orders/:id/reschedule`;
  khách phản hồi qua `POST /me/orders/:id/reschedule/decision`.
  `POST /me/provider/orders/:id/reschedule/decision` nhận
  `{ "requestId": "<rescheduleRequest.id>", "approve": true|false }`. Client mới
  luôn truyền `requestId` UUID v4 để không duyệt nhầm yêu cầu mới khi màn cũ chưa
  cập nhật; không khớp yêu cầu PENDING còn hạn trả 409. Trường này optional để
  giữ tương thích client cũ; body chỉ `approve` vẫn được nhận. Chấp nhận chỉ thành công nếu giờ mới còn hợp
  lệ/trống; thay giờ đơn và block lịch cùng giao dịch. Đơn chi tiết trả
  `rescheduleRequest` gần nhất để hai bên hiển thị trạng thái.
  `requestedByRole` xác định `CUSTOMER`/`PROVIDER`; chỉ bên còn lại được duyệt.
  Mỗi đơn có tối đa một đề xuất đang chờ, giữ cả lịch cũ và khung giờ đề xuất
  cho đến khi phản hồi hoặc hết hạn. Không thay giá hoặc khoản hoa hồng giữ.

  Mobile dùng giờ Việt Nam UTC+07:00 để chọn/hiển thị, gửi ISO UTC `Z`. Khoảng
  đặt mới hợp lệ là từ 60 phút đến 30 ngày kể từ lúc gửi; không chọn trùng giờ
  hiện tại. Hạn đề xuất là min(30 phút sau tạo, 15 phút trước giờ đề xuất).
  Backend quét mỗi phút để chuyển yêu cầu quá hạn sang `EXPIRED` và thông báo
  hai bên; lịch cũ vẫn giữ nguyên. Đơn rời `ACCEPTED` làm yêu cầu đang chờ
  chuyển `CANCELLED`. Phân biệt rõ `REJECTED` với `EXPIRED` trên mobile.
  Timeout/5xx phải GET chi tiết đơn theo vai trò để đối soát; không tự lặp POST.
  Mất mạng khi đối soát khóa riêng thao tác đổi lịch cho tới khi tải lại thành
  công. GET không thay thế kiểm tra lịch/transaction/authorization ở backend.

  `scheduleOverdueAt` là mốc API dùng để hiện cảnh báo lịch hẹn `SCHEDULED`:
  `ACCEPTED` trễ 15 phút so với giờ phục vụ, `EN_ROUTE` trễ 30 phút,
  `ARRIVED` chờ 30 phút từ lúc đến. Trạng thái khác/ASAP trả `null`.
  Quá giờ không tự hủy đơn, giải phóng tiền hoặc tính phí. Hai bên liên hệ,
  thống nhất giờ mới khi chưa khởi hành, hoặc dùng chức năng hủy/hỗ trợ sẵn có.
  Lịch mới được đồng ý sẽ đóng cảnh báo cũ và vẫn được theo dõi nếu lại bị trễ.
- `POST /me/orders/:id/review`: sau `COMPLETED`, body `{ "rating": 5,
  "comment": "..." }`. Chỉ khách của đơn đánh giá một lần, điểm 1-5. `GET
  /providers/:id/reviews` công khai điểm trung bình, số lượt và trang đánh
  giá (mặc định 20, limit 1–50, cursor). Review tự gắn provider/member/version
  và tên/ảnh từ snapshot đơn; không nhận phân công từ body. Một review đóng
  góp cho điểm đối tác và đúng worker, không nhập hai lần. `GET
  /providers/:providerId/members/:memberId/reviews` chỉ đọc điểm/review member
  trong tổ chức này. Đơn legacy giữ assignedMember=null. Chưa có review thì
  averageRating=null/count=0, không mặc định 5 sao. Chi tiết và hướng dẫn
  xử lý retry: [Review P5E.2](organization-member-reviews-api.md).

SOS là luồng riêng với yêu cầu hủy thông thường:

- Khách gọi `POST /me/orders/:id/safety/sos`; thợ gọi `POST
  /me/provider/orders/:id/safety/sos`. Body tùy chọn gồm `reason` và `detail`;
  ảnh không bắt buộc. Chỉ hợp lệ ở `ACCEPTED`, `EN_ROUTE`, `ARRIVED`,
  `IN_PROGRESS`.
- Backend chuyển đơn sang `SAFETY_HOLD`, giữ calendar block và wallet HOLD,
  khóa mọi tiến trình/hủy/hoàn thành và chặn thợ nhận đơn khác.
- Hai bên đọc hồ sơ riêng bằng `GET /me/orders/:id/safety` hoặc `GET
  /me/provider/orders/:id/safety`. Mỗi bên chỉ thấy báo cáo và ảnh của mình.
- Ảnh SOS dùng route `/safety/evidence`, tối đa năm ảnh mỗi bên; không dùng
  evidence type `INCIDENT` của luồng hủy thông thường.
- Chỉ `ADMIN`/`SUPPORT` xử lý tại `/admin/safety/incidents`. Khi đóng hồ sơ,
  backend hủy đơn và giải phóng lịch, HOLD, voucher trong cùng transaction.

Contract đầy đủ, mã lỗi và giới hạn production: [Order Safety API](order-safety-api.md).

Hết hạn pending được giải phóng ngay khi có thao tác giữ/nhận lịch mới cùng thợ,
và cron dọn theo batch tối đa 500 đơn mỗi phút với `FOR UPDATE SKIP LOCKED`.
Một đơn đang làm quá giờ không tự coi là xong: khi tính lịch tiếp tục chặn
ít nhất 30 phút từ hiện tại và đánh dấu ước tính. Không tự dời lịch đã nhận.

## 4B. Dịch vụ phát sinh tại nơi thực hiện

`ServiceOrder.providerServiceId` và `servicePriceAmount` giữ snapshot dịch vụ gốc;
`OrderAddOn` lưu các đề nghị phát sinh. `subtotalAmount`, `totalAmount`,
`durationMinutes` và `commissionAmount` trên đơn tính cả add-on đã được chấp nhận.

API đã triển khai (đều cần JWT người dùng):

| Method / route | Quy tắc |
| --- | --- |
| GET /me/provider/orders/:id/add-on-options | Dịch vụ active đã duyệt của thợ, giá/thời lượng và khả năng kéo dài lịch |
| POST /me/provider/orders/:id/add-ons | Body `{ "providerServiceId": "uuid", "note"?: "..." }`, `Idempotency-Key`; trả 201 và đề nghị `PENDING` |
| POST /me/provider/orders/:id/add-ons/:addOnId/cancel | Thợ hủy đề nghị chưa được quyết định |
| POST /me/orders/:id/add-ons/:addOnId/decision | Khách gửi `{ "approve": true|false }`; trả `{ addOn, order }` |

Chỉ `ARRIVED` và `IN_PROGRESS` được tạo đề nghị. Giá lấy từ `ProviderService`
đang hoạt động và được snapshot; không cho nhập giá tay, không tính thêm phí di
chuyển, voucher cũ mặc định không áp dụng. Một đơn có tối đa một đề nghị chờ,
tối đa năm add-on đã chấp nhận và đề nghị hết hạn sau 10 phút.

Khi khách chấp nhận, transaction phải khóa đơn, provider calendar và wallet;
kiểm tra lại giá/dịch vụ, chồng lịch và số dư; sau đó mới tăng subtotal/total,
duration, commission/HOLD và `ProviderCalendarBlock.endAt`. Giờ kết thúc mới là
`max(expectedEndAt, acceptedAt) + addOn.durationMinutes`. Nếu bất kỳ điều kiện
nào thay đổi, trả 409 và giữ nguyên đơn. Không cho complete khi còn đề nghị
`PENDING` chưa hết hạn. Đề nghị phát sinh được trả trong `addOns` ở chi tiết đơn,
cả với khách và thợ. `GET add-on-options` có `available` và `reason`; đây là
ước tính tại lúc đọc, bước đề nghị và xác nhận đều kiểm tra lại.

Các event: `ORDER_ADD_ON_REQUESTED`, `ORDER_ADD_ON_ACCEPTED`,
`ORDER_ADD_ON_REJECTED`, `ORDER_ADD_ON_CANCELLED`, `ORDER_ADD_ON_EXPIRED`.
Đề nghị hết hạn được xử lý mỗi phút; client nên tải lại đơn sau notification.
Mobile đã tích hợp ngày 02/11/2026: thợ chọn option đã được backend đánh giá,
gửi/rút đề nghị; khách xem giá/thời lượng và quyết định. Hai phía hiển thị
line-item gốc/phát sinh; tổng tiền/hoa hồng dùng nguyên giá trị API, không cộng
lại ở client. Body quyết định trả `{addOn, order}` được dùng để cập nhật ngay
snapshot của khách; GET cũ không được ghi đè kết quả vừa xác nhận.

Client giữ cùng Idempotency-Key cho retry cùng một ý định và nội dung, đổi key
khi nội dung hoặc ý định mới thay đổi; không tự lặp POST khi timeout/5xx.
409 và kết quả chưa rõ phải GET lại đơn. Chưa đối soát được thì khóa riêng
action phát sinh, không khóa SOS. Backend vẫn là nơi kiểm tra cuối về trạng
thái, lịch, giá, quyền, ví và tính tiền. Chưa nghiệm thu FCM trên thiết bị thật.

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

Chưa triển khai trong đợt đặt lịch gốc: push
nhắc lịch, tự điều phối khi thợ trễ, tranh chấp thanh toán, tracking hành trình,
phí hủy và điều phối nhiều nhân viên của tổ chức.
Từ bản cập nhật dịch vụ phát sinh, một đơn có thể có thêm tối đa năm dịch vụ
được khách chấp nhận sau khi thợ đến; lúc tạo đơn vẫn chọn một dịch vụ gốc.
Luồng chọn thợ khác sau `REJECTED`/`EXPIRED` được bổ sung sau đó; xem mục 9.
FCM được bổ sung sau đợt đặt lịch gốc; xem `push-notifications.md`.

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

### Tìm thợ khác sau khi bị từ chối hoặc hết hạn

Mỗi nhu cầu đặt dịch vụ có `bookingGroupId`; các đơn trong nhóm có
`bookingAttempt` tăng dần. Một nhóm chỉ được có một đơn đang chờ hoặc đang
thực hiện. Đơn cũ giữ nguyên để truy vết, không sửa thợ/giá của đơn đã từ chối.

`GET /api/me/orders/:id/rematch-candidates?radiusKm=30&limit=20` (Bearer của
khách sở hữu đơn) chỉ dùng khi đơn `REJECTED` hoặc `EXPIRED` và là lần thử cuối.
`data` gồm `sourceOrderId`, `bookingGroupId`, `service` (catalog service đầy đủ),
`orderDraft` (snapshot `serviceId`, `bookingType`, `scheduledAt`, `inlineAddress`,
`contactName`, `contactPhone`, `customerNote`) và `candidates` cùng shape với
`POST /api/discovery/providers/search`. Backend loại mọi thợ đã thử trong nhóm,
kiểm tra lại điều kiện hiện tại và có thể trả danh sách rỗng. Đơn không thuộc
khách trả 404; đơn không hợp lệ hoặc đã có lần thử tiếp trả 409.

Mobile giữ `orderDraft` từ response để hiển thị. Khi chọn thợ mới, gọi
`POST /api/orders/quote` với `providerServiceId` mới, cùng loại lịch, thời điểm
và `inlineAddress` từ snapshot; áp voucher mới nếu cần. Sau khi khách xác nhận
báo giá mới, gọi `POST /api/me/orders/:id/retry` với header `idempotency-key`
và body chỉ gồm `providerServiceId`, `quoteToken`, `voucherCode?`. Contact,
địa chỉ, ghi chú và thời gian do server copy từ đơn nguồn; client không được
gửi giá, khoảng cách hay phí. Response 201 là đơn mới `PENDING_PROVIDER`, chưa
phải được thợ nhận. Timeout mạng phải thử lại cùng key và payload; 409 thì tải
lại chi tiết đơn và không tạo yêu cầu mới mù quáng.

Thông báo `ORDER_REJECTED` và `ORDER_EXPIRED` của khách có `nextAction=REMATCH`.
Đây là gợi ý thao tác; khi bấm vẫn gọi endpoint để xác minh trạng thái mới nhất.
Không tự động gửi đơn sang thợ khác khi khách chưa chọn và xác nhận.

Voucher không được tự động sao chép từ đơn trước. Khách chọn lại voucher ở màn
báo giá của thợ mới; backend kiểm tra lại phạm vi, hạn dùng, lượt sử dụng và
mức giảm. Nếu lịch đặt trước không còn cách hiện tại ít nhất 60 phút, endpoint
tìm lại trả 400; khách cần bắt đầu một yêu cầu mới với thời gian hợp lệ.

Kiểm chứng ngày 27/10/2026: bộ booking HTTP/PostgreSQL đạt 34/34 test trên
database thử riêng, bao gồm rematch từ `REJECTED` và `EXPIRED`, chỉ một retry
đồng thời thành công, replay cùng key, BOLA, giữ snapshot, từ chối thợ đã thử,
đổi sang catalog service khác, thiếu key và body cố sửa thông tin liên hệ.
Flutter booking đạt 16/16 test cho tìm thợ, khôi phục draft và gửi đơn.

Tài liệu màn hình, dữ liệu nhập/xuất, quyền hiển thị action và tiêu chí nghiệm
thu chi tiết nằm tại [Tài liệu UI](../../tailieuUI.md), mục `A.8B.8` đến
`A.8B.23`. Các nguyên tắc bắt buộc khi tích hợp:

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
- Trình tự evidence và action là gửi GPS khi arrive, upload
  `BEFORE_WORK` rồi start, upload `AFTER_WORK` rồi complete. Upload thành công
  nhưng action lỗi thì dùng lại evidence đã có, không upload trùng.
- Signed URL của ảnh bằng chứng chỉ dùng tạm thời. Client lưu `evidenceId`, gọi
  lại endpoint cấp URL khi cần xem hoặc URL hết hạn.
- Khi cancellation request ở `PENDING_CUSTOMER` hoặc `SUPPORT_REVIEW`, khóa các
  action tiếp tục công việc. Không dựng luồng hủy trực tiếp sau `EN_ROUTE`.
- Khi order là `SAFETY_HOLD`, khóa mọi action đơn. Client đọc hồ sơ SOS theo
  đúng vai trò và không hiển thị báo cáo/ảnh của bên còn lại.
- Inbox notification lưu ở PostgreSQL và hỗ trợ SSE khi app mở; khi rớt kết
  nối, client dùng `after` để nhận tiếp và vẫn có thể tải lại bằng GET.
- Datetime request phải có timezone; response UTC phải được chuyển ở presentation
  layer. Không cộng thủ công 7 giờ vào dữ liệu lưu hoặc domain model.
