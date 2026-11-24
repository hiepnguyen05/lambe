# Thông báo vận hành đối tác — P5E.4 / ORG-060

Cập nhật 30/10/2026. Backend có inbox riêng cho chủ hồ sơ đối tác; thông báo
thực hiện đơn vẫn gửi cho khách và người được phân công. Không sửa Flutter/React.

## 1. Phạm vi và người nhận

| Loại | Người nhận | API |
| --- | --- | --- |
| Diễn biến đơn hàng | Khách hoặc worker được phân công; đơn legacy không có member giữ owner cũ | `/api/me/notifications` và `/events` hiện có |
| Ví thiếu số dư, thay đổi thành viên, đối tác đình chỉ | Chủ `ProviderProfile` | `/api/me/provider/notifications` và `/events` mới |

Inbox vận hành dùng User Access Token, không dùng Internal Admin Token. Backend
tự tìm provider từ user hiện tại; không nhận `userId`/`providerId` do client chọn.
Worker, đồng nghiệp hoặc khách không có hồ sơ đối tác sở hữu bị từ chối 403.
Owner còn tài khoản ACTIVE được đọc cảnh báo kể cả profile bị SUSPENDED hoặc
owner không tham gia làm dịch vụ. Token/tài khoản không hợp lệ bị chặn ở auth.

Order notification được lọc thêm theo quan hệ với đơn; bản ghi gửi nhầm owner
không được dùng để đọc đơn có worker khác. Chủ tổ chức vẫn dùng API quản lý đơn
theo quyền đã có, không phải nhận push mời làm đơn thay nhân viên.

Trước enqueue và trước gửi FCM, backend kiểm tra lại người được phân công,
membershipVersion, member ACTIVE, được phép làm dịch vụ, tài khoản và đối tác
ACTIVE. `ORDER_REQUESTED` chỉ gửi khi đơn còn PENDING_PROVIDER và chưa hết hạn
phản hồi. Đổi trạng thái/nghỉ/gia nhập lại không làm push cũ tới người mới.
Lịch sử thông báo đơn của chính khách/người thực hiện cũ được giữ; đọc lịch sử
không khôi phục quyền nhận đơn hoặc quyền thực hiện hành động hiện tại.

## 2. Sự kiện vận hành

| event | Điều kiện | deepLink sau khi đọc chi tiết |
| --- | --- | --- |
| `WALLET_LOW_BALANCE` | Profile ACTIVE, hoàn tất setup, số dư khả dụng dưới ngưỡng | `/provider/wallet` |
| `MEMBER_SUSPENDED` | Member WORKER chuyển sang SUSPENDED | `/provider/members/:memberId` |
| `MEMBER_LEFT` | Member WORKER chuyển sang LEFT | `/provider/members/:memberId` |
| `MEMBER_ACCOUNT_RESTRICTED` | Tài khoản worker không ACTIVE, membership vẫn ACTIVE | `/provider/members/:memberId` |
| `PROVIDER_SUSPENDED` | Hồ sơ đối tác chuyển sang SUSPENDED | `/provider/account` |

Cảnh báo member thuộc tổ chức, gắn đúng `memberId` và `membershipVersion` tại
thời điểm phát sinh. Không gửi tên nhân viên, địa chỉ khách, số tiền hoặc lý do
nhạy cảm qua FCM/Redis. Client lấy chi tiết được phép đọc bằng API phù hợp.

Số dư khả dụng = `balanceAmount - heldAmount`. Ngưỡng đọc cùng cấu hình nhận
đơn `PROVIDER_MIN_RECEIVING_BALANCE`, mặc định 50.000đ; đúng bằng ngưỡng không
tạo cảnh báo thấp. Cảnh báo không yêu cầu owner đang online. Một ví chỉ có một
cảnh báo thấp chưa được giải quyết: cập nhật nhiều lần khi vẫn thiếu tiền
không tạo thêm. Khi đủ tiền hoặc profile không còn thuộc điều kiện cảnh báo,
backend điền `resolvedAt`; một đợt thiếu tiền sau đó có ID cảnh báo mới.

`readAt` và `resolvedAt` độc lập. Đọc cảnh báo không nạp tiền, không mở khóa,
không bàn giao đơn và không giải quyết sự cố. Đã giải quyết nhưng chưa đọc vẫn
tính trong `unreadCount`. Push đang chờ được kiểm tra lại trạng thái thực tế;
cảnh báo ví đã đủ tiền hoặc member đã đổi nhiệm kỳ sẽ không được gửi tiếp.

## 3. Bốn API mới

Mọi REST response thành công dùng envelope toàn cục. Ví dụ danh sách:

```http
GET /api/me/provider/notifications?limit=20
Authorization: Bearer <User Access Token>
```

