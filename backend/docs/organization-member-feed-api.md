# Feed thuộc tổ chức, tác giả là thành viên — P5E.3

Cập nhật 29/10/2026. Hoàn thiện ORG-023/ORG-064 ở backend, giữ API Feed cá
nhân và các tương tác like/save/comment/follow hiện có. Không sửa Flutter/React.

## 1. Quyền và cách công khai bài

| Người gọi | Đăng/gắn dịch vụ | Sửa/xóa | Duyệt nội bộ |
| --- | --- | --- | --- |
| Đối tác cá nhân ACTIVE | Dịch vụ ACTIVE của mình | Bài của mình | Không áp dụng |
| Owner tổ chức ACTIVE | Dịch vụ ACTIVE của tổ chức | Bài tổ chức; sửa bài worker vẫn phải duyệt lại | Được duyệt/từ chối đúng revision |
| Worker ACTIVE, được phép cung cấp dịch vụ | Chỉ dịch vụ được cấp ở nhiệm kỳ hiện tại và còn đủ KYC/chứng chỉ | Chỉ bài mình đăng trong đúng nhiệm kỳ | Không được duyệt, kể cả bài của mình |
| Khách/worker khác/owner tổ chức khác | Không | Không | Không |

Không cần online, lịch trống hoặc số dư ví đủ nhận đơn để đăng Feed. Đăng
bài không giữ lịch, trừ ví, thay giá hoặc tự cấp dịch vụ. Mọi quyền được kiểm
tra từ DB, không chỉ dựa vào role PROVIDER trên JWT.

Một bài có hai cổng độc lập:

1. `status`: PUBLISHED/HIDDEN/DELETED, giữ ý nghĩa kiểm duyệt nền tảng cũ.
2. `organizationReview.status`: null/PENDING/APPROVED/REJECTED.

Chỉ public khi `status=PUBLISHED`, cổng nội bộ null hoặc APPROVED, provider
và tài khoản chủ tổ chức ACTIVE. Worker tạo bài → PENDING. Owner tạo bài tổ
chức → APPROVED tự động. Cá nhân và legacy → null (không bắt buộc duyệt).
Vì vậy **status=PUBLISHED riêng lẻ chưa có nghĩa bài worker được công khai**.

REJECT cần lý do, có thể rút bài đã duyệt khỏi public. Owner APPROVE không
mở lại HIDDEN của Lambe; Lambe đưa status về PUBLISHED cũng không vượt qua
REJECTED/PENDING của tổ chức. Không ai dùng các API này để khôi phục DELETED.

Sửa caption hoặc dịch vụ tăng revisionNumber. Bài worker luôn quay về PENDING,
kể cả owner sửa; tạm ẩn toàn bộ bài đến khi duyệt lại, chưa có hai bản draft/
published song song. Like/save/comment hiện có được giữ, không tạo bài mới.

## 2. API tạo và sửa, tiếp tục dùng đường dẫn hiện có

`POST /api/me/feed/posts`, User Access Token, multipart/form-data:

| Field | Yêu cầu |
| --- | --- |
| caption | String trim, 1–2.000 ký tự |
| providerServiceIds | JSON array dạng chuỗi khi multipart, 1–5 UUID không trùng |
| includesCustomer | true/false, bắt buộc |
| hasCustomerConsent | true/false; phải true nếu có hình/nhận diện khách |
| files | 1–6 ảnh JPEG/PNG/WEBP, mỗi ảnh ≤5MB, tổng ≤30MB; hoặc 1 MP4 ≤30MB, ≤60 giây |
| memberId | UUID tùy chọn: membership của chính người đăng để chọn ngữ cảnh tổ chức |

Không nhận providerId, authorMemberId, version tác giả, status hoặc quyết
định duyệt từ client. Nếu không gửi memberId, ưu tiên hồ sơ đối tác do user
sở hữu; nếu không có thì dùng serving membership ACTIVE của user. Người
vừa có hồ sơ riêng vừa là worker nơi khác phải gửi memberId khi đăng ở nơi
đó. Không được chọn member của người khác để giả tác giả.

Upload ở ngoài transaction; sau upload kiểm tra lại provider/user/member,
membershipVersion và chuyên môn dưới khóa. Quyền thay đổi hoặc lưu/audit
thất bại → rollback và dọn media chưa lưu. Không giữ khóa DB khi gọi Cloudinary.
API trả `201` với bài quản lý, kể cả khi worker vừa tạo PENDING.

`PATCH /api/me/feed/posts/:id`, JSON:

```json
{
  "caption": "Mẫu tóc mới vừa thực hiện.",
  "providerServiceIds": ["732f0589-4d37-4627-b0eb-4f46cb5b7118"],
  "revisionNumber": 1
}
```

