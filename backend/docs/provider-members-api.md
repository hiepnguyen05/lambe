# Thành viên tổ chức — P5A.1 và P5A.2

Cập nhật 28/10/2026. Base URL `/api`, Bearer **User Access Token** của Lambe
cho API người dùng; API kiểm duyệt/vận hành dùng **Internal Access Token**.
Các nhóm membership/lời mời trong Swagger: `Provider Members`,
`Provider Member Invitations`, `My Provider Invitations`. Các nhóm KYC và
vận hành được mô tả trong [Member Verification API](provider-member-verification-api.md).

## Phạm vi đã triển khai

Tổ chức giữ hồ sơ kinh doanh, dịch vụ, giá, voucher và ví. Thành viên là tài
khoản người dùng có SĐT đã xác minh. `OWNER` quản lý tổ chức; `WORKER` sẽ trực
tiếp thực hiện dịch vụ sau khi đủ điều kiện xác minh.

Đã có membership/lời mời, KYC và giấy tờ riêng tư, kiểm duyệt từng tài liệu,
yêu cầu bổ sung/từ chối/duyệt, kích hoạt/đình chỉ/khôi phục worker và gia hạn
chứng chỉ. Xem [Member Verification API](provider-member-verification-api.md)
cho 21 endpoint P5A.2. [Năng lực thành viên P5B](provider-member-capabilities-api.md)
có 22 endpoint cấp dịch vụ, lịch/nghỉ phép, bán kính, online/GPS và công tắc tổ chức.
[Booking nhiều member P5C](organization-booking-api.md) đã có lịch riêng,
Discovery, quote, rematch và quyền thực hiện theo assigned member. Không tạo
profile hay ví riêng cho worker. Legacy order không gắn member giữ lịch chung.

`canProvideServices=true` biểu thị membership đăng ký trực tiếp làm dịch vụ,
không phải kết luận đã đủ điều kiện nhận đơn. Phải kiểm tra thêm status, KYC,
dịch vụ, lịch, bán kính, phiên vị trí và ví chung khi xét nhận đơn.

Trong batch chuyển tiếp, owner quản trị phải đồng thời là `ProviderProfile.userId`
và có membership `OWNER/ACTIVE`. Chưa mở API chuyển owner, cấp thêm owner,
đổi role hoặc kích hoạt bằng dữ liệu client.

## API

| Method | Endpoint | Người dùng và tác dụng |
| --- | --- | --- |
| GET | `/me/provider/members` | Owner xem thành viên tổ chức, gồm lịch sử LEFT |
| GET | `/me/provider/memberships` | Mọi user xem membership chưa LEFT của chính mình |
| POST | `/me/provider/memberships/:id/leave` | Pending rời; ACTIVE cần KYC hiện hành và kiểm tra nghĩa vụ |
| GET | `/me/provider/member-invitations` | Owner liệt kê lời mời của tổ chức |
| POST | `/me/provider/member-invitations` | Owner tạo lời mời theo SĐT |
| POST | `/me/provider/member-invitations/:id/resend` | Owner cấp lại token và hạn dùng |
| POST | `/me/provider/member-invitations/:id/revoke` | Owner thu hồi lời mời |
| GET | `/me/provider-invitations` | User xem lời mời gửi tới SĐT của mình |
| POST | `/me/provider-invitations/:id/accept` | User chấp nhận bằng token và SĐT đúng |
| POST | `/me/provider-invitations/:id/decline` | User từ chối bằng token và SĐT đúng |

Các API danh sách có phân trang nhận `page=1..1000`, `limit=1..50`
(mặc định 1/20), trừ `/memberships` chỉ trả tối đa 50 membership chưa rời của
chính mình. API quản trị trả danh sách mới tham gia/tạo trước; trường hợp
không có dữ liệu trả `data: []`. Response thành công dùng envelope toàn hệ thống:
`{statusCode, success, data, timestamp}`.

### Tạo và chia sẻ lời mời

```http
POST /api/me/provider/member-invitations
Authorization: Bearer <owner-access-token>
Content-Type: application/json
```

```json
{"phone":"+84912345678"}
```

Response HTTP 201:

