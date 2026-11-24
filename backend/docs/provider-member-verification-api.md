# KYC và vòng đời thành viên tổ chức — P5A.2

Cập nhật 28/10/2026. Base URL `/api`. Thành viên tổ chức và lời mời xem
[Provider Members API](provider-members-api.md). Có 21 endpoint bổ sung trong
batch này, dùng envelope `{statusCode, success, data, timestamp}`.

## Phạm vi và quyền

WORKER bắt đầu ở PENDING_VERIFICATION. Họ tự khai thông tin, tải giấy tờ,
chọn dịch vụ của tổ chức để xét chuyên môn và gửi kiểm duyệt. ADMIN,
MODERATOR hoặc KYC_REVIEWER xác minh từng giấy tờ rồi quyết định duyệt,
yêu cầu bổ sung hoặc từ chối. Khi duyệt, membership ACTIVE và
`canProvideServices=true`; chưa tạo ví, profile cá nhân hay quyền nhận đơn.
Cấp dịch vụ/lịch/GPS/booking theo worker thuộc P5B/P5C.

OWNER có thể tự nộp KYC để trực tiếp làm dịch vụ nhưng vẫn giữ quyền quản trị
trong lúc xét duyệt. Owner khác không được đọc KYC của worker; họ chỉ thấy
`verificationStatus` trong danh sách thành viên. SUPPORT được xem dữ liệu
vận hành/đình chỉ và xử lý khóa, không được xem giấy tờ hoặc CCCD.
SERVICE_REVIEWER không có quyền KYC thành viên trong batch này.

Mỗi lần gia nhập có `membershipVersion`. Rời rồi nhận lời mời mới giữ member
ID, tăng version và bắt đầu hồ sơ KYC mới. Hồ sơ cũ không tự kích hoạt lại.
Mỗi lần nộp tăng `revisionNumber` và lưu snapshot riêng tư. Mọi thao tác
xét duyệt cần cả `verificationId` và `revisionNumber` đúng với dữ liệu hiện hành.

## Endpoint cho chính thành viên — User Access Token

Prefix `P = /me/provider/memberships/:memberId/verification`.

| Method | Endpoint | Dữ liệu gửi/nhận |
| --- | --- | --- |
| GET | `P/options` | Điều khoản, loại ảnh và tối đa 200 dịch vụ ACTIVE của tổ chức |
| GET | `P` | Hồ sơ hiện hành hoặc `data:null` khi chưa lưu |
| PUT | `P` | Lưu đầy đủ thông tin cá nhân và điều khoản |
| POST | `P/submit` | Body rỗng; kiểm tra đầy đủ, tạo snapshot và chuyển PENDING_REVIEW |
| POST | `P/reopen` | `{reason,documentIds}` để cập nhật hồ sơ APPROVED |
| POST | `P/documents` | Query metadata + multipart `file`, một ảnh/lần |
| DELETE | `P/documents/:documentId` | Bỏ ảnh khỏi bản hiện hành, giữ lịch sử riêng tư |
| GET | `P/documents/:documentId/access` | URL xem ảnh có hạn; có audit và `Cache-Control:no-store` |

### Options và lưu thông tin

`GET P/options` trả `termsVersion`, `termsText`, `documentTypes`,
`maxImageSizeBytes`, `services`. Mỗi service là:

```json
{
  "id": "f7792b77-ccf5-4ea4-a4c4-d72b37252bbd",
  "service": {
    "id": "83ee0216-2d52-4c81-b761-984a974dd8cc",
    "name": "Cắt tóc nam",
    "requiresCertificate": true,
    "minExperienceYears": 1,
    "minPortfolioImages": 1
  }
}
```

`id` ngoài là **ProviderService ID**; `service.id` là catalog Service ID.
Chọn ID ngoài cho hồ sơ và giấy tờ. Đây là đề nghị xét chuyên môn, không phải
quyết định cấp dịch vụ cho worker.

`PUT P` khi DRAFT hoặc NEEDS_CHANGES:

```json
{
  "legalFullName": "Nguyễn Văn An",
  "birthDate": "1995-08-20",
  "gender": "MALE",
  "nationalIdNumber": "001095012345",
  "experienceYears": 3,
  "requestedProviderServiceIds": ["f7792b77-ccf5-4ea4-a4c4-d72b37252bbd"],
  "termsVersion": "member-2026-10-27",
  "acceptedTerms": true
}
```

