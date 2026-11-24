# Hợp đồng chung cho kế hoạch cải tiến

Chốt ngày 26/10/2026. Áp dụng cho các phase trong [kế hoạch cải tiến](../../tasks/ke-hoach-cai-tien-he-thong.md). Các mục ghi **dự kiến** chưa phải API đã phát hành.

## Baseline API và kiểm thử

- Snapshot OpenAPI trước Phase 1A: [openapi-baseline-2026-10-26.json](openapi-baseline-2026-10-26.json), SHA-256 `6CC049290FB8B394906B16D6ACDD6CCB15BC8F0E4214A14C7C224BC6896C189A`.
- Backend Docker tại thời điểm chụp có 204 path và 236 route hiện trong Swagger. Ba route thanh toán callback/checkout không hiện trong Swagger, nên tổng theo kiểm kê source trước đó là 239. Snapshot phản ánh container trước khi triển khai SSE chat.
- Sau khi thêm SSE chat, Docker health trả `200`, Swagger có 205 path và 237 route. Ba route ẩn giữ nguyên, tổng HTTP route theo kiểm kê là 240.
- Typecheck build, typecheck test và 117 bộ unit test backend đã qua trước thay đổi SSE. Sau thay đổi, E2E auth/provider/internal qua 26/26, E2E SSE chat qua 2/2, booking integration qua 31/31 trên database riêng `lambe_booking_test_codex`; không dùng `lambe_db` phát triển. Lần chạy booking đầu tiên báo lỗi mock Redis thiếu phương thức mới; đã cập nhật mock và chạy lại đạt 31/31. Không có lỗi baseline còn mở trong các bộ này.

## Hợp đồng event

Các event mới từ Phase 1B trở đi dùng envelope sau. `payload` chỉ chứa dữ liệu cần hiển thị hoặc ID để client gọi API chi tiết; không chứa nội dung KYC, token, số điện thoại, tọa độ chính xác hoặc URL ảnh ký tạm.

```json
{
  "event": "ORDER_ACCEPTED",
  "entityType": "ServiceOrder",
  "entityId": "uuid",
  "recipientRole": "CUSTOMER",
  "deepLink": "/orders/uuid",
  "createdAt": "2026-10-26T00:00:00.000Z"
}
```

`event` là enum ổn định; các event chưa biết phải được client bỏ qua an toàn. `entityId` là ID của đối tượng, không thay cho kiểm tra quyền ở API chi tiết. `deepLink` là đường dẫn nội bộ đã kiểm tra, không nhận URL tùy ý từ client. Event delivery có thể lặp, vì vậy client dedup theo ID thông báo hoặc `(event, entityId, createdAt)`; PostgreSQL là nguồn dữ liệu gốc.

SSE chat hiện tại dùng format riêng đã triển khai: `id: <sequence>`, `event: message`, `data: <ChatMessage JSON>`. Redis chỉ phát chuỗi `updated` trên channel `lambe:chat:events:<conversationId>`; server lấy nội dung từ PostgreSQL. Envelope chung phía trên dành cho outbox/push và sự kiện vận hành mới, không thay đổi contract chat hiện tại.

## Mã lỗi và giới hạn

| Tình huống | HTTP/API contract |
| --- | --- |
| SSE token hết hạn hoặc session bị thu hồi | `401`; mobile dùng cơ chế refresh token hiện có rồi kết nối lại |
| SSE không thuộc hội thoại | `404`, không tiết lộ hội thoại tồn tại |
| SSE quá nhiều request hoặc quá ba kết nối/user/instance | `429`; mobile giữ polling fallback và thử lại có backoff |
| Redis gián đoạn | SSE tiếp tục đọc PostgreSQL mỗi 5 giây; không trả lỗi khi gửi tin |
| Push device token không hợp lệ (dự kiến) | API đăng ký thiết bị trả `400` hoặc `401`; worker hủy token khi FCM xác nhận token không còn hợp lệ |
| Rematch không có thợ hợp lệ (dự kiến) | `200` với danh sách trống; không tự gán thợ |
| Rematch đơn không thuộc khách (dự kiến) | `404` |
| Staff không có quyền đối với đơn/thợ (dự kiến) | `403` nếu vai trò đã biết nhưng bị cấm; `404` nếu ID ngoài phạm vi sở hữu |

SSE chat tự đóng sau 30 giây để client xác thực lại; page chat tối đa 100 message; polling mobile chỉ chạy khi SSE không kết nối. Worker push ở Phase 1B có tối đa tám lần thử với backoff và dead-letter theo thiết kế, chưa được triển khai.

## Ma trận quyền

| Vai trò | Dữ liệu/khả năng hiện tại | Giới hạn |
| --- | --- | --- |
| Customer | Hồ sơ, địa chỉ, chat và đơn của chính mình | Không xem chat/đơn của khách khác |
| Provider owner | Hồ sơ thợ, dịch vụ, availability, chat và đơn gắn với provider mình sở hữu | Không xem hồ sơ/đơn của provider khác |
| Provider staff | **Chưa triển khai**; Phase 5 bổ sung assignment theo đơn | Không cấp quyền ngầm qua `ProviderType.ORGANIZATION` |
| Admin | Quản trị nội bộ theo `InternalRole.ADMIN` | Dùng Internal Access Token; không tự động có quyền đọc chat riêng tư |
| Moderator / KYC reviewer / Service reviewer | Kiểm duyệt đúng phần được controller cấp quyền; riêng KYC có phạm vi dữ liệu nhạy cảm theo vai trò | Không có quyền admin chỉ vì là nhân viên nội bộ |
| Support | Hỗ trợ đơn/sự cố và xem thông tin hồ sơ ở mức đã giới hạn | Không mặc nhiên duyệt KYC hoặc đọc toàn bộ chat |

Mỗi endpoint mới phải kiểm tra quyền ở server theo user từ token và ID đối tượng. Client không được truyền `userId` để tự nâng quyền. Khi triển khai nhân viên tổ chức, bổ sung cột quyền theo assignment cụ thể và test IDOR/BOLA trước khi mở API.
