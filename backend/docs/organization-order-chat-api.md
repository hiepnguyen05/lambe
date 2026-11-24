# Chat theo nhân viên và đơn tổ chức — P5E.1

Cập nhật 29/10/2026. Base `/api`, Bearer User Access Token Lambe. P5E.1 mở
chat cho assigned worker; review/feed/handoff tự động còn các batch P5E sau.
Không chỉnh giao diện trong batch này, không thêm dependency.

## 1. Hai loại hội thoại

| context.type | Người tham gia | Nguồn tạo |
| --- | --- | --- |
| CONSULTATION | Khách và chủ/đại diện provider | Khách gửi tin đầu qua POST /me/conversations |
| ORDER | Khách, tổ chức và đúng assigned worker | Server tạo khi đặt đơn tổ chức có member |

Một cặp customer/provider vẫn có **một hội thoại tư vấn** dài hạn. Đơn cá
nhân hoặc legacy chưa assigned giữ liên kết tư vấn hiện có. Mỗi đơn tổ chức
assigned có phòng riêng và ID riêng; lần đặt tiếp hoặc rematch có phòng khác
dù cùng khách/tổ chức. Không chuyển toàn bộ lịch sử tư vấn cho worker.
Không có API tự thêm người, đổi owner của phòng hoặc tạo nhóm tùy ý.

Worker được thêm vào participant state cùng transaction tạo đơn, kèm audit
ORDER_CHAT_MEMBER_GRANTED có orderId/memberId/membershipVersion; không chứa
địa chỉ, KYC hoặc nội dung chat. Nhận đơn không phải điều kiện mở chat: worker
được khách chọn có thể trao đổi khi đang PENDING_PROVIDER. Chat không đồng
nghĩa đã nhận đơn, giá chốt hay chấp thuận đổi giờ/add-on.

Đơn không được tự đổi worker. Nếu A từ chối rồi khách chọn B, đơn B/phòng B
mới, B không đọc phòng A. Tư vấn trước đơn vẫn của tổ chức, worker không đọc
được kể cả có participant row sai. Quyền dựa vào quan hệ order/member thật,
không dựa vào việc client đưa chatId/memberId hay có một row trong bảng participants.

## 2. Quyền

- Khách chỉ vào hội thoại của mình; owner chỉ vào hội thoại của provider mình.
- Worker chỉ vào ORDER của đúng assignedMemberUserId + memberId/version;
  member ACTIVE/canProvideServices, user và provider/owner ACTIVE. Không bắt
  online/GPS/ví đủ tiền chỉ để chat, không dùng role PROVIDER làm quyền đọc.
- Worker LEFT/SUSPENDED, tài khoản/tổ chức bị khóa hoặc đã sang version mới
  mất quyền chat cũ. Gia nhập lại không khôi phục phòng của version trước.
  Khác lịch sử thu hộ P5D, chat không cấp ngoại lệ đọc cho người đã rời/khóa.
- Owner/khách vẫn đọc được lịch sử sau khi worker mất quyền. Đơn REJECTED,
  CANCELLED hoặc EXPIRED có phòng chỉ đọc; không gửi tin/ảnh mới vào phòng
  đó. Tổ chức không ACTIVE cũng làm phòng chỉ đọc. COMPLETED không xóa lịch
  sử hoặc tự khóa trao đổi hậu mãi theo một hạn ngày chưa được chốt.
- Chặn là theo conversation, không phải chặn mọi phòng của cả tổ chức.
  Nó không tự hủy đơn hoặc chặn thông báo nghiệp vụ của đơn.
- Hỗ trợ chưa có API đọc hội thoại riêng qua internal token ở batch này;
  không cho dùng token nhân viên/khách để giả danh. Handoff hỗ trợ còn mở.

## 3. API mới: ngữ cảnh và người gửi

GET `/me/conversations/:id` trả standard envelope `data`:

```json
{
  "id": "conversation-uuid",
  "providerId": "provider-uuid",
  "context": {
    "type": "ORDER",
    "orderId": "order-uuid",
    "assignedMember": { "id": "member-uuid", "displayName": "Nguyễn Văn An", "avatarUrl": null },
    "workerCanChat": true,
    "readOnly": false
  },
  "participants": [
    { "userId": "customer-user-uuid", "role": "CUSTOMER", "displayName": "Khách", "avatarUrl": null },
    { "userId": "owner-user-uuid", "role": "ORGANIZATION", "displayName": "Tên tổ chức", "avatarUrl": null },
    { "userId": "worker-user-uuid", "role": "MEMBER", "displayName": "Nguyễn Văn An", "avatarUrl": null }
  ]
}
```

