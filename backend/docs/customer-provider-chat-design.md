# Thiết kế chat tư vấn khách hàng - thợ

> Cập nhật 30/10/2026: REST, ảnh riêng tư, SSE + Redis và push outbox đã có; mobile có retry text/ảnh/thẻ dịch vụ. Chat worker tổ chức theo [contract P5E.1](organization-order-chat-api.md). Phần tổ chức tạm ngưng phát triển thêm; kiểm chứng hai thiết bị/FCM thực tế vẫn còn mở.
> Phạm vi: Hội thoại giữa khách hàng và nhà cung cấp Lambe, có thể bắt đầu **trước khi đặt dịch vụ**. Chatbot AI là tính năng khác.

## P6 — Khôi phục realtime và tích hợp frontend (31/10/2026)

P6 củng cố chất lượng/vận hành, giữ nguyên API và mã lỗi hiện có; P5 tiếp tục
tạm ngưng phát triển. Các mốc kiểm chứng cũ bên dưới là lịch sử.

- PostgreSQL lưu tin đã commit; Redis chỉ đánh thức SSE, không lưu lịch sử.
  Redis tự reconnect với backoff tối đa 3 giây và deadline khởi động theo
  `REDIS_CONNECT_TIMEOUT_MS`. Subscriber khôi phục đăng ký; sửa race handoff
  để giữ callback mới trước khi chờ sẵn sàng và cleanup cũ không gỡ entry mới.
  SSE đăng ký trước rồi đọc DB, tiếp tục lấy bù mỗi 5 giây nếu thiếu tín hiệu.
- Đây là bảo toàn dữ liệu đã commit, không bảo đảm ghi được khi Redis hỏng:
  Redis throttling đang bật nhưng down vẫn chặn request bằng **503** trước
  handler, kể cả gửi tin hoặc mở lại stream. `NODE_ENV=test` bỏ qua throttle;
  test đi qua service/polling không chứng minh HTTP production vẫn ghi được.
- Client giữ `afterSequence` từ tin canonical đã nhận, ghép theo ID/sequence,
  nối lại với backoff và GET lấy bù khi request được chấp nhận. Khi 503/timeout,
  giữ bubble chờ/lỗi và nguyên `clientMessageId`/payload để retry; không tự
  đánh dấu đã gửi hoặc đổi ID. Cursor optimistic không dùng để resume/đã đọc.
- Số liệu HTTP/SSE là của tiến trình hiện tại, reset khi restart. Tín hiệu
  resume chỉ cho biết request có cursor, không đếm chính xác thiết bị reconnect;
  metrics không chứa cursor, token hay nội dung chat.

Xem [Observability API](observability-api.md), [runbook P6](quality-operations-runbook.md)
và [bằng chứng kiểm chứng P6](quality-verification-2026-10-30.md). Kết quả QA
được dẫn là bằng chứng theo môi trường/lần chạy, không phải SLA production.

## 1. Mục tiêu và nguyên tắc

- Khách có thể hỏi thợ về kiểu tóc, nhu cầu, thời lượng, dịch vụ và giá trước khi quyết định đặt.
- Thợ đã được duyệt có thể trả lời khách ngay cả khi đang offline hoặc ví chưa đủ điều kiện nhận đơn. Điều kiện online, lịch trống và ví chỉ được kiểm tra lại khi **báo giá/đặt đơn**, không được suy ra từ việc chat.
- Một cặp customer/provider có một hội thoại tư vấn dài hạn. Đơn cá nhân/legacy chưa assigned giữ luồng cũ; mỗi đơn tổ chức có assigned worker dùng phòng riêng cho khách, tổ chức và đúng người thực hiện. Không chuyển lịch sử tư vấn cho mọi worker; contract P5E.1 được ưu tiên cho phần tổ chức so với mô tả MVP bên dưới.
- Khách chủ động gửi tin đầu tiên; thợ chỉ trả lời khi khách đã mở hội thoại hoặc đã có đơn với khách. Không cho thợ nhắn hàng loạt tới khách lạ.
- Nội dung chat không phải giá chốt, lịch hẹn, cam kết thợ đã nhận đơn, hoặc kênh thanh toán. Giá, thời gian, phí di chuyển và voucher phải qua quote và API nghiệp vụ hiện hành; xem [quy tắc giá/voucher](pricing-vouchers-api.md).
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

