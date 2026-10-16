# Thiết kế chat tư vấn khách hàng - thợ

> Trạng thái: **Đã triển khai backend REST + database + liên kết đơn**. Chưa có WebSocket, ảnh, FCM push hoặc giao diện mobile/web.
> Phạm vi: Hội thoại giữa khách hàng và nhà cung cấp Lambe, có thể bắt đầu **trước khi đặt dịch vụ**. Chatbot AI là tính năng khác.

## 1. Mục tiêu và nguyên tắc

- Khách có thể hỏi thợ về kiểu tóc, nhu cầu, thời lượng, dịch vụ và giá trước khi quyết định đặt.
- Thợ đã được duyệt có thể trả lời khách ngay cả khi đang offline hoặc ví chưa đủ điều kiện nhận đơn. Điều kiện online, lịch trống và ví chỉ được kiểm tra lại khi **báo giá/đặt đơn**, không được suy ra từ việc chat.
- Một cặp `customerId` (User) - `providerId` (ProviderProfile) có một hội thoại dài hạn. Nhiều đơn của cùng cặp có thể xuất hiện trong một hội thoại.
- Khách chủ động gửi tin đầu tiên; thợ chỉ trả lời khi khách đã mở hội thoại hoặc đã có đơn với khách. Không cho thợ nhắn hàng loạt tới khách lạ.
- Nội dung chat không phải giá chốt, lịch hẹn, cam kết thợ đã nhận đơn, hoặc kênh thanh toán. Giá, thời gian và điều kiện đặt phải qua quote và API tạo đơn hiện hành. Voucher chỉ áp dụng khi về sau có hệ thống voucher thực sự; backend hiện chưa có.
- Có thể hỏi tư vấn mà không cần chia sẻ số điện thoại, địa chỉ chính xác hay vị trí GPS. Trước khi thợ nhận đơn, thẻ đơn và sự kiện chat phải tuân cùng mức ẩn thông tin như API đơn hiện tại.

## 2. Luồng nghiệp vụ

1. Từ hồ sơ thợ hoặc kết quả tìm kiếm, khách chọn **Nhắn tin tư vấn**. Màn hình soạn nháp chưa tạo record hội thoại.
2. Khách gửi tin đầu tiên; backend xác minh khách, thợ còn được phép xuất hiện, không tự nhắn cho chính mình, kiểm tra chặn/spam, rồi tạo hoặc lấy hội thoại theo cặp. Thẻ dịch vụ có thể gửi trong hội thoại sau tin đầu tiên và chỉ được chấp nhận nếu đó là dịch vụ đang hoạt động của đúng thợ này.
3. Thợ nhận thông báo tin mới, xem nội dung và trả lời. Hai bên có thể tiếp tục trao đổi khi thợ offline; offline chỉ ảnh hưởng tốc độ phản hồi.
4. Khách có thể mở trang dịch vụ hoặc màn đặt lịch từ ngữ cảnh hội thoại. Chọn `providerServiceId` do server kiểm tra; lấy giá/lịch hiện tại bằng quote trước khi xác nhận. Tin nhắn hoặc thẻ dịch vụ cũ không được dùng làm giá đặt.
5. Khi tạo đơn thành công, đơn gắn với hội thoại của cặp và có sự kiện đơn trong dòng chat. Một cặp có thể có nhiều đơn; mỗi sự kiện chứa `orderId` để mở đúng đơn. Từ chối/hết hạn/hủy đơn không xóa lịch sử chat.
6. Khách hoặc thợ có thể chặn/báo cáo. Chặn ngừng tin nhắn cá nhân mới theo cả hai chiều, nhưng không chặn API xử lý đơn đang diễn ra; thông báo đơn hệ thống vẫn phải đến đúng kênh đơn hàng.

Không dùng chat để tự ý đổi giá, đổi thời gian hoặc xác nhận đơn. Nếu cần đàm phán/điều chỉnh đơn, phải thiết kế API nghiệp vụ riêng và lưu vết.

## 3. Phạm vi phát hành