```json
{
  "statusCode": 200,
  "success": true,
  "data": [{
    "id": "14741a17-16a8-4742-ac20-c0792c3a6d22",
    "providerId": "b476f4b1-1781-4006-a8ca-b5fd06877736",
    "event": "WALLET_LOW_BALANCE",
    "memberId": null,
    "membershipVersion": null,
    "readAt": null,
    "resolvedAt": null,
    "createdAt": "2026-10-30T05:00:00.000Z",
    "recipientRole": "PROVIDER_OWNER",
    "entityType": "PROVIDER_NOTIFICATION",
    "deepLink": "/provider/wallet"
  }],
  "meta": { "nextCursor": null, "unreadCount": 1 },
  "timestamp": "2026-10-30T05:00:01.000Z"
}
```

| Method/path | Đầu vào | Đầu ra |
| --- | --- | --- |
| GET `/api/me/provider/notifications` | `limit` số nguyên 1–50, mặc định 20; `cursor` UUID4 tùy chọn | `data[]`, `meta.nextCursor`, `meta.unreadCount` |
| GET `/api/me/provider/notifications/events` | `after` UUID4 tùy chọn, ID đã nhận từ stream này | SSE thô, không bọc REST envelope |
| GET `/api/me/provider/notifications/:id` | ID UUID4 | `data` là một notice |
| PATCH `/api/me/provider/notifications/:id/read` | ID UUID4, không cần body | `data` là notice có readAt, gọi lại không đổi thời điểm đọc |

REST list sắp xếp `createdAt DESC, id DESC`. Trang kế tiếp dùng `meta.nextCursor`.
`unreadCount` tính toàn inbox, không chỉ trang đang tải. Không có API đánh dấu
tất cả đã đọc hoặc xóa lịch sử trong batch này. Notice không trả số dư ví,
tên/điện thoại khách, tọa độ, giấy tờ, FCM token, internal counter hay dữ liệu outbox.

Lỗi: 400 với query/UUID hoặc cursor không thuộc phạm vi; 401 với token/phiên
không hợp lệ; 403 không phải owner; 404 với detail/read không thuộc owner.
Global rate limit vẫn áp dụng. Không liên tục retry lỗi quyền; 429 cần backoff.

## 4. SSE, reconnect và cập nhật màn hình

```http
GET /api/me/provider/notifications/events?after=14741a17-16a8-4742-ac20-c0792c3a6d22
Authorization: Bearer <User Access Token>
Accept: text/event-stream
```

```text
id: 5a20a0d3-b38f-4c9d-b9f9-43b065174d28
event: notification
data: {"id":"5a20a0d3-b38f-4c9d-b9f9-43b065174d28","event":"MEMBER_LEFT","recipientRole":"PROVIDER_OWNER",...}

```

Payload `data` có cùng cấu trúc notice trong REST, không phải chuỗi chứa
`statusCode/data` thêm một lớp. Ví dụ SSE trên rút gọn các field còn lại.
`after` là query param; không dựa vào header Last-Event-ID tự động của thư viện.
Giữ cursor riêng từng user và từng inbox; không trộn với order notification.

Lần đầu không có `after`: trả tối đa 50 notice đã được phát gần nhất, theo thứ
tự phát. Các lần tiếp theo phát từng đợt tối đa 50 và tự đọc tiếp khi đủ trang.
Backend gán sequence nội bộ sau khi transaction nguồn commit, khóa counter riêng
provider đến commit. Transaction bắt đầu sớm nhưng commit muộn không bị bỏ qua
chỉ vì có createdAt cũ. Sequence không trả ra client, có thể có khoảng trống.
ID từ REST có thể chưa được relay gán thứ tự: **không dùng REST nextCursor làm
SSE after**; chỉ lưu ID đã nhận qua chính stream.

Redis chỉ đánh thức reader; PostgreSQL là nguồn bền vững. Relay chạy mỗi giây,
fallback đọc DB mỗi 10 giây, kết nối đóng sau 30 giây để xác thực lại. Đây là
chu kỳ xử lý, không phải cam kết độ trễ tối đa dưới tải. Client reconnect với
after cuối, backoff khi lỗi mạng, xử lý 401/403 và dedupe bằng notice.id. Khi
không còn quyền, reader đóng stream. Dọn timer/subscription cả khi client đóng
trong lúc subscribe hoặc truy vấn đầu đang chờ.

Stream chỉ phát notice mới, **không phát lại thay đổi readAt/resolvedAt của
notice cũ**. Sau đọc, nạp tiền, khôi phục member, mở lại app hoặc nhận push,
refresh REST để cập nhật badge và trạng thái. Không tăng badge trực tiếp theo
số sự kiện vì có thể nhận lại notice cũ khi reconnect. Không xóa cả danh sách
để hiện spinner mỗi lần có sự kiện; ghép theo ID và refresh nền.

## 5. FCM và điều hướng

FCM data có các chuỗi:

```json
{
  "notificationId": "14741a17-16a8-4742-ac20-c0792c3a6d22",
  "event": "WALLET_LOW_BALANCE",
  "entityType": "PROVIDER_NOTIFICATION",
  "entityId": "14741a17-16a8-4742-ac20-c0792c3a6d22",
  "recipientRole": "PROVIDER_OWNER",
  "deepLink": "/provider/notifications/14741a17-16a8-4742-ac20-c0792c3a6d22"
}
```

