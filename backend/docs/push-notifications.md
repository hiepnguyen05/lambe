# Thông báo đẩy Lambe (Phase 1B)

## Trạng thái hiện tại

Backend đã có API thiết bị, bảng `push_outbox`, worker gửi FCM và relay cho thông báo đơn hàng. Thông báo hồ sơ đối tác và đề xuất thay đổi dịch vụ được xếp hàng trong cùng giao dịch cập nhật trạng thái. Flutter đã đăng ký token sau đăng nhập, nhận sự kiện khi app mở và xử lý nhấn thông báo khi app chạy nền hoặc khởi động lại. Thông báo đơn hàng trong ứng dụng và SSE vẫn là nguồn dữ liệu chính; FCM nhắc người dùng mở app. Chưa xác nhận nhận push trên thiết bị thật ở ba trạng thái foreground/background/terminated.

## P6 — Kết quả worker và tích hợp frontend (31/10/2026)

P6 bổ sung quan sát vận hành, giữ nguyên API thiết bị và mã lỗi hiện có.

- `push`/`events.push` đếm kết quả xử lý tại tiến trình: `sent` là FCM đã nhận
  và worker đã xử lý cập nhật DB, không chứng minh thiết bị hiển thị; `retry`
  là lỗi tạm được hẹn lại; `failed` là kết thúc do mất quyền/phiên, lỗi vĩnh
  viễn hoặc hết lượt; `token-invalid` là token bị thu hồi. `delivery-error`
  ghi lỗi thoát khỏi bước xử lý một hàng, khác lỗi FCM đã được đổi thành retry.
- Hàng đợi bền vững nằm ở PostgreSQL: `pending` chưa thử, `retry` đã thử nhưng
  chưa gửi/kết thúc, gồm cả hàng đang lease hoặc chờ backoff, không chỉ hàng
  đến hạn. Đọc mẫu DB có cache/giới hạn và cờ cận dưới; counters không thay thế
  backlog DB. Worker claim lease **2 phút**; crash sau FCM success trước
  `sentAt` có thể phát lại sau lease: **at-least-once**, không exactly-once.
- Client deduplicate bằng `notificationId` ổn định (`sourceId`, fallback ID
  outbox), không dùng ID lượt worker. Payload chỉ có ID/event/role/deepLink;
  tiêu đề/nội dung là câu tĩnh theo event, không lấy từ chat hoặc PII. Khi tap,
  dựng route từ entity và đọc lại API có phân quyền/trạng thái hiện tại.
- Worker push và `order-notice-relay` có heartbeat/lỗi poll; poll rỗng chỉ tăng
  metrics. Log tổng hợp dùng event, requestId của lượt chạy và counts, không
  in token/payload/lỗi provider thô; requestId HTTP không tự đi xuyên hàng đợi.
  Counters reset khi restart, thuộc một tiến trình; `alerts` chỉ là cờ local,
  chưa có gửi cảnh báo email/Slack hoặc kho metrics bên ngoài.

Xem [Observability API](observability-api.md), [runbook P6](quality-operations-runbook.md)
và [bằng chứng kiểm chứng P6](quality-verification-2026-10-30.md). QA dùng
outbound thay thế/vô hiệu hóa không chứng minh nhận push thiết bị thật hay SLA.

## Cấu hình Firebase cần kiểm tra

1. Mở Firebase Console, chọn project `lambe-f7213` → **Project settings → Cloud Messaging**. Xác nhận **Firebase Cloud Messaging API (V1)** đang bật. Backend dùng Firebase Admin SDK và service account hiện có (`GOOGLE_APPLICATION_CREDENTIALS`); không tạo thêm API key gửi push cho mobile.
2. Android: ứng dụng Firebase đã đăng ký package `com.lambe.mobile`; file `mobile/android/app/google-services.json` đã có. Thiết bị/emulator phải có Google Play services. Khi tích hợp `firebase_messaging`, mobile xin quyền thông báo trên Android 13+ trước khi nhận thông báo hiển thị.
3. iOS: ứng dụng đã đăng ký bundle ID `com.lambe.mobile` và có `mobile/ios/Runner/GoogleService-Info.plist`. Để nhận push iOS, cần bật **Push Notifications**, **Background Modes → Remote notifications** trong Xcode và tải APNs authentication key từ Apple Developer lên **Project settings → Cloud Messaging → Apple app configuration**. Chưa thể kiểm chứng iOS chỉ từ Windows.
4. Trên backend, `FIREBASE_ENABLED=true`, `FIREBASE_PROJECT_ID=lambe-f7213` và file service account được mount như hiện tại cho Firebase Auth. Không đưa service account hoặc FCM token vào Git, log, Swagger example hay notification payload.

