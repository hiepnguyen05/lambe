# Operations API

Tài liệu này mô tả đúng phần API vận hành nội bộ đã có trong mã nguồn Lambe tại
ngày 18/10/2026. Các chức năng thuộc roadmap nhưng chưa có controller không được
coi là API khả dụng.

## 1. Phạm vi đã triển khai

- Quản lý vòng đời tài khoản nội bộ: mời, kích hoạt, sửa thông tin, thay role,
  khóa/mở khóa và đặt lại mật khẩu.
- Tra cứu audit log đã loại dữ liệu nhạy cảm.
- Tra cứu danh sách, chi tiết, timeline và bằng chứng của đơn dịch vụ theo role.
- Hàng đợi SOS, chi tiết sự cố, ảnh riêng tư và thao tác đóng hồ sơ dành cho
  `ADMIN`/`SUPPORT`.
- Swagger tương tác tại `/docs` khi server chạy.

Chưa thuộc phạm vi đã triển khai: dispute end-to-end, điều chỉnh ví theo cơ chế
maker-checker, chính sách hoa hồng động, quản lý thay đổi dịch vụ của thợ, FCM
delivery và dashboard báo cáo.

## 2. Xác thực và response

Trừ `POST /api/admin/auth/activate`, các API trong tài liệu này dùng miền xác
thực nội bộ, tách hoàn toàn khỏi token khách hàng/nhà cung cấp.

```http
Authorization: Bearer <internal-access-token>
```

Refresh token nội bộ nằm trong cookie HTTP-only `lambe_internal_refresh`, giới
hạn path `/api/admin/auth`. Frontend phải gửi cookie khi gọi refresh/logout và
không lưu refresh token trong local storage.

Response thành công dùng envelope chung:

```json
{
  "statusCode": 200,
  "success": true,
  "data": {},
  "timestamp": "2026-10-18T12:00:00.000Z"
}
```

API phân trang trả thêm:

```json
{
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

## 3. Role nội bộ

| Role | Mục đích |
| --- | --- |
| `ADMIN` | Quản trị tài khoản nội bộ, audit và dữ liệu vận hành đầy đủ |
| `MODERATOR` | Theo dõi đơn với projection đã che dữ liệu nhạy cảm |
| `SUPPORT` | Hỗ trợ đơn với projection đã che dữ liệu nhạy cảm |
| `KYC_REVIEWER` | Kiểm duyệt hồ sơ KYC theo API provider application |
| `SERVICE_REVIEWER` | Kiểm duyệt dịch vụ/giá theo API provider application |

Một tài khoản có thể có nhiều role. Chỉ `ADMIN` được quản lý tài khoản nội bộ và
đọc audit log. `ADMIN`, `MODERATOR`, `SUPPORT` được đọc đơn vận hành. Chỉ
`ADMIN` được xem liên hệ, địa chỉ chính xác, hoa hồng và URL bằng chứng đơn.
Riêng hồ sơ SOS, `SUPPORT` được xem dữ liệu liên hệ/địa chỉ và ảnh cần thiết để
xử lý khẩn cấp; `MODERATOR` không được truy cập. Mọi lần đọc chi tiết/ảnh SOS
đều được audit.

## 4. Xác thực tài khoản nội bộ

| Method | Endpoint | Auth | Chức năng |
| --- | --- | --- | --- |
| POST | `/api/admin/auth/login` | Public, rate limited | Đăng nhập username/password |
| POST | `/api/admin/auth/refresh` | Refresh cookie | Xoay refresh token và cấp access token mới |
| POST | `/api/admin/auth/logout` | Refresh cookie nếu có | Thu hồi phiên hiện tại và xóa cookie |
| GET | `/api/admin/auth/me` | Internal bearer | Lấy tài khoản đang đăng nhập |
| POST | `/api/admin/auth/activate` | One-time token | Thiết lập mật khẩu từ email mời/reset |
| POST | `/api/admin/auth/change-password` | Internal bearer | Đổi mật khẩu và thu hồi toàn bộ phiên |

Body kích hoạt:

```json
{
  "token": "one-time-token-from-email",
  "password": "a-password-of-at-least-15-characters"
}
```

Body đổi mật khẩu:

```json
{
  "currentPassword": "current-password",
  "newPassword": "a-different-password-of-at-least-15-characters"
}
```

Token mời hết hạn sau 24 giờ; token reset hết hạn sau 1 giờ. Token chỉ dùng một
lần, chỉ bản SHA-256 được lưu trong database. Đổi mật khẩu thu hồi mọi session
và frontend phải đưa người dùng về màn đăng nhập.

## 5. Quản lý tài khoản nội bộ

Tất cả endpoint trong phần này yêu cầu role `ADMIN`.

| Method | Endpoint | Chức năng |
| --- | --- | --- |
| GET | `/api/admin/internal-accounts` | Danh sách có tìm kiếm, lọc và phân trang |
| GET | `/api/admin/internal-accounts/:id` | Chi tiết tài khoản |
| POST | `/api/admin/internal-accounts` | Tạo tài khoản `INVITED` và xếp hàng email |
| PATCH | `/api/admin/internal-accounts/:id` | Sửa họ tên/email |
| PUT | `/api/admin/internal-accounts/:id/roles` | Thay thế toàn bộ role |
| POST | `/api/admin/internal-accounts/:id/disable` | Khóa và thu hồi phiên |
| POST | `/api/admin/internal-accounts/:id/enable` | Mở lại tài khoản |
| POST | `/api/admin/internal-accounts/:id/password-reset` | Xếp hàng email reset |

Query danh sách hỗ trợ đúng các trường sau:

```text
status, search, page, limit
```

`limit` tối đa 100. Hiện API chưa hỗ trợ lọc trực tiếp theo role.

Body tạo tài khoản:

```json
{
  "username": "support01",
  "fullName": "Nguyen Van A",
  "email": "support@example.com",
  "roles": ["SUPPORT"]
}
```

Quy tắc validation:

- `username`: 3-64 ký tự, bắt đầu bằng chữ; chỉ gồm chữ, số, `.`, `_`, `-`.
- `fullName`: 2-120 ký tự.
- `email`: email hợp lệ, tối đa 254 ký tự.
- `roles`: mảng không rỗng, không trùng và chỉ chứa role nội bộ hợp lệ.

Body cập nhật chỉ nhận `fullName` và/hoặc `email`. Body thay role:

```json
{
  "roles": ["SUPPORT", "MODERATOR"]
}
```

Response tài khoản không chứa credential/token hash:

```json
{
  "id": "account_uuid",
  "username": "support01",
  "fullName": "Nguyen Van A",
  "email": "support@example.com",
  "status": "ACTIVE",
  "mustChangePassword": false,
  "lastLoginAt": null,
  "createdAt": "2026-10-18T12:00:00.000Z",
  "updatedAt": "2026-10-18T12:00:00.000Z",
  "roles": ["SUPPORT"]
}
```

Các bất biến bảo mật:

- Không thể khóa admin đang hoạt động cuối cùng.
- Không thể gỡ role `ADMIN` khỏi admin đang hoạt động cuối cùng.
- Thay role, khóa tài khoản hoặc đổi mật khẩu làm token/session cũ mất hiệu lực.
- Đổi email làm token thiết lập đang chờ mất hiệu lực; tài khoản chưa kích hoạt
  được gửi token mới.
- `LOCKED` do bảo vệ đăng nhập không được mở bằng endpoint enable thông thường.
- Invite/reset yêu cầu SMTP hoạt động; nếu chưa cấu hình, API trả `503` và không
  âm thầm tạo luồng không thể hoàn tất.
- Admin đầu tiên được bootstrap bằng `npm run admin:create`, không có đăng ký
  admin công khai.

## 6. Audit log nội bộ

Chỉ `ADMIN` được truy cập:

| Method | Endpoint | Chức năng |
| --- | --- | --- |
| GET | `/api/admin/audit-logs` | Lọc và phân trang audit log |
| GET | `/api/admin/audit-logs/:id` | Xem một audit record |

Query hỗ trợ:

```text
actorInternalAccountId, action, resourceType, from, to, page, limit
```

`from` không được lớn hơn `to`; `limit` tối đa 100. Projection chỉ trả `id`,
actor ID, action, resource type/ID, result, request ID và thời gian. API cố ý
không trả metadata tự do, IP hoặc user-agent.

## 7. Tra cứu đơn vận hành

### 7.1. Danh sách

```http
GET /api/admin/orders
```

Role: `ADMIN`, `SUPPORT`, `MODERATOR`.

Query hiện hỗ trợ:

```text
status, bookingType, customerId, providerId, from, to, page, limit
```

`from` và `to` lọc theo `createdAt`; khoảng thời gian đảo ngược trả `400`;
`limit` tối đa 100. Hiện chưa có filter theo service hoặc dispute.

Item danh sách chỉ gồm thông tin tổng quan: ID khách/thợ, loại đặt, lịch dự kiến,
trạng thái, tên dịch vụ, tổng tiền, tiền tệ, thời gian tạo/cập nhật và tên hiển
thị của thợ. Danh sách không trả số điện thoại, địa chỉ chính xác hay hoa hồng.

### 7.2. Chi tiết và timeline

```http
GET /api/admin/orders/:id
```

Role `SUPPORT` và `MODERATOR` nhận thông tin dịch vụ, giá, thời lượng, tỉnh/quận/
phường, các mốc trạng thái, metadata bằng chứng, yêu cầu hủy, lịch sử liên hệ và
đánh giá. Họ không nhận tên/số điện thoại liên hệ, địa chỉ dòng/đường, tọa độ,
ghi chú riêng, hồ sơ khách hoặc hoa hồng.

Role `ADMIN` nhận thêm dữ liệu liên hệ, địa chỉ chính xác và snapshot hoa hồng.
Mỗi lần admin đọc chi tiết tạo audit `ORDER_CONTACT_VIEWED`.

Response chi tiết chứa `timeline` đã sắp xếp tăng dần theo thời gian, hợp nhất từ:

- `STATUS`: lịch sử chuyển trạng thái.
- `EVIDENCE`: thời điểm chụp bằng chứng, chưa kèm URL.
- `CANCELLATION_REQUEST`: yêu cầu hủy liên quan.

Timeline hiện chưa hợp nhất wallet hold hoặc notification delivery.

### 7.3. URL bằng chứng riêng tư

```http
GET /api/admin/orders/:id/evidence/:evidenceId
```

Chỉ `ADMIN`. API xác minh bằng chứng thuộc đúng đơn, ghi audit
`ORDER_EVIDENCE_VIEWED`, rồi trả URL ký ngắn hạn cùng `id`, `type`,
`capturedAt`. `publicId` của Cloudinary không xuất hiện trong response.

Giai đoạn này không có API vận hành tổng quát để sửa trạng thái đơn, sửa số dư
ví hoặc thay quyết định nghiệp vụ. Các command nhạy cảm phải đi qua module
chuyên trách ở những phase sau.

### 7.4. Hàng đợi sự cố an toàn

Role: `ADMIN`, `SUPPORT`.

| Method | Endpoint | Chức năng |
| --- | --- | --- |
| GET | `/api/admin/safety/incidents` | Tối đa 50 hồ sơ `OPEN`, cũ nhất trước |
| GET | `/api/admin/safety/incidents/:id` | Chi tiết báo cáo, liên hệ, địa chỉ và metadata ảnh |
| GET | `/api/admin/safety/incidents/:id/evidence/:evidenceId` | Signed URL ảnh riêng tư |
| POST | `/api/admin/safety/incidents/:id/close` | Đóng hồ sơ và hủy đơn đang giữ |

Danh sách không chứa địa chỉ, liên hệ hoặc nội dung chi tiết. Chỉ màn chi tiết
mới trả dữ liệu nhạy cảm và ghi audit `ORDER_SAFETY_INCIDENT_ACCESSED`. Lấy URL
ảnh ghi `ORDER_SAFETY_EVIDENCE_ACCESSED`.

Body đóng hồ sơ:

```json
{
  "resolutionNote": "Đã liên hệ hai bên và hoàn tất xử lý"
}
```

Ghi chú bắt buộc 10-1000 ký tự. Đóng hồ sơ sẽ chuyển đơn từ `SAFETY_HOLD` sang
`CANCELLED`, giải phóng calendar block, wallet HOLD và voucher đang giữ trong
cùng transaction. Đây không phải kết luận trách nhiệm hoặc bút toán bồi thường.
Chi tiết tích hợp: [Order Safety API](order-safety-api.md).

### 7.5. Hàng đợi đơn bị treo

Role: `ADMIN`, `SUPPORT`.

| Method | Endpoint | Chức năng |
| --- | --- | --- |
| GET | `/api/admin/orders/operational-alerts` | Tối đa 100 cảnh báo đang mở, cũ nhất trước |
| POST | `/api/admin/orders/operational-alerts/:id/acknowledge` | Nhận xử lý cảnh báo |
| POST | `/api/admin/orders/operational-alerts/:id/resolve` | Đóng cảnh báo kèm ghi chú |
| POST | `/api/admin/orders/operational-alerts/:id/cancel-order` | Hủy đơn quá hạn trước khi bắt đầu dịch vụ |
| POST | `/api/admin/orders/operational-alerts/:id/escalate-dispute` | Chuyển đơn đang thực hiện quá hạn sang tranh chấp |

Backend quét mỗi 5 phút, tối đa 500 trường hợp/lượt. Ngưỡng cảnh báo:

- `ACCEPTED`: quá giờ bắt đầu 15 phút.
- `EN_ROUTE`: quá giờ bắt đầu 30 phút.
- `ARRIVED`: chưa bắt đầu sau khi đến 30 phút.
- `IN_PROGRESS`: quá giờ kết thúc dự kiến 60 phút.
- `SAFETY_HOLD`: chưa xử lý sau 15 phút.
- `PAYMENT_DISPUTE`, `DISPUTED`: chưa xử lý sau 24 giờ.
- Yêu cầu hủy `SUPPORT_REVIEW`: chưa xử lý sau 2 giờ từ lúc yêu cầu.

Quá trình quét có khóa database và chống tạo trùng theo cùng một lần đi vào
trạng thái. Cảnh báo đang mở được tự đóng khi đơn rời trạng thái tương ứng.
Watchdog không tự chuyển trạng thái đơn và không tự thực hiện bút toán. Thao tác
nhận/đóng của nhân viên được ghi audit; ghi chú đóng dài 5-1000 ký tự. Response
hàng đợi không chứa số điện thoại hoặc địa chỉ chính xác.

Hủy bằng cảnh báo chỉ áp dụng khi đơn vẫn ở `ACCEPTED`, `EN_ROUTE` hoặc
`ARRIVED`, chưa có yêu cầu hủy đang chờ. Body `{ "resolutionNote": "..." }`.
Trong một transaction, backend giải phóng khoản hoa hồng đang giữ, lịch và
voucher, đổi đơn sang `CANCELLED`, gửi thông báo cho hai bên, đóng cảnh báo và
ghi audit. Đơn đã `IN_PROGRESS` phải được xác minh thanh toán/bằng chứng trước
khi quyết định; endpoint này từ chối trạng thái đó.
Với cảnh báo `SERVICE_COMPLETION_OVERDUE`, Support có thể gửi cùng body tới
`escalate-dispute`. Đơn chuyển sang `PAYMENT_DISPUTE`, giữ nguyên khoản hoa hồng
tạm giữ và gửi thông báo cho hai bên; quyết định tiền vẫn qua API tranh chấp.

Cảnh báo mới được xếp email cho `ADMIN/SUPPORT` đang hoạt động. Cảnh báo `OPEN`
chưa được nhận sau 30 phút (sự cố an toàn sau 5 phút) được xếp email nhắc lại.
Mail outbox chống trùng và kiểm tra quyền, địa chỉ email ngay trước lúc gửi.
Email chỉ chứa mã đơn và loại cảnh báo; cần bật SMTP và cấu hình email nhân sự
để gửi thật.
Các cảnh báo trễ ở `ACCEPTED`, `EN_ROUTE`, `ARRIVED`, `IN_PROGRESS` tạo
`ORDER_DELAYED` cho khách và người phục vụ. Relay hiện có đưa sự kiện này vào
push outbox và Firebase khi thiết bị đã đăng ký FCM.

## 8. Triển khai migration

Các migration của phần vận hành và an toàn đơn:

```text
20261018120000_internal_account_setup
20261018123000_ops_order_query_indexes
20261021180000_order_safety_incidents
20261113070000_order_operational_alerts
```

Trước khi dùng API trên database đang chạy, thực hiện quy trình deploy migration
của môi trường và rebuild/restart backend nếu container vẫn chứa bản build cũ.
Không chạy E2E trên database phát triển hoặc production.

## 9. Bằng chứng kiểm thử ngày 18/10/2026

Đã xác minh trên một PostgreSQL test database tách biệt trong Docker:

- 31 migration deploy thành công.
- Unit/check: 88 suite, 554 test đạt; typecheck và lint đạt.
- E2E: 5 suite, 26 test đạt.
- Booking integration: 1 suite, 22 test đạt.
- Kịch bản cạnh tranh booking: 40 HTTP request hoàn tất trong 767 ms ở môi
  trường local; đây không phải số liệu tải production hoặc cam kết p95/p99.

E2E vận hành đã bao phủ invite/activate một lần, chống dùng lại token, chặn
Support khỏi IAM, bảo vệ admin cuối cùng, vô hiệu JWT sau thay role, audit
redaction, danh sách/chi tiết đơn theo role và chặn Support lấy URL bằng chứng.

Database test đã được xóa sau khi chạy. Migration chưa được xác nhận deploy vào
database ứng dụng `lambe_db` và container backend đang chạy chưa được xác nhận
đã rebuild từ mã nguồn này.

## P6 — API giám sát vận hành, cập nhật 31/10/2026

Ngoài các thao tác hỗ trợ/quản trị ở trên, backend đã có
`GET /api/admin/observability`. Chỉ phiên **nội bộ ADMIN** được đọc; quyền
SUPPORT/MODERATOR hoặc owner của nhà cung cấp không cấp quyền này. Đây là
endpoint chỉ đọc, không có body/query và không có lệnh restart/retry hàng
loạt/sửa ví. Không thay các quyền nghiệp vụ hỗ trợ đang có.

Contract JSON đầy đủ, kiểu dữ liệu, units, cache và lỗi tại
[Observability API](observability-api.md). API trả metrics cục bộ của tiến
trình, gauge hàng chờ trong DB và alert flags; không có time series bền vững,
cluster totals hoặc gửi cảnh báo bên ngoài. Không dùng counter này đối soát
sổ cái hoặc kết luận khách đã nhận push/đơn đã hoàn tất.

UI Admin, role guard, skeleton/refresh, dữ liệu cận dưới, trạng thái
401/403/429/503 và cách giữ state khi mất realtime được mô tả trong phần P6
của [tài liệu UI](../../tailieuUI.md). Xử lý sự cố và cấu hình ở
[runbook](quality-operations-runbook.md); kết quả, giới hạn và API compatibility
ở [báo cáo nghiệm thu](quality-verification-2026-10-30.md). P5 tiếp tục tạm
ngưng phát triển; thanh toán vẫn sandbox, không thêm payout.