CONSULTATION có orderId/assignedMember=null, workerCanChat=false; false này
không có nghĩa owner/khách bị khóa. Với provider cá nhân, role đại diện là
PROVIDER. Nếu owner đồng thời là assigned worker thì chỉ một dòng owner,
không nhân đôi người nhận push. Dùng senderUserId trên tin để đối chiếu
participants, không gọi User/KYC để lấy tên. Tên/ảnh worker là snapshot đơn,
không lộ CCCD, SĐT, giấy tờ hoặc GPS. Participant ID chỉ trong API đã xác thực.

## 4. Những API cũ được nâng cấp

| Method | Path | Hành vi |
| --- | --- | --- |
| POST | `/me/conversations` | Chỉ mở/lấy tư vấn; providerId,clientMessageId,text |
| GET | `/me/conversations?view=customer|provider` | Inbox có thêm context; provider gồm owner và phòng assigned worker còn quyền |
| GET | `/me/conversations/:id/messages` | Tin cũ/afterSequence; kiểm tra quyền hiện hành mỗi lần |
| POST | `/me/conversations/:id/messages` | TEXT/SERVICE_CARD, idempotency theo clientMessageId |
| POST | `/me/conversations/:id/images` | Multipart clientMessageId + 1–4 files riêng tư |
| PATCH | `/me/conversations/:id/read` | lastReadSequence không lùi, không vượt sequence hiện có |
| PUT/DELETE | `/me/conversations/:id/block` | Chặn/bỏ chặn trong đúng phòng |
| POST | `/me/conversations/:id/reports` | Báo cáo nội dung đúng phòng và đúng message |
| GET | `/me/conversations/:id/events?afterSequence=N` | SSE theo sequence; mất quyền đóng stream |

Khách mở chat từ đơn bằng **order.conversationId mới trả về**. Không lấy lại
chat từ cặp customer/provider để mở chat thực hiện đơn. Không gửi memberId,
scopeKey hay bookingOrderId trong body start: server tự quyết định ngữ cảnh.

Body text: `{clientMessageId:<UUID4>,kind:"TEXT",text:"..."}`; tối đa 2000 ký
tự. Thẻ dịch vụ dùng SERVICE_CARD/providerServiceId, không text. Card là
thông tin tham khảo của dịch vụ ACTIVE trong cùng provider, không tự thêm
vào đơn hay bỏ qua quote/phân công/chứng chỉ. TEXT/IMAGE giữ orderId=null
theo constraint tin hiện có; ORDER_EVENT mới có orderId. Ngữ cảnh phòng lấy
qua GET detail/inbox context, không tự ép mọi tin thành ORDER_EVENT.

Retry cùng ID/nội dung không tạo tin, upload hoặc push mới; khác nội dung
cùng ID trả 409. Ảnh JPEG/PNG/WEBP, tối đa 5 MB/ảnh, tối đa 4 ảnh/tin, raster
được xác minh, lưu authenticated. Upload ngoài transaction; trước commit
kiểm tra lại quyền sau khi khóa. Nếu bị revoke khi upload thì không ghi tin,
dọn ảnh đã tải, không trả signed URL. Signed URL đã cấp trước đó có thể còn
hiệu lực tới TTL đã cấu hình; không tuyên bố thu hồi được bản đã tải/cached.

## 5. Envelope và phân trang tương thích

Không đổi cấu trúc cũ của inbox/messages trong batch này. Với interceptor
toàn cục, GET inbox/messages có outer `data` chứa `{data:[...],meta:{nextCursor}}`.
Danh sách là `response.data.data`, cursor là `response.data.meta.nextCursor`.
POST start/send/images có `response.data.conversationId/message`.
GET detail mới có `response.data.context/participants` trực tiếp.
Client đã unwrap một lớp envelope cần điều chỉnh đường truy cập tương ứng,
không cố unwrap data nhiều lần không kiểm tra kiểu.

Inbox thêm context cho mỗi dòng, peer/lastMessage/unreadCount/blockedByMe giữ
nghĩa cũ. `view=provider` là phía phục vụ, **không đồng nghĩa có quyền owner**.
Cursor được kết hợp AND với điều kiện ownership/member/version; cursor từ
phòng người khác không mở rộng danh sách. beforeSequence/afterSequence của
messages giữ cách dùng cũ, không gửi đồng thời hai hướng.

## 6. Realtime và push

Tin được commit trước Redis publish. SSE subscribe trước read, phát theo
sequence tăng dần, reconnect sauSequence để tránh thiếu/trùng, tối đa 30 giây
mỗi kết nối. Mỗi lần đọc lại xác thực phạm vi member/version; Redis event
kích hoạt kiểm tra ngay, fallback SQL mỗi 5 giây. Mất quyền đóng stream,
không gửi thêm nội dung. Mobile reconnect phải xử lý 401/404, không quay
polling liên tục bằng ID đã bị thu hồi.