**Backend MVP đã có:** text UTF-8 (tối đa 2.000 ký tự sau trim), thẻ dịch vụ, hội thoại/inbox phân trang, đánh dấu đã đọc, chặn và báo cáo, liên kết sự kiện tạo đơn. App có thể tải inbox định kỳ để cập nhật số chưa đọc; chưa có feed thông báo tin nhắn riêng. Chưa có gọi điện, voice/video, nhóm chat, xóa tin để che chứng cứ, AI đọc nội dung chat, hay trao đổi tiền qua chat.

**Sau MVP:** ảnh tư vấn, WebSocket realtime, FCM push, trạng thái đang nhập. Ảnh yêu cầu upload private, giới hạn MIME/kích thước, kiểm tra nội dung và URL đọc có hạn; không dùng public upload preset KYC hoặc URL công khai. Push chỉ là tín hiệu có tin mới, không nhúng nội dung nhạy cảm trong payload. Không chặn MVP chỉ vì chưa có realtime: app có thể tải lại theo sequence khi mở/tiếp tục.

## 4. Mô hình dữ liệu đề xuất

| Bảng | Trường và ràng buộc chính |
| --- | --- |
| `chat_conversations` | `id`, `customerId` -> User, `providerId` -> ProviderProfile, `lastSequence`, `lastMessageAt`, `createdAt`, `updatedAt`; unique `(customerId, providerId)`; index `(customerId, lastMessageAt)`, `(providerId, lastMessageAt)` |
| `chat_messages` | `id`, `conversationId`, `sequence`, `senderUserId` (nullable cho sự kiện hệ thống), `kind` (`TEXT`, `SERVICE_CARD`, `ORDER_EVENT`; `IMAGE` sau MVP), `text?`, `providerServiceId?`, `orderId?`, `eventKey?`, `payload?`, `clientMessageId?`, `requestHash?`, `createdAt`; unique `(conversationId, sequence)`, `(conversationId, senderUserId, clientMessageId)` cho tin người dùng và `eventKey` cho sự kiện hệ thống; index `(conversationId, sequence DESC)` |
| `chat_participant_states` | `conversationId`, `userId`, `lastReadSequence`, `blockedAt?`; khóa chính `(conversationId, userId)`; mute/archive để sau |
| `chat_reports` | `id`, `conversationId`, `messageId?`, `reporterUserId`, `reason`, `detail?`, `createdAt`; quy trình xử lý báo cáo nội bộ để sau |
| `service_orders` | Bổ sung `conversationId?` (FK) khi triển khai; backend tự xác định từ cặp customer/provider, không nhận từ client |

`sequence` tăng trong transaction khi khóa dòng conversation, tránh trùng thứ tự khi hai bên gửi đồng thời. Cập nhật `lastSequence`, `lastMessageAt` và tạo message trong cùng transaction. `clientMessageId` là UUID do client tạo cho mỗi lần gửi; retry cùng ID và cùng nội dung trả lại đúng một tin, cùng ID nhưng nội dung khác trả `409`. Hai request đầu tiên cùng cặp phải xử lý xung đột unique và đọc lại conversation; không tạo hai hội thoại. `eventKey` ví dụ `order:<orderId>:created` bảo đảm sự kiện đơn không lặp khi retry. Không dùng offset pagination.

Thẻ dịch vụ lưu `providerServiceId` và snapshot hiển thị tối thiểu (`serviceName`, `priceAmount`, `currencyCode`, `durationMinutes`) tại thời điểm gửi. UI ghi rõ đây là thông tin lúc gửi; quote mới là nguồn giá/lịch có hiệu lực. Sự kiện đơn chỉ lưu ID, loại sự kiện và dữ liệu hiển thị đã cho phép; chi tiết đơn phải lấy qua API đơn có phân quyền. Không ghi PII vào `payload` tự do.

Nội dung text và ảnh có chính sách lưu giữ/xóa rõ trước production. Xóa tài khoản theo quy định phải xét lịch sử đơn/tranh chấp; không hard-delete chat đang là chứng cứ. Log ứng dụng, analytics và push không chứa nội dung tin nhắn hoặc số điện thoại.

## 5. API đã triển khai