```json
{
  "statusCode": 201,
  "success": true,
  "data": {
    "id": "c1aeffcd-0e68-4f9f-8da8-2e60cb7334dc",
    "providerId": "ff9beef6-2bad-49bd-a4e0-9d46d67e0f4c",
    "phone": "0912345678",
    "status": "PENDING",
    "expiresAt": "2026-11-03T09:00:00.000Z",
    "respondedAt": null,
    "revokedAt": null,
    "lastSentAt": "2026-10-27T09:00:00.000Z",
    "createdAt": "2026-10-27T09:00:00.000Z",
    "token": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  },
  "timestamp": "2026-10-27T09:00:00.000Z"
}
```

Token ví dụ không sử dụng thực tế. Backend tạo token ngẫu nhiên 32 byte và chỉ
lưu SHA-256. Plaintext chỉ xuất hiện khi tạo/cấp lại; list/inbox/audit không
trả hoặc ghi token, hash, KYC. UI chỉ giữ token trong bộ nhớ để owner chia sẻ
riêng cùng invitation ID. Không gửi token vào analytics, log hoặc nội dung
thông báo công khai. Batch này chưa tự gửi SMS/email và chưa cung cấp deep link.

Không yêu cầu SĐT đích đã có tài khoản lúc mời; không trả kết quả tra cứu tài
khoản. Người nhận đăng ký/đăng nhập bằng đúng SĐT đó trước khi phản hồi. SĐT
`0`, `84`, `+84` được chuẩn hóa về `0`. Không cho owner tự mời mình.

Hạn dùng 7 ngày, tối đa 50 lời mời chưa hết hạn ở mỗi tổ chức. Một SĐT chỉ
có một lời mời PENDING trong cùng tổ chức. Create/resend/accept/decline có
giới hạn 10 request/phút/IP bên cạnh giới hạn toàn cục.

### Nhận lời mời

```http
POST /api/me/provider-invitations/c1aeffcd-0e68-4f9f-8da8-2e60cb7334dc/accept
Authorization: Bearer <invited-user-access-token>
```

```json
{"token":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}
```

HTTP 200 trả `data: {invitationId, status: "ACCEPTED", member}`. `member`
gồm `id, providerId, userId, role, status, canProvideServices, displayName,
avatarUrl, joinedAt, leftAt, membershipVersion`. Role luôn `WORKER`, status luôn
`PENDING_VERIFICATION`. Client không được gửi role/status/userId/providerId.

Account phải ACTIVE, có `phoneVerifiedAt`, đúng SĐT lời mời và có token đúng.
Đang có serving membership PENDING_VERIFICATION/ACTIVE/SUSPENDED, profile
đối tác riêng hoặc application DRAFT/PENDING_REVIEW/NEEDS_CHANGES thì không
được tham gia. MVP chuyển tiếp chưa hỗ trợ chuyển tài khoản đối tác cá nhân
sang worker hay owner sang tổ chức khác.

Khi nhận lời mời, backend upsert role `PROVIDER` để mở khu vực đối tác. Role
này không cấp quyền quản trị tổ chức, đọc ví, đọc đơn người khác hoặc bỏ qua
KYC. `/memberships` là nguồn xác định tổ chức và trạng thái membership.

Decline dùng cùng body, trả `{invitationId, status: "DECLINED", member: null}`.
Không tạo membership, role hoặc ví khi từ chối. Replay accept/decline trả 409.

### Gửi lại, thu hồi và hết hạn

Resend chỉ dành cho PENDING/EXPIRED, cách lần cấp token trước ít nhất 60 giây.
Trả HTTP 200 với token mới, vô hiệu token cũ ngay và gia hạn 7 ngày.
REVOKED/ACCEPTED/DECLINED không resend; owner tạo lời mời mới nếu cần.

Revoke chỉ xử lý PENDING; gọi lại REVOKED trả trạng thái hiện tại. Không xóa
lịch sử. Lời mời quá hạn được hiển thị EXPIRED ngay từ thời điểm hết hạn, dù
row chưa được dọn; mọi phản hồi đều kiểm tra lại hạn dùng trong transaction.

### Rời tổ chức

