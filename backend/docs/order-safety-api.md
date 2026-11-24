# API an toàn đơn dịch vụ và SOS

Cập nhật: 22/10/2026. Tài liệu này mô tả đúng API đã có trong backend. Prefix
chung là `/api`; Swagger tương tác tại `/docs`.

## 1. Mục tiêu và ranh giới nghiệp vụ

SOS dành cho tình huống có nguy cơ tới con người hoặc tài sản như đe dọa, bạo
lực, trộm cắp hoặc cấp cứu y tế. Đây là luồng riêng, không thay thế yêu cầu hủy
thông thường do di chuyển, không liên hệ được khách hoặc địa điểm không phù hợp.

Khi nhận SOS, backend lập tức chuyển đơn sang `SAFETY_HOLD` trong cùng
transaction. Trạng thái này:

- khóa các bước tiến trình, hoàn thành và hủy thông thường;
- tiếp tục giữ lịch của thợ và khoản hoa hồng đang `HOLD`;
- loại thợ khỏi kết quả nhận đơn mới và không cho bật/duy trì nhận đơn;
- chuyển yêu cầu hủy đang chờ khách sang `SUPPORT_REVIEW` nếu có;
- ghi lịch sử trạng thái, audit và thông báo trong ứng dụng cho hai bên.

SOS không tự xác định bên có lỗi, không tự trừ tiền và không tự giải phóng tiền.

## 2. Xác thực và response

API khách/thợ dùng `Authorization: Bearer <user-access-token>`. API xử lý nội
bộ dùng `internal-token` của tài khoản có role `ADMIN` hoặc `SUPPORT`.
`MODERATOR` không có quyền truy cập hồ sơ SOS.

Response thành công theo envelope chung:

```json
{
  "statusCode": 200,
  "success": true,
  "data": {},
  "timestamp": "2026-10-22T06:00:00.000Z"
}
```

## 3. Khách hàng hoặc thợ gửi SOS

```http
POST /api/me/orders/:id/safety/sos
POST /api/me/provider/orders/:id/safety/sos
Content-Type: application/json
```

Body hoàn toàn tùy chọn:

```json
{
  "reason": "THREAT",
  "detail": "Người đối diện đang có hành vi đe dọa"
}
```

`reason` nhận `THREAT`, `VIOLENCE`, `THEFT`, `MEDICAL`, `OTHER`; nếu bỏ trống
thì backend dùng `THREAT`. `detail` tối đa 500 ký tự. Không bắt buộc mô tả hoặc
ảnh để tránh trì hoãn thao tác khẩn cấp.

Điều kiện:

- người gọi phải là khách hoặc thợ của đúng đơn;
- đơn đang ở `ACCEPTED`, `EN_ROUTE`, `ARRIVED` hoặc `IN_PROGRESS`;
- mỗi đơn chỉ có một hồ sơ sự cố; mỗi bên có tối đa một báo cáo trong hồ sơ đó.

Gọi lại từ cùng tài khoản là idempotent. Nếu bên còn lại cũng gửi SOS, backend
thêm báo cáo của họ vào cùng hồ sơ thay vì tạo hồ sơ thứ hai.

Response `data` chỉ trả dữ liệu tối thiểu:

```json
{
  "id": "incident_uuid",
  "orderId": "order_uuid",
  "status": "OPEN",
  "createdAt": "2026-10-22T06:00:00.000Z"
}
```

## 4. Xem hồ sơ của chính mình

```http
GET /api/me/orders/:id/safety
GET /api/me/provider/orders/:id/safety
```

Response gồm trạng thái hồ sơ, báo cáo của chính người gọi và metadata ảnh do
chính họ tải lên. API không trả báo cáo, ảnh hoặc signed URL của bên còn lại.

## 5. Bổ sung ảnh bằng chứng riêng tư

```http
POST /api/me/orders/:id/safety/evidence
POST /api/me/provider/orders/:id/safety/evidence
Content-Type: multipart/form-data
```

Tên field là `file`. Chấp nhận JPEG, PNG, WEBP hoặc GIF hợp lệ, tối đa 5 MB;
mỗi người báo cáo được tải tối đa 5 ảnh khi hồ sơ còn `OPEN`. API trả HTTP 201:

```json
{
  "id": "evidence_uuid",
  "createdAt": "2026-10-22T06:01:00.000Z"
}
```

Lấy signed URL cho ảnh do chính mình tải:

```http
GET /api/me/orders/:id/safety/evidence/:evidenceId
GET /api/me/provider/orders/:id/safety/evidence/:evidenceId
```

Ảnh dùng Cloudinary delivery type `authenticated`. Mobile chỉ lưu
`evidenceId`; signed URL có hạn phải lấy lại khi hết hạn và không được ghi log,
đưa vào notification hoặc coi là URL công khai lâu dài.

Backend hiện dùng cấu hình private upload chung:

```env
CLOUDINARY_ENABLED=true
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_UPLOAD_PRESET=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
CLOUDINARY_KYC_UPLOAD_PRESET=...
CLOUDINARY_PRIVATE_URL_TTL_SECONDS=300
```

## 6. Hàng đợi và xử lý nội bộ