## API đã triển khai

`PUT /api/me/push-devices` yêu cầu Lambe user Bearer token. Body:

```json
{
  "platform": "ANDROID",
  "deviceId": "f532936a-793e-49cf-ab0e-f6f7c28ce583",
  "token": "<FCM registration token của thiết bị>",
  "appVersion": "1.0.0"
}
```

`deviceId` là ID cài đặt ứng dụng ngẫu nhiên, ổn định trên một lần cài, do mobile lưu cục bộ; không dùng IMEI hay Android ID. Gửi lại cùng token để cập nhật `lastSeenAt`. Khi Firebase đổi token, gửi token mới cùng `deviceId`: bản ghi cũ được revoke. Khi một token được đăng ký dưới tài khoản mới, quyền sở hữu token chuyển sang phiên mới. Response chỉ chứa `id`, `platform`, `deviceId`, `appVersion`, `lastSeenAt`; không trả token.

`DELETE /api/me/push-devices/:id` thu hồi một thiết bị của chính tài khoản đang đăng nhập. ID của người khác trả `404`. `POST /api/auth/logout` đồng thời thu hồi tất cả thiết bị gắn với phiên refresh token đó. Phiên khác trên cùng tài khoản vẫn hoạt động.

Migration: `20261026120000_user_push_devices`. Unique của FCM token dùng SHA-256 hash; `user_push_devices_active_installation_key` là partial unique index ở PostgreSQL để một cài đặt chỉ có một token đang hoạt động. Bảng giữ bản ghi bị revoke để truy vết. Token FCM gốc chỉ lưu ở backend để worker tương lai gửi tới Firebase, vì vậy cần giới hạn quyền đọc DB và bảo vệ backup.

## Gửi và nhận push

Migration `20261026160000_push_outbox` thêm hàng đợi tổng quát và `order_notifications.pushQueuedAt`. Dòng thông báo có từ trước được đánh dấu đã xử lý tại thời điểm migrate để tránh bắn thông báo cũ. OrderPushRelay quét bản ghi order notification đã commit và tạo hàng đợi cho các thiết bị đang đăng ký, không phụ thuộc vào Firebase. Chat text/service card/image xếp hàng trong cùng transaction tạo tin nhắn; retry cùng `clientMessageId` không xếp hàng trùng. Relay cho đơn hàng chạy sau transaction nghiệp vụ, nên đây là **eventual enqueue**, chưa phải enqueue push cùng transaction đặt lịch.

Worker lấy tối đa 20 hàng mỗi 5 giây bằng PostgreSQL `FOR UPDATE SKIP LOCKED` và lease 2 phút, phù hợp nhiều replica. Retry theo exponential backoff tối đa 8 lượt. Token không còn hợp lệ sẽ bị thu hồi; lỗi Firebase chỉ làm push chậm/hỏng, không đảo ngược giao dịch đã commit. Push lưu một dòng cho mỗi thiết bị và sự kiện, khóa dedup không cho tạo trùng. Hàng đã gửi hoặc lỗi vĩnh viễn được dọn sau 30 ngày. Nếu FCM nhận yêu cầu nhưng worker chết trước khi ghi `sentAt`, thông báo có thể được gửi lại sau khi lease hết hạn (*at least once*).