Worker PENDING_VERIFICATION có thể gọi `/memberships/:id/leave` không có body.
Status chuyển LEFT, lưu `leftAt`, giữ row/audit và giải phóng serving membership.
Gọi lại LEFT không ghi thêm audit. Gia nhập lại cùng tổ chức bằng lời mời mới
dùng lại member ID, tăng membershipVersion và quay về PENDING_VERIFICATION.
Hồ sơ KYC cũ được giữ riêng theo version; phải xác minh lại ở lần gia nhập mới.

OWNER không thể rời qua API này. ACTIVE được rời khi KYC hiện hành APPROVED
và member không còn đơn/lịch/hold/sự cố/yêu cầu hủy chưa xong. P5C đã kiểm tra
theo assigned member; riêng nghĩa vụ legacy chưa phân công vẫn chặn toàn tổ chức.
SUSPENDED cần vận hành xử lý trước, không thể tự rời để bỏ qua đình chỉ.
Role PROVIDER có thể vẫn tồn tại sau khi rời; không dùng role này để suy ra
membership hoạt động.

## Quyền và mã lỗi

- 400: SĐT, UUID, token hoặc phân trang sai; gửi thêm field ngoài contract.
- 401: JWT/session thiếu, hết hạn, bị thu hồi hoặc user không hoạt động.
- 403: không phải owner; owner/member không đủ điều kiện quản trị; owner muốn rời.
- 404: lời mời/membership không thuộc phạm vi truy cập; token sai hoặc sai SĐT.
- 409: hết hạn, đã xử lý, trùng lời mời/membership, resend quá sớm, vượt quota,
  tổ chức đình chỉ hoặc phải liên hệ hỗ trợ trước khi rời.
- 429: vượt giới hạn request.

Owner chỉ quản trị tổ chức của chính mình. Worker chỉ đọc membership/inbox của
mình. Không dùng role client gửi lên và không tạo profile giả cho worker để
đi vòng qua API thương mại cũ.

## Transaction và ràng buộc dữ liệu

Writer lời mời khóa organization trước; response/leave khóa tiếp user. Application
creation và approval dùng chung user lock để ngăn race giữa đăng ký đối tác và
gia nhập tổ chức. Kiểm tra trạng thái, ghi membership/role/invitation và audit
nằm trong cùng transaction. Không gọi dịch vụ ngoài trong vùng khóa.

PostgreSQL có unique `(providerId,userId)`, partial unique một serving membership
chưa LEFT/user (gồm cả pending/suspended), partial unique một lời mời PENDING
theo organization/phone, CHECK trạng thái LEFT phải đi cùng `leftAt` và CHECK
định dạng phone/hash. Hai lần accept hoặc hai tổ chức tranh cùng một worker
chỉ một request thành công. Audit thất bại rollback toàn bộ thay đổi.

## Migration, triển khai và rollback

`20261027130000_provider_members` chỉ thêm bảng, enum và index; tạo owner cho
mọi provider hiện có. Cá nhân là OWNER/ACTIVE/canProvideServices=true. Owner
tổ chức là OWNER/ACTIVE/canProvideServices=false, dùng tên/avatar người đại diện
thay cho tên thương hiệu khi có dữ liệu. Hồ sơ được duyệt mới tạo owner cùng
transaction với profile, ví và dịch vụ.

Chạy migration trước khi khởi động image mới. Khi rollback, chạy lại image cũ
và giữ nguyên các bảng mới để bảo toàn membership/audit. Tạm dừng duyệt hồ sơ
đối tác trong thời gian rollback; code cũ chưa tạo owner. Nếu vẫn phát sinh
provider trong giai đoạn đó, phải đối soát và backfill owner thiếu trước khi
mở lại tính năng membership. Không xóa bảng mới để rollback sau khi đã có lời mời.

Kiểm thử dùng database riêng `lambe_booking_test_*`, không trỏ vào `lambe_db`:

```powershell
$env:TEST_DATABASE_URL="postgresql://postgres:<password>@localhost:5433/lambe_booking_test_members"
npm run test:provider-members
npm run test:provider-members:migration
```

Lệnh thứ hai chạy fixture schema tạm trong database kiểm thử để xác minh backfill
cá nhân/tổ chức, UUID chuẩn và tính tương thích bảng cũ; schema fixture được xóa
sau khi đạt kiểm tra. Lệnh không áp dụng rollback hay xóa dữ liệu ứng dụng.