**Đã có:** text UTF-8 (tối đa 2.000 ký tự sau trim), 1–4 ảnh private/tin, thẻ dịch vụ, inbox/lịch sử phân trang, đã đọc, chặn/báo cáo, sự kiện đơn, SSE và FCM outbox. Mobile gửi optimistic và retry ba loại tin; SSE là kênh cập nhật phòng chat, polling là dự phòng. FCM dùng làm tín hiệu khi app nền/đóng; việc hiển thị trên thiết bị thật còn checkpoint riêng.

**Chưa có trong phạm vi này:** gọi điện, voice/video, trạng thái đang nhập, nhóm chat tự tạo, xóa tin để che chứng cứ, AI đọc chat khách–thợ hoặc thanh toán qua chat. SSE + Redis là kiến trúc realtime hiện tại. Không có yêu cầu chuyển sang WebSocket trong kế hoạch đã chốt. Push chỉ chứa lời nhắc chung/định danh để app đọc lại API có phân quyền; xem [FCM contract](push-notifications.md).

## 4. Mô hình dữ liệu đề xuất

| Bảng | Trường và ràng buộc chính |
| --- | --- |
| `chat_conversations` | `id`, `customerId`, `providerId`, `scopeKey`, `bookingOrderId?`, `lastSequence`, `lastMessageAt`, `createdAt`, `updatedAt`; unique `(customerId, providerId, scopeKey)` và `bookingOrderId`; CONSULTATION cho phòng tư vấn, ORDER theo contract P5E.1 |
| `chat_messages` | `id`, `conversationId`, `sequence`, `senderUserId` (nullable cho sự kiện hệ thống), `kind` (`TEXT`, `IMAGE`, `SERVICE_CARD`, `ORDER_EVENT`), `text?`, `providerServiceId?`, `orderId?`, `eventKey?`, `payload?`, `clientMessageId?`, `requestHash?`, `createdAt`; unique `(conversationId, sequence)`, `(conversationId, senderUserId, clientMessageId)` cho tin người dùng và `eventKey` cho sự kiện hệ thống; index `(conversationId, sequence DESC)` |
| `chat_attachments` | Ảnh của tin `IMAGE`: Cloudinary `publicId`, format, kích thước byte/pixel, vị trí; tối đa 4 ảnh/tin; chỉ lưu delivery type `authenticated`, không lưu URL ký tạm |
| `chat_participant_states` | `conversationId`, `userId`, `lastReadSequence`, `blockedAt?`; khóa chính `(conversationId, userId)`; mute/archive để sau |
| `chat_reports` | `id`, `conversationId`, `messageId?`, `reporterUserId`, `reason`, `detail?`, `createdAt`; quy trình xử lý báo cáo nội bộ để sau |
| `service_orders` | Bổ sung `conversationId?` (FK) khi triển khai; backend tự xác định từ cặp customer/provider, không nhận từ client |

`sequence` tăng trong transaction khi khóa dòng conversation, tránh trùng thứ tự khi hai bên gửi đồng thời. Cập nhật `lastSequence`, `lastMessageAt` và tạo message trong cùng transaction. `clientMessageId` là UUID do client tạo cho mỗi lần gửi; retry cùng ID và cùng nội dung trả lại đúng một tin, cùng ID nhưng nội dung khác trả `409`. Hai request đầu tiên cùng cặp phải xử lý xung đột unique và đọc lại conversation; không tạo hai hội thoại. `eventKey` ví dụ `order:<orderId>:created` bảo đảm sự kiện đơn không lặp khi retry. Không dùng offset pagination.