Tất cả trường trên bắt buộc. Họ tên 2–100 ký tự, ngày sinh YYYY-MM-DD hợp lệ
và đủ 18 tuổi, gender MALE/FEMALE/OTHER, CCCD đúng 12 chữ số, kinh nghiệm
0–80, 1–20 ProviderService ID không trùng và thuộc tổ chức. Lấy termsVersion
thực tế từ options. Mỗi lần lưu phải xác nhận điều khoản; thời điểm lấy từ server.

Response hồ sơ có `id,memberId,membershipVersion,status,revisionNumber,
legalFullName,birthDate,gender,experienceYears,nationalIdMasked,
requestedProviderServiceIds,termsVersion,termsAcceptedAt,submittedAt,
reviewedAt,decisionReason,documents`. Không trả ciphertext, hash hay CCCD rõ.
Với form sửa, CCCD cần nhập lại; không gửi chuỗi `********2345` làm CCCD.

CCCD dùng chung AES-256-GCM và identity claim với đăng ký đối tác. Một CCCD
đã được tài khoản khác khai nhận không được tái sử dụng. Đổi họ tên/ngày sinh/
giới tính/CCCD làm bốn giấy tờ danh tính trở về PENDING để đối chiếu lại.

### Tải và bổ sung giấy tờ

Các type: PORTRAIT, ID_CARD_FRONT, ID_CARD_BACK, IDENTITY_SELFIE,
PROFESSIONAL_CERTIFICATE, PORTFOLIO. Bốn loại đầu bắt buộc cho danh tính.
Chứng chỉ/portfolio phải đáp ứng yêu cầu từng dịch vụ khi nộp và duyệt.

```http
POST P/documents?type=PROFESSIONAL_CERTIFICATE&providerServiceId=<ProviderService-ID>&expiresAt=2028-12-31T16:59:59Z
Content-Type: multipart/form-data
Authorization: Bearer <worker-token>
```

Body chỉ có trường file nhị phân `file`. Metadata đi qua query:

| Query | Quy tắc |
| --- | --- |
| `type` | Một trong sáu loại kể trên |
| `providerServiceId` | Bắt buộc cho chứng chỉ; tùy chọn với portfolio; phải nằm trong dịch vụ đã chọn |
| `expiresAt` | Chỉ dành cho chứng chỉ; ISO datetime có Z/offset, phải còn hạn; bỏ trống nếu không có hạn |
| `replacesDocumentId` | UUID tài liệu hiện hành cần thay; phải cùng loại/dịch vụ |

JPEG, PNG, WEBP, GIF tối đa 5 MB; không nhận SVG hoặc file chỉ đổi tên/mimetype.
Một hồ sơ tối đa 40 ảnh hiện hành, 120 lần tạo ảnh tính cả lịch sử. Quá quota
cần hỗ trợ. Hồ sơ phải được lưu trước khi tải ảnh. Một ảnh danh tính cùng loại
tự thay bản hiện hành; nhiều chứng chỉ/portfolio dùng replacesDocumentId để
thay đúng ảnh bị yêu cầu bổ sung.

Kho ảnh bắt buộc `authenticated`. PostgreSQL CHECK chặn ảnh công khai/SVG,
partial unique chặn hai giấy tờ danh tính cùng loại còn hiện hành. Response
chỉ có `id,type,providerServiceId,expiresAt,status,reviewNote,reviewedAt,createdAt`.
Không có URL/publicId. Ảnh cũ được đánh dấu superseded, giữ trong lịch sử
riêng tư; API xem bản hiện hành không trả ảnh cũ. Nếu persist thất bại sau
upload, backend gọi dọn ảnh mới để tránh orphan.

GET access trả `{url,fileFormat}` với hạn do `CLOUDINARY_PRIVATE_URL_TTL_SECONDS`
quy định, mặc định 300 giây. Không cache, ghi analytics hoặc lưu URL vào hồ sơ
công khai. Người nhận URL đã ký có thể dùng trong thời gian còn hạn; UI không
chia sẻ URL giấy tờ. Owner không có endpoint xem giấy tờ worker.

### Nộp, yêu cầu bổ sung và gia hạn

Submit kiểm tra tài liệu danh tính, chứng chỉ còn hạn, kinh nghiệm, số ảnh
portfolio và trạng thái catalog/dịch vụ tổ chức. Mọi ảnh REJECTED/NEEDS_CHANGES
phải được thay hoặc bỏ trước khi nộp. PENDING_REVIEW khóa sửa và tải ảnh.

Reviewer đánh dấu đúng ảnh NEEDS_CHANGES và yêu cầu bổ sung hồ sơ. Worker
thay ảnh đó bằng replacesDocumentId, giữ giấy tờ VERIFIED còn lại rồi submit
lại. Giấy tờ VERIFIED không được sửa/xóa khi hồ sơ chỉ cần bổ sung; nếu thay
thông tin danh tính, backend tự yêu cầu xét lại nhóm danh tính.