Caption và serviceIds tùy chọn nhưng phải có ít nhất một nội dung cần sửa.
Nếu gửi revisionNumber phải khớp hiện tại, sai nhận 409. Null caption/array
hoặc field tác giả/trạng thái không hợp lệ nhận 400. Owner sửa bài worker
vẫn chỉ gắn dịch vụ worker đó đủ điều kiện; không lợi dụng quyền quản lý để
đổi người hoặc gắn chuyên môn khác. API không thay ảnh/video đã tải lên.

`DELETE /api/me/feed/posts/:id` xóa mềm có audit, không xóa media/lượt tương
tác hoặc lịch sử. Worker rời/khóa không còn sửa/xóa bài nhiệm kỳ cũ; owner
còn hoạt động có thể rút hoặc xóa bài. Owner/worker bị hạn chế không được
ghi bài; owner vẫn đọc được bài thuộc tổ chức để biết trạng thái.

## 3. Danh sách/chi tiết quản lý

- `GET /api/me/feed/mine`: owner xem bài thuộc tổ chức; worker chỉ bài mình
  đăng của membership/version hiện tại. Khách không có quyền quản lý sẽ nhận
  danh sách rỗng, không được xem bài riêng. Bao gồm PENDING/REJECTED/HIDDEN, bỏ DELETED.
- Query kế thừa providerId/serviceId/cursor/limit (mặc định 20, 1–50), bổ sung
  organizationReviewStatus=PENDING|APPROVED|REJECTED và authorMemberId.
  Owner dùng để làm hàng chờ. Filter không mở rộng quyền worker.
- `GET /api/me/feed/posts/:id/manage`: owner/tác giả hợp lệ đọc bài đầy đủ
  cùng quyết định/lý do nội bộ. Người khác hoặc membership không còn hợp lệ
  nhận 404. Đây là endpoint để mở lại editor, không dùng public detail cho
  bài chưa được duyệt.

Create/PATCH/manage trả envelope chuẩn `data` là bài. Mine/list giữ envelope
cũ: **`data.data[]` là bài, `data.nextCursor` là cursor**, không phải array ở
root. Cursor kiểm tra đúng phạm vi hiện tại trước khi dùng; sai phạm vi hoặc
bài đã đổi trạng thái không còn khớp filter →400, cần tải lại trang đầu.
Ownership được AND với điều kiện cursor; scope rỗng luôn từ chối truy cập.

Ví dụ phần dữ liệu bổ sung trong bài quản lý:

```json
{
  "id": "429790e4-04a9-45c1-8014-0e6031111cbe",
  "status": "PUBLISHED",
  "revisionNumber": 1,
  "provider": { "id": "b476f4b1-1781-4006-a8ca-b5fd06877736", "displayName": "Lambe Beauty Partner", "avatarUrl": null },
  "authorMember": { "id": "216a1b81-4061-42be-b08a-3497522fb430", "displayName": "Nguyễn Văn An", "avatarUrl": null },
  "organizationReview": { "status": "PENDING", "reviewedAt": null, "note": null }
}
```

Bài đầy đủ vẫn có caption, media, services, counts, viewer, createdAt,
updatedAt và sharePath như Feed cũ. Snapshot tên/ảnh tác giả không đổi khi
đổi hồ sơ hoặc nghỉ việc. Bài owner mới dùng tên/ảnh thương hiệu; cá nhân/
legacy có authorMember=null, không tự đoán tác giả cũ.

## 4. Owner ra quyết định

`POST /api/me/feed/posts/:id/organization-review`, User Access Token:

```json
{ "decision": "APPROVE", "revisionNumber": 1 }
```

Hoặc `{ "decision":"REJECT", "revisionNumber":1, "note":"Ảnh chưa thể
hiện sản phẩm rõ." }`. REJECT cần note 5–500 ký tự; APPROVE note tùy chọn.

200 trả bài quản lý. 400 sai body/thiếu lý do; 401 sai phiên; 403 không phải
owner hoặc tác giả/chuyên môn không hợp lệ; 404 bài ngoài phạm vi/đã xóa;
409 revision cũ, quyết định trùng hoặc tác giả thuộc nhiệm kỳ trước.
APPROVE kiểm tra lại author/version và dịch vụ/chứng chỉ. REJECT không đòi
tác giả còn active, để owner rút bài của nhân viên đã nghỉ. Không tự chuyển
tác giả cũ sang người mới; bài từ nhiệm kỳ cũ không được sửa rồi duyệt như
nhiệm kỳ mới. Quyết định và audit ghi chung transaction.

## 5. Public, AI và tương tác