Thẻ dịch vụ lưu `providerServiceId` và snapshot hiển thị tối thiểu (`serviceName`, `priceAmount`, `currencyCode`, `durationMinutes`) tại thời điểm gửi. UI ghi rõ đây là thông tin lúc gửi; quote mới là nguồn giá/lịch có hiệu lực. Sự kiện đơn chỉ lưu ID, loại sự kiện và dữ liệu hiển thị đã cho phép; chi tiết đơn phải lấy qua API đơn có phân quyền. Không ghi PII vào `payload` tự do.

Nội dung text và ảnh có chính sách lưu giữ/xóa rõ trước production. Xóa tài khoản theo quy định phải xét lịch sử đơn/tranh chấp; không hard-delete chat đang là chứng cứ. Log ứng dụng, analytics và push không chứa nội dung tin nhắn, URL ảnh ký tạm hoặc số điện thoại.

## 5. API đã triển khai

Tất cả dưới prefix `/api`, dùng **User Access Token**, không dùng Internal Admin Access Token. Response tuân wrapper hiện tại (`statusCode`, `success`, `data`, `timestamp`); ví dụ dưới đây chỉ mô tả `data`.

| Phương thức | Đường dẫn | Ý nghĩa |
| --- | --- | --- |
| `POST` | `/me/conversations` | Gửi tin đầu tiên và tạo/lấy hội thoại theo cặp; tối đa 10 hội thoại mới/24h/khách |
| `GET` | `/me/conversations?view=customer\|provider&cursor=&limit=20` | Inbox của vai trò chọn, chỉ trả hội thoại của user hiện tại |
| `GET` | `/me/conversations/:id` | Ngữ cảnh và các bên có quyền chat; dùng cho header/readOnly |
| `GET` | `/me/conversations/:id/messages?beforeSequence=&limit=50` | Trang tin cũ hơn, trả `nextCursor`; thứ tự giảm dần để phân trang ổn định |
| `GET` | `/me/conversations/:id/messages?afterSequence=&limit=100` | Đồng bộ tin mới hơn sau khi app kết nối lại; thứ tự tăng dần |
| `GET` | `/me/conversations/:id/events?afterSequence=0` | SSE tin mới theo sequence; kết nối tự đóng sau 30 giây |
| `POST` | `/me/conversations/:id/messages` | Gửi `TEXT` hoặc `SERVICE_CARD` |
| `POST` | `/me/conversations/:id/images` | Multipart gửi 1-4 ảnh JPEG/PNG/WEBP private, tối đa 5 MB/ảnh |
| `PATCH` | `/me/conversations/:id/read` | Cập nhật `lastReadSequence` chỉ tăng |
| `PUT` / `DELETE` | `/me/conversations/:id/block` | Chặn / bỏ chặn bởi người hiện tại |
| `POST` | `/me/conversations/:id/reports` | Báo cáo nội dung vi phạm |

UUID trong ví dụ chỉ minh họa; providerId/providerServiceId phải lấy từ dữ
liệu thật user được phép truy cập. Ví dụ response gửi tin đầu tiên:

```json
{
  "statusCode": 200,
  "success": true,
  "data": {
    "conversationId": "11111111-1111-4111-8111-111111111111",
    "created": true,
    "message": {
      "id": "55555555-5555-4555-8555-555555555555",
      "sequence": 1,
      "kind": "TEXT",
      "senderUserId": "66666666-6666-4666-8666-666666666666",
      "text": "Mình muốn tư vấn kiểu tóc phù hợp trước khi đặt ạ.",
      "providerServiceId": null,
      "orderId": null,
      "payload": null,
      "clientMessageId": "e9317119-1bf8-494d-a8da-5745075731ac",
      "attachments": [],
      "createdAt": "2026-10-30T08:00:00.000Z"
    }
  },
  "timestamp": "2026-10-30T08:00:00.000Z"
}
```