| Method | Endpoint | Chức năng |
| --- | --- | --- |
| GET | `/api/admin/safety/incidents` | Tối đa 50 hồ sơ `OPEN`, cũ nhất trước; không có địa chỉ/liên hệ chi tiết |
| GET | `/api/admin/safety/incidents/:id` | Chi tiết hai báo cáo, liên hệ và địa chỉ; truy cập được audit |
| GET | `/api/admin/safety/incidents/:id/evidence/:evidenceId` | Signed URL ảnh riêng tư; truy cập được audit |
| POST | `/api/admin/safety/incidents/:id/close` | Đóng hồ sơ và kết thúc đơn an toàn |

Body đóng hồ sơ:

```json
{
  "resolutionNote": "Đã liên hệ hai bên và xác nhận kết thúc xử lý"
}
```

`resolutionNote` bắt buộc 10-1000 ký tự. Trong một transaction, backend khóa
hồ sơ thợ, đơn và sự cố; sau đó hủy đơn, giải phóng calendar block, giải phóng
wallet hold, trả voucher đang `RESERVED`, đóng yêu cầu hủy liên quan và ghi
thông báo cho hai bên. Retry sau khi hồ sơ đã đóng trả `409`.

## 7. Mã lỗi để client xử lý

| HTTP | Ý nghĩa UI |
| --- | --- |
| 400 | Body, UUID hoặc file không hợp lệ |
| 401 | Token hết hạn/không hợp lệ; refresh hoặc yêu cầu đăng nhập lại |
| 403 | Tài khoản nội bộ không có role xử lý SOS |
| 404 | Không tham gia đơn, không có hồ sơ hoặc không sở hữu ảnh; không tiết lộ tài nguyên tồn tại |
| 409 | Trạng thái đơn không cho SOS, hồ sơ đã đóng hoặc quá giới hạn ảnh |
| 429 | Gửi/upload quá nhanh; UI khóa nút trong thời gian ngắn |

## 8. Hợp đồng tích hợp mobile

1. Nút SOS chỉ xuất hiện với đơn `ACCEPTED`, `EN_ROUTE`, `ARRIVED`,
   `IN_PROGRESS`; dùng thao tác giữ hoặc xác nhận hai bước để tránh chạm nhầm.
2. Gửi request ngay sau xác nhận. Lý do, mô tả và ảnh là bước bổ sung sau.
3. Khi thành công, giữ khóa local, tải lại trạng thái đơn `SAFETY_HOLD` và mở
   màn an toàn. Không dùng câu “Đã kết nối hỗ trợ” khi chưa có acknowledgment.
4. Nếu timeout, gọi GET hồ sơ trước khi gửi lại; POST SOS cũng idempotent.
5. Poll chi tiết đơn, hồ sơ SOS và notification khi app foreground/resume.
6. Không hiển thị “đã có nhân viên tiếp nhận” nếu chưa có acknowledgment.
7. Mục tiêu trước production: có nút gọi dịch vụ khẩn cấp theo khu vực của thiết
   bị, độc lập với mạng/API Lambe. Bản Flutter ngày 31/10/2026 chưa có nút này;
   mới hiển thị hướng dẫn chủ động liên hệ dịch vụ khẩn cấp. Theo dõi SOS-008
   trong `tasks/mobile-correctness-performance-plan.md`.

Bản Flutter đã nối các endpoint khách/thợ, confirmation, khóa thao tác ngay khi
đang gửi/chưa rõ kết quả, đối soát GET sau timeout và ảnh private. GET hồ sơ người
dùng không trả `resolutionNote`; UI chỉ trình bày OPEN/CLOSED, thời điểm đóng và
trạng thái đơn sau khi refetch, không đọc endpoint admin để lấy ghi chú.

## 9. Triển khai

Migration bắt buộc:

```text
20261021180000_order_safety_incidents
```

Sau deploy migration phải rebuild/restart backend Docker, rồi kiểm tra Swagger
có các route `Order Safety` và `Support Order Safety`. Không chạy migration thử
hoặc E2E ghi dữ liệu vào database phát triển/production.

## 10. Giới hạn trước production

Backend hiện lưu hồ sơ, tạo hàng đợi hỗ trợ và notification trong PostgreSQL;
chưa có FCM/SMS/cuộc gọi tới nhân sự trực, acknowledgment, SLA phản hồi, tự gọi
cơ quan khẩn cấp hoặc chính sách lưu/xóa bằng chứng. Vì vậy chưa được truyền
thông SOS như một dịch vụ cứu hộ thời gian thực. Trước production cần tối thiểu:

- push khẩn cấp ngoài ứng dụng tới on-call và cơ chế xác nhận đã tiếp nhận;
- escalation khi quá SLA, dashboard luôn có người trực và audit xử lý;
- chính sách retention, quyền xuất/xóa dữ liệu và quy trình cung cấp cho cơ quan
  có thẩm quyền;
- runbook sự cố, đào tạo nhân sự và kiểm thử diễn tập định kỳ.

Quyết định kiến trúc: [ADR-0001: Giữ đơn khi có sự cố an toàn](decisions/0001-order-safety-hold.md).