Cùng một cổng hiển thị được dùng trong public Feed/detail/comments/replies,
like/save/comment/report, following/saved, portfolio trên hồ sơ đối tác và
nguồn ảnh Feed cho AI. Bài chưa công khai không được gợi ý vòng qua các API
đó. Các thao tác bỏ like/bỏ save vẫn được dọn dấu cá nhân như trước.

Public trả authorMember (id/tên/ảnh snapshot) và revisionNumber; không có
organizationReview/note/reviewer, membershipVersion, userId tác giả, CCCD hay
KYC. Ảnh Feed dùng Cloudinary public asset như trước; ẩn bài là gỡ khỏi API/
phân phối của Lambe, không thu hồi URL CDN đã biết. Không dùng Feed làm kho
giấy tờ hay ảnh riêng tư. Mẫu API đầy đủ ở Swagger `/docs`.

Bài vẫn thuộc organization. Nút đặt dịch vụ tiếp tục dùng providerServiceId,
discovery/quote và quyền hiện tại; tác giả trong bài lịch sử không tự được
coi là worker còn phục vụ. Theo dõi vẫn là theo dõi đối tác, chưa phải follow
riêng worker. Chưa có push hàng chờ/duyệt trong batch này; owner tải queue API.

## 6. Schema, rollout và kiểm thử

Migration `20261029120000_organization_member_feed` trong transaction: thêm
snapshot author/member/version/role, revision, cổng duyệt và index cho author/
queue; không suy đoán tác giả hoặc đổi nội dung/trạng thái bài legacy. FK và
CHECK/trigger bảo vệ organization/member/version, tác giả bất biến, reviewer
thuộc owner, revision và yêu cầu duyệt lại khi sửa bài worker.

Không thêm dependency hoặc biến môi trường; tiếp tục cấu hình Feed Cloudinary
hiện tại. Không đổi ví, giá, booking hoặc sandbox thanh toán.

**Không rollback về image cũ chỉ bằng cách dừng ghi bài.** Image trước P5E.3
chỉ lọc status=PUBLISHED và có thể lộ bài worker đang PENDING/REJECTED. Cần
image/hotfix hiểu cổng duyệt ở mọi đường đọc Feed/AI/portfolio, hoặc tắt các
đường đọc đó trong cửa sổ rollback. Không xóa cột/quyết định/hạ constraint để
chạy code cũ. Load test, rollback image và nghiệm thu thiết bị vẫn là checkpoint
riêng, chưa được coi hoàn tất bằng migration rehearsal.

Kiểm thử dùng DB `lambe_booking_test_organization_feed_20261029_01`, Redis DB15,
Firebase/email/Cloudinary giả lập. Không integration/seed trên lambe_db.
Đặt cả TEST_DATABASE_URL và DATABASE_URL sang DB thử, rồi chạy:

```powershell
$env:NODE_ENV='test'
$env:TEST_DATABASE_URL='postgresql://postgres:postgres_password@localhost:5433/lambe_booking_test_organization_feed_20261029_01'
$env:DATABASE_URL=$env:TEST_DATABASE_URL
$env:FIREBASE_ENABLED='false'
$env:REDIS_ENABLED='true'
$env:REDIS_URL='redis://127.0.0.1:6379/15'
$env:TEST_REDIS_URL=$env:REDIS_URL
npm run test:organization-feed:migration
npm run test:organization-feed
```

Rehearsal tạo schema riêng rồi rollback: giữ legacy, kiểm tra author/reviewer,
revision và cổng public. 23 integration mới bao phủ quyền, phạm vi/cursor,
duyệt/sửa đồng thời, thu hồi quyền và dọn upload, ảnh/video, legacy qua rehearsal,
cá nhân qua API, AI/portfolio/following/saved và bảo vệ DB khi ghi trực tiếp.

Nghiệm thu Docker Node 22: 745 unit (130 suites), typecheck/typecheck:test/lint
và 204 integration/E2E đạt, gồm 23 Feed, 19 review, 13 chat tổ chức, 18 finance,
20 booking tổ chức, 34 booking cá nhân, 75 membership/KYC/capabilities và 2
SSE chat. 57 migration trên DB thử mới và rehearsal schema riêng thành công.
Container đã cập nhật, health OK, Swagger 307 HTTP operation.

Đối soát DB ứng dụng giữ nguyên 8 user, 1 provider/member, 19 order, 2 review,
1 chat, 31 message, 1 bài Feed/1 media/1 service link; hash nội dung/trạng thái/
timestamp Feed trước và sau trùng nhau. Tổng balance 165.000đ/held 5.000đ
không đổi; không seed hoặc gửi bài thử lên DB ứng dụng. Không thêm dependency;
cảnh báo dependency runtime hiện có tiếp tục theo QA-010A của kế hoạch.