POST gửi text/thẻ/ảnh trong phòng có sẵn trả data `{conversationId,message}`;
không yêu cầu field created. Lịch sử trả data là mảng và meta.nextCursor ở
ngoài mảng. Không truyền cùng lúc beforeSequence và afterSequence; tin
before giảm dần, after tăng dần. Client ghép theo id/sequence và hiển thị
thứ tự phù hợp, không dùng sequence tạm để đánh dấu đã đọc hoặc reconnect.

| Trạng thái | Tình huống / cách xử lý |
| --- | --- |
| 200 | Tin canonical đã có; retry hợp lệ trả cùng tin, không thêm bubble mới |
| 400 | UUID/body/query/định dạng ảnh sai hoặc hai hướng phân trang cùng lúc |
| 401 | Token/phiên không hợp lệ; xử lý refresh/logout theo auth hiện có |
| 403 | Bị chặn hoặc không được phép gửi theo trạng thái/ngữ cảnh; dừng gửi và tải lại context |
| 404 | Phòng không tồn tại hoặc ngoài quyền; không tiếp tục mở stream/gửi |
| 409 | clientMessageId cũ được dùng với payload khác; không đổi ID tự động để vượt lỗi |
| 413 | File vượt giới hạn upload; yêu cầu chọn ảnh phù hợp |
| 429 | Vượt hạn mức/rate limit/kết nối SSE; backoff, không tạo vòng retry |
| Mất phản hồi/mạng/5xx | Giữ bubble lỗi và cùng ý định gửi; nếu đã có canonical qua SSE thì coi đã gửi |

Bảng tổng hợp các endpoint, không phải endpoint nào cũng trả mọi mã trên.
Đã gửi khác đã đọc: read cursor do API xác nhận, không suy từ HTTP gửi tin.
Đánh dấu đọc chỉ sau khi tin hiển thị thực sự. Lỗi upload cục bộ cần chọn lại
ảnh nếu cache retry đã hết; không có hàng đợi ảnh bền vững qua khởi động lại.

Ví dụ tin đầu tiên:

```json
{
  "providerId": "33333333-3333-4333-8333-333333333333",
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
  "providerServiceId": "44444444-4444-4444-8444-444444444444"
}
```

Gửi ảnh dùng `multipart/form-data`:

- `clientMessageId`: UUID v4 do client tạo và giữ nguyên khi retry.
- `files`: lặp field này từ 1 đến 4 lần; mỗi file là JPEG, PNG hoặc WEBP hợp lệ, tối đa 5 MB.
- Backend kiểm tra chữ ký nội dung file, loại bỏ metadata ảnh khi upload, giới hạn 12.000 px mỗi chiều và lưu asset dạng `authenticated` trong `lambe/chat/{conversationId}`.
- Response `message.kind = IMAGE`; mỗi phần tử `attachments` có `id`, `url`, `mimeType`, `byteSize`, `width`, `height`, `position`. `url` là URL ký ngắn hạn nên client không lưu làm URL vĩnh viễn; tải lại messages để nhận URL mới khi hết hạn.
- Retry cùng `clientMessageId` và cùng byte ảnh trả lại tin cũ. Dùng cùng ID với ảnh khác trả `409`.

`POST /me/conversations` trả `200`, data `{conversationId, message, created}` cho cả tạo mới và lấy lại; retry cùng clientMessageId trả cùng message. Message có id/sequence/kind/senderUserId/attachments/createdAt và payload theo loại. Inbox trả lastMessage/unreadCount/peer tối thiểu, không có phone/address. PATCH read nhận `{ "lastReadSequence": 42 }`: vượt lastSequence trả 400, gửi lại sequence thấp không hạ vị trí đã đọc. view chỉ chọn inbox, không cấp quyền; quyền owner/worker lấy từ DB theo contract P5E.1.

`POST /orders` không nhận conversationId. Backend xác định phòng trong transaction tạo đơn, gắn conversationId và ORDER_EVENT: cá nhân/legacy dùng cơ chế cũ, đơn tổ chức phân công worker dùng phòng theo P5E.1. OrderNotification bắt buộc có orderId nên không dùng cho tin trước đơn. Chat đã enqueue FCM riêng; Redis chỉ đánh thức SSE, không chứa nội dung tin.