Hồ sơ APPROVED muốn cập nhật/gia hạn gọi `POST P/reopen`:

```json
{"reason":"Cập nhật chứng chỉ mới.","documentIds":["16d4bd90-e048-4cfe-ad2d-c9de64c8f3ca"]}
```

reason 5–1000 ký tự, 1–40 documentIds không trùng thuộc hồ sơ hiện hành. Chỉ
các ảnh đó mở bổ sung. Worker về PENDING_VERIFICATION; owner vẫn quản trị
nhưng canProvideServices=false tới khi duyệt lại. Nếu đang SUSPENDED, giữ
đình chỉ; vận hành/owner có quyền tương ứng phải khôi phục về pending trước
khi worker sửa/nộp. Điều này không cho phép tự gỡ đình chỉ.

Reopen cần tổ chức hết các nghĩa vụ đang mở theo điều kiện chuyển tiếp P5A.
Từ chối cuối cùng dùng REJECTED, không sửa tiếp hồ sơ đó. Nếu tổ chức đồng ý
cho đăng ký lại, worker rời rồi nhận lời mời mới, tạo KYC cho version mới.

## Endpoint kiểm duyệt — Internal Access Token

Chỉ ADMIN/MODERATOR/KYC_REVIEWER. Prefix `A = /admin/provider-members/:memberId/verification`.

| Method | Endpoint | Dữ liệu |
| --- | --- | --- |
| GET | `/admin/provider-members/verifications` | Query page/limit, status, providerId; chỉ version hiện hành chưa LEFT |
| GET | `A` | Chi tiết KYC che CCCD và metadata tài liệu, có audit |
| POST | `A/identity/access` | `{verificationId,reason}`; giải mã CCCD đặc quyền, có audit |
| GET | `A/documents/:documentId/access` | URL có hạn và audit |
| PATCH | `A/documents/:documentId` | `{verificationId,revisionNumber,status,reviewNote?}` |
| POST | `A/approve` | `{verificationId,revisionNumber,reason?}` |
| POST | `A/request-changes` | `{verificationId,revisionNumber,reason}` |
| POST | `A/reject` | `{verificationId,revisionNumber,reason}` |

Ví dụ xét giấy tờ:

```json
{
  "verificationId":"dd578643-cd28-4d4b-aaec-25ad526a2937",
  "revisionNumber":1,
  "status":"NEEDS_CHANGES",
  "reviewNote":"Ảnh chứng chỉ bị mờ, cần chụp rõ."
}
```

Document status chỉ VERIFIED/NEEDS_CHANGES/REJECTED; hai trạng thái sau cần
ghi chú tối thiểu 5 ký tự. Approve chỉ thành công khi mọi ảnh hiện hành đã
VERIFIED, hồ sơ/dịch vụ/chứng chỉ còn hợp lệ và tài khoản/tổ chức/member không
bị đình chỉ. Backend kiểm tra lại tại transaction, không tin trạng thái UI.

Moderator được quyết định trực tiếp. Không cần admin duyệt lần hai. Approve
đồng thời chỉ một request thành công; audit thất bại rollback cả membership
và hồ sơ. Request với ID hồ sơ/revision cũ trả 409, kể cả khi hai lần gia nhập
đều có revisionNumber=1.

## Endpoint vận hành

| Method | Endpoint | Quyền |
| --- | --- | --- |
| POST | `/me/provider/members/:id/suspend` | Owner đình chỉ WORKER cùng tổ chức |
| POST | `/me/provider/members/:id/reactivate` | Owner chỉ gỡ khóa OWNER |
| GET | `/admin/provider-members` | ADMIN/MODERATOR/SUPPORT xem vận hành, không có KYC |
| POST | `/admin/provider-members/:id/suspend` | ADMIN/MODERATOR/SUPPORT khóa INTERNAL |
| POST | `/admin/provider-members/:id/reactivate` | ADMIN/MODERATOR/SUPPORT khôi phục sau kiểm tra |

Các POST nhận `{reason}` 5–1000 ký tự. GET vận hành nhận page/limit,
providerId và status membership; không dùng enum status KYC ở đây.

Khóa lưu trạng thái trước đình chỉ và nguồn OWNER/INTERNAL. Owner không gỡ
khóa INTERNAL, không tự thay đổi role/khóa owner. Khôi phục người chưa duyệt
chỉ về pending. Khôi phục ACTIVE kiểm tra lại hồ sơ APPROVED và chứng chỉ/
dịch vụ. Tài khoản hoặc tổ chức không ACTIVE thì chưa khôi phục.