Tất cả dưới prefix `/api`, dùng **User Access Token**, không dùng Internal Admin Access Token. Response tuân wrapper hiện tại (`statusCode`, `success`, `data`, `timestamp`); ví dụ dưới đây chỉ mô tả `data`.

| Phương thức | Đường dẫn | Ý nghĩa |
| --- | --- | --- |
| `POST` | `/me/conversations` | Gửi tin đầu tiên và tạo/lấy hội thoại theo cặp; tối đa 10 hội thoại mới/24h/khách |
| `GET` | `/me/conversations?view=customer\|provider&cursor=&limit=20` | Inbox của vai trò chọn, chỉ trả hội thoại của user hiện tại |
| `GET` | `/me/conversations/:id/messages?beforeSequence=&limit=50` | Trang tin cũ hơn, trả `nextCursor`; thứ tự giảm dần để phân trang ổn định |
| `GET` | `/me/conversations/:id/messages?afterSequence=&limit=100` | Đồng bộ tin mới hơn sau khi app kết nối lại; thứ tự tăng dần |
| `POST` | `/me/conversations/:id/messages` | Gửi `TEXT` hoặc `SERVICE_CARD` |
| `PATCH` | `/me/conversations/:id/read` | Cập nhật `lastReadSequence` chỉ tăng |
| `PUT` / `DELETE` | `/me/conversations/:id/block` | Chặn / bỏ chặn bởi người hiện tại |
| `POST` | `/me/conversations/:id/reports` | Báo cáo nội dung vi phạm |

Ví dụ tin đầu tiên:

```json
{
  "providerId": "provider-uuid",
  "clientMessageId": "e9317119-1bf8-494d-a8da-5745075731ac",
  "kind": "TEXT",
  "text": "Mình muốn tư vấn kiểu tóc phù hợp trước khi đặt ạ."
}
```

Ví dụ gửi thẻ dịch vụ trong hội thoại có sẵn:

```json
{
  "clientMessageId": "0a026873-2ce1-46db-b4ad-6cec435c4874",
  "kind": "SERVICE_CARD",
  "providerServiceId": "provider-service-uuid"
}
```

`POST /me/conversations` trả `200` và `{conversationId, message, created}` cho cả tạo mới lẫn đã có; retry cùng `clientMessageId` trả cùng message. `message` có `id`, `sequence`, `kind`, `senderUserId`, `createdAt` và payload tương ứng. Inbox có `lastMessage`, `unreadCount`, `peer` tối thiểu (`id`, tên, avatar), không có phone/address. `read` nhận `{ "lastReadSequence": 42 }`; server không cho vượt `lastSequence` hoặc lùi cursor. `view` chỉ chọn inbox hiển thị, không cấp thêm quyền; khi chọn `provider`, backend lọc theo ProviderProfile thuộc user hiện tại.

`POST /orders` không nhận `conversationId`. Service đặt đơn tự lấy/tạo hội thoại từ cặp customer/provider trong transaction tạo đơn, gắn `conversationId` và thêm `ORDER_EVENT`; response tạo đơn có `conversationId`. `OrderNotification` có `orderId` bắt buộc nên **không** dùng nó cho tin nhắn trước đơn. Thông báo push/chat notification riêng chưa triển khai.

Lỗi chuẩn: `401` token không hợp lệ, `404` hội thoại/tin không thuộc người dùng (không để lộ sự tồn tại), `403` tài khoản hoặc nhà cung cấp không được phép nhắn, `409` hội thoại đã chặn hoặc thẻ dịch vụ không còn hợp lệ, `429` vượt rate limit, `400` payload/cursor không hợp lệ. Nếu provider ngừng hoạt động, giữ quyền đọc lịch sử nhưng khóa gửi mới, trừ thông báo xử lý đơn đang có.

## 6. Phân quyền và an toàn