### SSE tin nhắn

Mở `GET /api/me/conversations/:id/events?afterSequence=<sequence cuối đã nhận>` với User Access Token. Server xác minh quyền truy cập hội thoại trước khi mở stream; hội thoại của người khác trả `404`. Response có `Content-Type: text/event-stream`, mỗi tin gồm `id: <sequence>`, `event: message` và `data: <ChatMessage JSON>`. Thứ tự tăng dần; `afterSequence=0` nhận mọi tin chưa đọc từ đầu. Nếu lịch sử dài, mobile nên tải trang đầu qua `GET /messages` rồi mở SSE từ sequence cao nhất để tránh tải lại toàn bộ lịch sử.

Backend chỉ phát tín hiệu hội thoại qua Redis sau khi transaction gửi text, ảnh hoặc tạo đơn commit. Redis Pub/Sub không chứa nội dung tin nhắn; SSE đọc dữ liệu từ PostgreSQL và kiểm tra lại mỗi 5 giây khi Redis gián đoạn. Client kết nối lại sau khi stream đóng ở mốc 30 giây, dùng sequence cuối đã nhận; nếu SSE lỗi thì tiếp tục đồng bộ bằng `GET /messages?afterSequence=...`. Mỗi user tối đa ba kết nối SSE trên một instance, và endpoint có rate limit 30 lần/phút. `401` nghĩa là token/session không hợp lệ; `429` nghĩa là vượt giới hạn kết nối hoặc request.
Mỗi kết nối phát tối đa 1.000 tin rồi tự đóng; client nối tiếp từ `id` cuối cùng. Khi đầu ra mạng chậm, server đóng stream sau khi bộ đệm đầy để tránh tăng bộ nhớ không giới hạn.

Lỗi chuẩn: `401` token không hợp lệ, `404` hội thoại/tin không thuộc người dùng (không để lộ sự tồn tại), `403` tài khoản hoặc nhà cung cấp không được phép nhắn, `409` hội thoại đã chặn hoặc thẻ dịch vụ không còn hợp lệ, `429` vượt rate limit, `400` payload/cursor không hợp lệ. Nếu provider ngừng hoạt động, giữ quyền đọc lịch sử nhưng khóa gửi mới, trừ thông báo xử lý đơn đang có.

## 6. Phân quyền và an toàn

- Mọi query theo conversation ID phải xác minh `customerId === user.id` hoặc `provider.userId === user.id`; không dựa vào `view`, `senderUserId` hay ID trong body. Người có cả hai vai trò vẫn dùng cùng User identity và không thể tự chat với profile của mình.
- Khi tạo hội thoại, thợ phải ở trạng thái hoạt động được công khai; điều kiện service card kiểm tra thêm provider service + service + category đang hoạt động. Không yêu cầu thợ online hoặc đủ ví chỉ để tư vấn.
- Thợ không được tạo cuộc trò chuyện mới với khách nếu chưa có tin mở đầu hoặc đơn từ khách đó. Chặn/báo cáo có rate limit riêng; chống mở hội thoại spam với quota cấu hình và đo lường thực tế.
- Nội dung text là dữ liệu không tin cậy: giới hạn độ dài, validate DTO, escape khi render, không chấp nhận HTML/URL tự động fetch, không cho arbitrary JSON payload từ client. Không ghi text vào audit log.
- Internal admin/moderator không mặc nhiên được đọc toàn bộ chat. Nếu cần chứng cứ tranh chấp, phải có case ID, quyền chuyên biệt, phạm vi hội thoại/thời gian cần thiết và audit ai đã xem. Chính sách retention/cấp quyền cụ thể cần phê duyệt trước production.
- SSE dùng cùng JWT guard và session còn hiệu lực như HTTP. Server lấy user ID từ token và kiểm tra quyền hội thoại trong PostgreSQL; client không tự chọn room. Sau mỗi lần SSE đóng, client dùng `afterSequence` để nối tiếp, PostgreSQL vẫn là nguồn dữ liệu gốc.