Khóa worker không xóa đơn, lịch sử hay bằng chứng. P5C chặn người bị khóa thực
hiện đơn gắn member nhưng vẫn cho báo cáo an toàn. Chuyển giao/hàng chờ hỗ trợ
tự động cho các đơn đó còn thuộc P5E; không tự chuyển người thực hiện.

### Rời và điều kiện chuyển tiếp P5A

Endpoint leave hiện có giữ nguyên đường dẫn. Pending được rời; ACTIVE cần
KYC APPROVED đúng membershipVersion và không còn đơn chờ/đã nhận/đang thực
hiện, payment dispute/dispute, lịch tương lai, wallet hold ACTIVE, sự cố OPEN
hoặc yêu cầu hủy PENDING_CUSTOMER/SUPPORT_REVIEW.

P5C kiểm tra nghĩa vụ đúng assigned member, không chặn bởi đơn của worker
khác. Riêng đơn/lịch legacy chưa phân công vẫn chặn bảo thủ ở cấp tổ chức.
Chi tiết booking và rollback: [Organization Booking API](organization-booking-api.md).
SUSPENDED phải được vận hành xử lý trước khi rời; OWNER vẫn bị chặn rời/
đình chỉ qua API worker vì chưa có chuyển giao quyền sở hữu.

## Bảo mật, lỗi và cấu hình

- 400: thiếu dữ liệu/giấy tờ/chứng chỉ, chưa đủ tuổi/kinh nghiệm, SVG, file giả,
  sai dịch vụ, lý do thiếu, chứng chỉ hết hạn hoặc còn ảnh phải bổ sung.
- 401: JWT/session không hợp lệ hoặc dùng sai miền user/internal.
- 403: thiếu quyền KYC/vận hành, đình chỉ hoặc owner muốn gỡ khóa INTERNAL.
- 404: không sở hữu membership/giấy tờ, không có hồ sơ hiện hành.
- 409: version/revision/status đã đổi, đã gửi/đã quyết định, nghĩa vụ chưa hết,
  xung đột identity hoặc tư cách thành viên.
- 413: file vượt dung lượng; 429: vượt rate limit.

AES-GCM chỉ bảo vệ số CCCD trong DB; tên/ngày sinh nằm trong miền dữ liệu KYC
có phân quyền. Hồ sơ và URL ký dùng no-store; log/audit nghiệp vụ không ghi
CCCD rõ, ciphertext, hash hoặc URL ảnh. Đọc CCCD rõ là endpoint đặc quyền,
cần lý do và audit. Snapshot và ảnh superseded được giữ riêng tư; chính sách
retention/xóa tự động cần chốt trước production, chưa có job purge ở batch này.

Dùng lại `KYC_ENCRYPTION_KEY`, Cloudinary API credentials, preset KYC có chế
độ authenticated và `CLOUDINARY_PRIVATE_URL_TTL_SECONDS`. Không thêm key mới.
Mã hóa/identity claim dùng chung `infrastructure/kyc`, giữ định dạng ciphertext
cũ để hồ sơ đối tác đã có vẫn đọc được.

Migration `20261027150000_provider_member_verification` thêm bảng/column/index,
không xóa dữ liệu cũ hay tự tạo KYC giả cho owner đã backfill. Rollback ứng dụng
giữ bảng mới; tạm dừng luồng rejoin/approval khi chạy image cũ vì image cũ chưa
tăng membershipVersion và chưa hiểu trạng thái KYC. Đối soát membership/KYC
trước khi mở lại tính năng sau rollback.

Chạy `npm run test:provider-members` với TEST_DATABASE_URL trỏ database riêng
`lambe_booking_test_*`. Kiểm thử dùng ảnh giả và bộ lưu trữ mock, không upload
giấy tờ thật lên Cloudinary. `test:provider-members:migration` diễn tập cả hai
migration trong schema tạm, gồm CHECK chống ảnh công khai/SVG. Gửi thông báo
KYC vẫn cần bổ sung; ACTIVE không thay thế mọi điều kiện nhận đơn.
P5B đã bổ sung dịch vụ được cấp, lịch, bán kính và online theo member; xem
[Năng lực thành viên](provider-member-capabilities-api.md). P5C đã kiểm tra
chứng chỉ tới cuối công việc khi Discovery/quote/nhận đơn và khi phát sinh
dịch vụ; xem [Organization Booking API](organization-booking-api.md).