- Mọi query theo conversation ID phải xác minh `customerId === user.id` hoặc `provider.userId === user.id`; không dựa vào `view`, `senderUserId` hay ID trong body. Người có cả hai vai trò vẫn dùng cùng User identity và không thể tự chat với profile của mình.
- Khi tạo hội thoại, thợ phải ở trạng thái hoạt động được công khai; điều kiện service card kiểm tra thêm provider service + service + category đang hoạt động. Không yêu cầu thợ online hoặc đủ ví chỉ để tư vấn.
- Thợ không được tạo cuộc trò chuyện mới với khách nếu chưa có tin mở đầu hoặc đơn từ khách đó. Chặn/báo cáo có rate limit riêng; chống mở hội thoại spam với quota cấu hình và đo lường thực tế.
- Nội dung text là dữ liệu không tin cậy: giới hạn độ dài, validate DTO, escape khi render, không chấp nhận HTML/URL tự động fetch, không cho arbitrary JSON payload từ client. Không ghi text vào audit log.
- Internal admin/moderator không mặc nhiên được đọc toàn bộ chat. Nếu cần chứng cứ tranh chấp, phải có case ID, quyền chuyên biệt, phạm vi hội thoại/thời gian cần thiết và audit ai đã xem. Chính sách retention/cấp quyền cụ thể cần phê duyệt trước production.
- Realtime sau MVP: xác thực handshake bằng access token và **cùng quy tắc session còn hiệu lực** như HTTP; gia nhập room theo user ID do server xác định, không tự chọn room. Mất kết nối hoặc token hết hạn thì đồng bộ lại bằng `afterSequence`; WebSocket event không là nguồn dữ liệu duy nhất. Redis adapter chỉ cần khi có nhiều instance.

## 7. Mobile/UI contract

- Hồ sơ thợ và danh sách thợ: nút **Nhắn tin tư vấn** mở composer, không cần đơn. Nếu chưa đăng nhập, chuyển xác thực rồi quay lại đúng thợ.
- Inbox khách và inbox thợ tách theo `view`; mỗi dòng hiện avatar/tên, tin cuối, thời gian, số chưa đọc. Chưa có API thì không hiển thị như tính năng đã hoạt động.
- Màn chat hiển thị lịch sử, thời gian gửi, trạng thái gửi/thất bại; retry dùng nguyên `clientMessageId` cũ. Khi mở lại app, lấy `afterSequence` sau tin cuối đã lưu.
- Thẻ dịch vụ có tên, giá lúc gửi, thời lượng; CTA **Xem dịch vụ/Đặt lịch** mở luồng quote hiện tại. Nếu giá thay đổi hoặc thợ không còn nhận dịch vụ, hiển thị trạng thái mới và không dùng snapshot cũ để thanh toán.
- Thẻ đơn hiển thị mã/trạng thái và mở API chi tiết đơn của người đang đăng nhập. Trước `ACCEPTED`, không lộ địa chỉ/số liên lạc khách. Không đưa thông tin này vào preview notification.
- Có hành động báo cáo, chặn, bỏ chặn. Trạng thái mạng yếu: tin đang gửi, lỗi và nút thử lại; không nhân đôi tin khi retry.

## 8. Kiểm thử bắt buộc và thứ tự triển khai

1. DB migration, repository và unit test cho unique cặp, sequence đồng thời, idempotency, phân trang, chặn và unread.
2. REST auth/authorization e2e: khách A không đọc/gửi vào chat của B; thợ khác không xem; thợ không nhắn trước; tự chat bị từ chối; service card sai owner/inactive bị từ chối; tài khoản khóa chỉ đọc hoặc bị chặn theo chính sách.
3. Kết nối booking: tạo đơn idempotent, liên kết đúng chat, nhiều đơn trên cùng hội thoại, rollback không để lại event ảo; không làm thay đổi điều kiện quote, giữ lịch, ví và hoa hồng hiện hành.
4. UI polling/sync cơ bản; kiểm tra số tin chưa đọc, retry, reconnect và hiển thị PII trước/sau nhận đơn.
5. Sau khi REST ổn định mới thêm ảnh private, Socket.IO/FCM và test revoke token, room isolation, sự kiện trễ/lặp, multi-instance.

**Điểm cần chốt trước production:** thời gian lưu tin/ảnh, quyền hỗ trợ xem hội thoại trong tranh chấp, nội dung bị cấm và quy trình xử lý báo cáo, hạn mức chống spam theo số liệu thực tế. Không coi các điểm này đã được giải quyết bởi thiết kế MVP.