## 7. Mobile/UI contract

- Hồ sơ thợ và danh sách thợ: nút **Nhắn tin tư vấn** mở composer, không cần đơn. Nếu chưa đăng nhập, chuyển xác thực rồi quay lại đúng thợ.
- Inbox khách và inbox thợ tách theo `view`; mỗi dòng hiện avatar/tên, tin cuối, thời gian, số chưa đọc. Chưa có API thì không hiển thị như tính năng đã hoạt động.
- Màn chat hiển thị lịch sử, thời gian gửi, trạng thái gửi/thất bại; retry dùng nguyên `clientMessageId` cũ. Khi mở lại app, lấy `afterSequence` sau tin cuối đã lưu. Ảnh được upload bằng endpoint riêng; UI chỉ đánh dấu gửi thành công sau khi nhận message từ backend và phải tải lại URL khi URL ký hết hạn.
- Text, ảnh và thẻ dịch vụ đều hiển thị ngay khi đang gửi. Nếu lỗi, **Gửi lại** dùng cùng clientMessageId và payload; không nhân đôi khi SSE và HTTP cùng trả kết quả. Ảnh retry chỉ nằm trong RAM, tối đa 3 nhóm/20 MiB, xóa sau thành công hoặc dispose notifier; bị loại khỏi cache thì cần chọn lại. Preview tối đa 400×400 và giải phóng image cache khi tháo widget. Cập nhật 30/10/2026, không đổi API gửi tin/ảnh.
- Màn chat chỉ gửi `PATCH /read` sau frame hiển thị tin mới. Khi app tạm dừng, mobile hủy SSE; khi quay lại, mở stream từ sequence đã có và đồng bộ bổ sung bằng REST. Polling 4 giây chỉ là fallback trong lúc SSE gián đoạn.
- Thẻ dịch vụ có tên, giá lúc gửi, thời lượng; CTA **Xem dịch vụ/Đặt lịch** mở luồng quote hiện tại. Nếu giá thay đổi hoặc thợ không còn nhận dịch vụ, hiển thị trạng thái mới và không dùng snapshot cũ để thanh toán.
- Thẻ đơn hiển thị mã/trạng thái và mở API chi tiết đơn của người đang đăng nhập. Trước `ACCEPTED`, không lộ địa chỉ/số liên lạc khách. Không đưa thông tin này vào preview notification.
- Có hành động báo cáo, chặn, bỏ chặn. Trạng thái mạng yếu: tin đang gửi, lỗi và nút thử lại; không nhân đôi tin khi retry.

## 8. Kiểm thử bắt buộc và thứ tự triển khai

1. DB migration, repository và unit test cho unique cặp, sequence đồng thời, idempotency, phân trang, chặn và unread.
2. REST auth/authorization e2e: khách A không đọc/gửi vào chat của B; thợ khác không xem; thợ không nhắn trước; tự chat bị từ chối; service card sai owner/inactive bị từ chối; tài khoản khóa chỉ đọc hoặc bị chặn theo chính sách.
3. Kết nối booking: tạo đơn idempotent, liên kết đúng chat, nhiều đơn trên cùng hội thoại, rollback không để lại event ảo; không làm thay đổi điều kiện quote, giữ lịch, ví và hoa hồng hiện hành.
4. UI polling/sync cơ bản; kiểm tra số tin chưa đọc, retry, reconnect và hiển thị PII trước/sau nhận đơn.
5. Kiểm tra SSE với hai tài khoản, trường hợp token bị thu hồi, Redis gián đoạn, tin đến trễ/lặp và nhiều instance. FCM là phase riêng cho thông báo khi app chạy nền.

**Điểm cần chốt trước production:** thời gian lưu tin/ảnh, quyền hỗ trợ xem hội thoại trong tranh chấp, nội dung bị cấm và quy trình xử lý báo cáo, hạn mức chống spam theo số liệu thực tế. Không coi các điểm này đã được giải quyết bởi thiết kế MVP.