Payload FCM chỉ có `notificationId`, `event`, `entityType`, `entityId`, `recipientRole` và `deepLink` nội bộ. Nội dung lock screen dùng câu chung, không gửi tên, địa chỉ, số điện thoại, nội dung chat, hồ sơ KYC hoặc tiền. Mobile không tin `deepLink` từ payload: tự dựng route từ `entityType` và `entityId`, gọi API chi tiết có Bearer token để xác nhận quyền trước khi mở. Khi app đang mở, chat/hồ sơ/đề xuất dịch vụ có thanh thông báo với nút **Xem**; sự kiện đơn hàng tiếp tục dùng cập nhật trong ứng dụng/SSE để tránh banner trùng.

Android yêu cầu quyền `POST_NOTIFICATIONS`. Flutter xin quyền sau khi người dùng đăng nhập, lưu ID cài đặt ngẫu nhiên trong secure storage, gửi lại token khi Firebase làm mới hoặc khi app hoạt động trở lại. Logout backend tự thu hồi thiết bị gắn phiên; secure storage giữ ID cài đặt nhưng xóa phiên đăng nhập. iOS cần thiết lập APNs bằng Xcode/Apple Developer như phần trên.

Mobile hiển thị lời giải thích trước hộp thoại quyền hệ điều hành sau đăng nhập và nhớ rằng đã hỏi để tránh lặp lại. Nếu bỏ qua hoặc từ chối, người dùng có thể chọn **Cài đặt thông báo** trong hồ sơ; nếu hệ điều hành không hiện lại hộp thoại, ứng dụng hướng dẫn bật quyền trong cài đặt điện thoại. [Tài liệu Firebase](https://firebase.google.com/docs/cloud-messaging/flutter/receive-messages) lưu ý Android 13+ trả `denied` cả khi chưa hỏi lẫn khi người dùng từ chối, nên cần lưu việc đã hỏi quyền riêng.

## Kiểm tra vận hành

1. Khởi động backend Docker sau migration. Vào app mobile, đăng nhập trên thiết bị/emulator có Google Play services và cho phép thông báo.
2. Kiểm tra có thiết bị hoạt động trong `user_push_devices` mà không in cột `token`. Tạo đơn hoặc gửi chat từ tài khoản còn lại; worker log số `sent/retry/invalid/failed`.
3. Thử app đang mở, chạy nền và bị đóng. Chạm thông báo phải mở đúng đơn/hội thoại; đăng nhập tài khoản khác không được mở dữ liệu cũ.
4. Khi Firebase không phản hồi, đơn/chat vẫn phải được lưu; hàng đợi retry. Đối chiếu số `failedAt` và `sentAt` trong DB. Việc FCM chấp nhận yêu cầu gửi không đảm bảo thiết bị hiển thị; kiểm tra thực tế vẫn bắt buộc.

Các việc còn lại trước production: test thiết bị thật, cấu hình APNs, kiểm tra toàn bộ luồng HTTP đặt lịch/chat khi Firebase ngừng đáp ứng, kiểm thử worker chết sau FCM success và nối collector/kênh cảnh báo bên ngoài. Backend dashboard API và local alert flags đã có ở P6; điều đó chưa đồng nghĩa đã dựng UI dashboard hoặc vận hành cảnh báo chủ động.

**Xác nhận local 26/10/2026:** migration đã áp trên DB test và DB local; backend Docker `healthy`, không có thông báo order chưa xếp hàng hoặc push pending. Có một thiết bị đang hoạt động; Firebase Admin `dryRun` với token đó được FCM chấp nhận. `dryRun` không hiện thông báo và không chứng minh thao tác chạm thông báo trên thiết bị. Flutter `analyze` và 144 test qua; APK debug chưa biên dịch được trong môi trường Codex vì Gradle báo `Unable to establish loopback connection` trước bước biên dịch ứng dụng.

**Kiểm thử bổ sung 26/10/2026:** Trên DB thử riêng đã kiểm tra áp và hoàn tác schema push, không tác động DB local đang dùng. Test PostgreSQL chứng minh hai worker chỉ claim một hàng một lần, và giao dịch cập nhật hồ sơ vẫn commit khi mô phỏng FCM `messaging/server-unavailable`; hàng đợi chuyển sang retry. Đây là kiểm thử tích hợp dịch vụ/giao dịch, chưa thay thế kiểm tra thiết bị thật và toàn bộ endpoint HTTP.