Push chỉ chứa lời nhắc chung; ví dụ “Cập nhật ví đối tác”. Khi tap:
xác thực đúng user → GET chi tiết notice → PATCH đã đọc → điều hướng theo
`data.deepLink` hiện tại sang ví/member/tài khoản. FCM deepLink mở notice;
deepLink trong REST mở tài nguyên cần xử lý. 404/403 phải báo không còn quyền
hoặc dữ liệu không còn khả dụng, không lấy providerId từ push để vượt quyền.

`notificationId` cũng được bổ sung cho push hiện có: sourceId của outbox mới,
fallback outbox.id cho bản ghi cũ. FCM có thể gửi lặp nếu worker chết sau khi
gửi trước khi ghi sentAt; UI dedupe notificationId, không hứa exactly-once.
Device phải đăng ký qua API push hiện có; không có thiết bị hợp lệ thì vẫn giữ
inbox REST nhưng không tự phát lại push cũ lúc đăng ký thiết bị mới. Quyền
member/session/device được kiểm tra lại lúc gửi. Có thể vẫn nhận lời nhắc
đã lỗi thời do mạng FCM; luôn đọc trạng thái hiện tại trước hành động.

## 6. Vận hành và migration

Migration `20261030090000_provider_operational_notifications` là migration
mở rộng thứ 58: notice, wallet/account dirty signal, counter và sourceId nullable
trên push outbox. Không sửa giá, số dư, heldAmount, ledger hoặc lịch đặt.
Wallet hiện có được đưa vào hàng chờ đánh giá trạng thái hiện tại, không tạo
lịch sử sự cố giả. Không backfill các lần member/account bị khóa trong quá khứ.

Member/provider status trigger ghi sự kiện cùng transaction nguồn. User status
chỉ ghi account signal để tránh khóa ngược provider khi một request khác đang
giữ khóa đặt lịch. Wallet trigger chỉ coalesce dirty signal; relay đọc trạng
thái đã commit, tối đa 50 wallet/50 account mỗi vòng, không quét toàn bộ ví.
Biến động thấp rồi đủ tiền trước relay có thể được gộp và không tạo cảnh báo
thoáng qua. Quyền nhận đơn vẫn do booking quyết định đồng bộ, không đợi cảnh báo.

Relay khóa provider trước, skip khi bận, không khóa/chờ wallet sau khi giữ
signal. Upsert signal từ giao dịch tiền đồng thời bảo đảm một thay đổi đã
commit không mất việc đánh giá. Dùng unique cho cảnh báo mở/dedup push, outbox
lease và counter DB để chạy nhiều replica. Redis hỏng không chặn enqueue FCM
hoặc replay từ PostgreSQL; phần publish Redis có hàng chờ riêng. Cần theo dõi
backlog signal, notice chưa sequenced/published/pushQueued và outbox thất bại.

Rollback image cũ không hiểu PROVIDER_NOTIFICATION/PROVIDER_OWNER có thể điều
hướng sai push. Trước rollback phải dừng worker gửi cũ, giữ hàng chờ không xóa,
và dùng image tương thích hoặc cô lập các loại mới có kiểm soát. Không drop
bảng hoặc sửa ledger để rollback. Các điều kiện rollback Feed P5E.3 vẫn áp dụng.
Diễn tập migration không thay thế checkpoint rollback image và load test.

Không có bàn giao/reassign đơn tự động, không gửi yêu cầu nhận đơn cho owner
thay worker, không tạo ví cá nhân cho worker. MoMo/SePay vẫn sandbox, không payout.
FCM thật trên thiết bị, UI owner inbox và handoff tiếp tục là checkpoint riêng.

## 7. Kiểm chứng

Kiểm thử mới dùng PostgreSQL riêng `lambe_booking_test_provider_notifications_20261030_01`,
Redis DB15 và FCM giả lập; tuyệt đối không chạy fixture trên lambe_db. 18 case
gồm BOLA/role-negative, cursor/read, episode ví/held/config ngưỡng, lifecycle,
hai relay đồng thời, push đúng worker, thu hồi quyền/hết hạn, commit đảo thứ tự,
SSE mất quyền, provider/wallet lock, Redis down và rollback transaction nguồn.
Có thêm 4 unit test dọn kết nối SSE, policy và OpenAPI regression. Kết quả
hồi quy/Docker cuối đợt được ghi trong checklist P5E.4 của file kế hoạch.

Bản cuối ngày 30/10: `npm run check` trong Docker Node 22 đạt typecheck/lint
và 754 unit test (133 suite). Tổng 222 integration/E2E đạt: notification 18,
Feed 23, review 19, chat tổ chức 13, tài chính 18, đặt lịch tổ chức 20,
booking 34, member 75 và chat SSE 2. Migration đã áp dụng vào app; container
healthy, health OK, Swagger 311 operation, bốn API mới đều 401 khi thiếu JWT.
Đối chiếu số lượng dữ liệu cùng hash Feed/ví trước–sau đạt; balance 165.000đ,
held 5.000đ giữ nguyên. Chưa kiểm chứng delivery/deep link trên thiết bị thật
hoặc load/rollback image; không coi các kết quả này là nghiệm thu production.