Tin mới enqueue push cho các bên còn quyền khác người gửi: tối đa khách +
owner + worker, loại trùng khi owner là người làm. Không gửi cả bản text hoặc
URL ảnh/địa chỉ trong lock-screen payload. Push dùng chat room ID để mở đúng
phòng, không mở tư vấn theo providerId. Trước giao FCM, outbox kiểm tra lại
quyền chat; bị thu hồi thì bỏ bản chờ, không giao thông báo cũ cho worker
mới/đã khóa. Lỗi DB tạm thời giữ chính sách retry, không coi là mất quyền.
Thành công enqueue không phải bằng chứng thiết bị thật đã nhận FCM.

## 7. Dữ liệu và khóa

ChatConversation bổ sung scopeKey (CONSULTATION hoặc orderId) và bookingOrderId
unique/FK; unique cặp đổi thành customerId/providerId/scopeKey. Phòng ORDER
phải khớp customer/provider của assigned order; ngữ cảnh bất biến. Trigger
chặn order trỏ vào phòng của đơn khác. Không tạo member mới bằng chat.

Ghi chat assigned lấy shared lock provider → serving user → member, rồi
exclusive lock conversation và kiểm tra lại quyền để đồng bộ với lifecycle.
Các phòng độc lập cùng tổ chức không khóa ghi chéo; booking/lifecycle vẫn
có thể giữ khóa riêng trong transaction ngắn. Không gọi Cloudinary/Redis/FCM
dưới khóa SQL. Inbox dùng một lookup active membership và lọc trong DB,
không query theo từng phòng. Chưa đo throughput/p95 production hoặc tổng
số SSE nhiều replica từ kiểm thử chức năng đồng thời.

Migration `20261029100000_order_member_chat` tạo phòng riêng cho assigned
orders đã có, cấp đúng ba bên và ghi audit nguồn MIGRATION. Chỉ thêm system
event, **không sao chép tin/ảnh tư vấn cũ**, không phát push hàng loạt. Legacy
unassigned giữ liên kết cũ. App phải refetch order.conversationId sau cập nhật.
Đã rehearsal schema tạm và apply trên database test, gồm bảo toàn private
text, phân công A/B, audit và link fence.

Không rollback thẳng về image trước P5E: code cũ giả định một phòng/cặp và
unique cũ đã được thay. Ngay cả drain hết đơn, lịch sử nhiều phòng vẫn tồn
tại. Rollback phải là image tương thích scope (hoặc hotfix tiến tới); không
drop phòng/ảnh/tin hoặc phục hồi unique cũ bằng xóa dữ liệu. ORG-025 vẫn mở
về diễn tập rollback image đầy đủ; rehearsal schema không thay bước đó.

## 8. Kiểm thử và phần còn lại

13 HTTP/PostgreSQL/Redis tests qua AppModule: tư vấn private dù có participant
giả, room/audit idempotent, gửi ba bên, hai đơn cùng tổ chức, inbox cursor BOLA,
ảnh/retry, revoke REST/SSE, rejoin version, image upload đang revoke, read-only
đơn từ chối, database link/context fence và phòng B vẫn ghi khi phòng A cùng
tổ chức đang giữ khóa. Có test outbox bỏ push khi mất
quyền. Kết quả hồi quy/Docker ghi trong file kế hoạch, không suy ra tải
production từ fixture hoặc thay checkpoint thiết bị FCM.

Nghiệm thu 29/10: 742 unit, 13 chat mới, 20 booking tổ chức, 34 booking cá
nhân, 18 finance và 2 SSE chat cũ đạt; bốn bộ chat mới/cá nhân/finance/SSE đã
chạy trên Node 22 Linux Docker. Typecheck/test typecheck/lint đạt. Docker
đã áp migration, health/Swagger 200 và 304 HTTP operation; GET detail không
token trả 401. Dữ liệu ứng dụng giữ nguyên 8 user, 1 provider, 19 order,
1 chat, 31 message và số dư/tiền giữ trong ví. Không có tin/push migration
hàng loạt ở ứng dụng local vì chưa có assigned order cần backfill; backfill
có dữ liệu đã được kiểm thử trong schema/database test riêng.

Chưa hoàn tất toàn P5E: review hai cấp, Feed author member, cảnh báo ví owner,
luồng hỗ trợ/handoff khi worker đình chỉ, internal chat moderation view và
checkpoint mobile còn theo roadmap. Không tự gán người khác khi khóa worker.

Cập nhật tiếp theo 29/10/2026: [review hai cấp P5E.2](organization-member-reviews-api.md)
đã hoàn thành backend; các mục Feed, cảnh báo/handoff và checkpoint còn mở.
