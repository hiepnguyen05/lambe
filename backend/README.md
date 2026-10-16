# Lambe Backend

Backend NestJS cho Lambe Beauty Booking. Người dùng xác thực qua Firebase bằng
số điện thoại, Google hoặc Facebook; backend kiểm tra Firebase ID token trước
khi cấp JWT riêng của Lambe. Mọi tài khoản Lambe vẫn phải có số điện thoại đã
xác minh.

## Stack

- NestJS 11
- Prisma 6
- PostgreSQL
- Redis cache
- JWT
- Firebase Authentication (Phone, Google, Facebook)

## Architecture

Backend sử dụng modular monolith: mỗi nghiệp vụ nằm trong một NestJS module và
không truy cập trực tiếp vào chi tiết nội bộ của module khác.

```text
src/
├── bootstrap/       # Thiết lập HTTP toàn cục
├── common/          # Thành phần dùng chung không thuộc nghiệp vụ cụ thể
├── config/          # Đọc và kiểm tra biến môi trường
├── infrastructure/  # PostgreSQL, Redis, Firebase, upload, email và audit
└── modules/         # Các module nghiệp vụ độc lập
```

Bên trong một module nghiệp vụ:

```text
application/  # Use case, điều phối transaction và dependency
domain/       # Quy tắc nghiệp vụ thuần, không phụ thuộc NestJS/Prisma khi có thể
controllers/  # HTTP transport
dto/          # Validation request/response boundary
guards/       # Authentication/authorization tại transport boundary
```

Controller không chứa nghiệp vụ. Application service không gọi controller.
Chi tiết PostgreSQL, Redis và Firebase chỉ đi qua các provider trong
`infrastructure`. Giao dịch thay đổi dữ liệu và audit log được ghi chung một
Prisma transaction. Redis chỉ làm cache-aside và không phải nguồn dữ liệu gốc.

## Setup

```bash
npm install
```

Tạo file `.env` từ `.env.example`. `JWT_SECRET` và `INTERNAL_JWT_SECRET` phải là
hai giá trị ngẫu nhiên độc lập, mỗi giá trị dài ít nhất 32 ký tự.
`INTERNAL_JWT_SECRET` không được trùng với `JWT_SECRET` để token
người dùng và token nội bộ không thể dùng thay thế cho nhau. PostgreSQL local
mặc định được kết nối tại `localhost:5432`.

Đặt Firebase service account tại
`secrets/firebase-service-account.json`. Thư mục này đã bị loại khỏi Git và
Docker build context. Docker Compose chỉ mount file vào container ở chế độ đọc:

```env
FIREBASE_ENABLED="true"
FIREBASE_PROJECT_ID="lambe-f7213"
GOOGLE_APPLICATION_CREDENTIALS="/run/secrets/firebase-service-account.json"
```

Trên Firebase Console cần bật các provider Phone, Google và Facebook, cho phép
vùng SMS Việt Nam và cấu hình domain chạy frontend trong Authorized domains.
Với Facebook, nhập App ID/App Secret trong Firebase Console và thêm callback
`https://lambe-f7213.firebaseapp.com/__/auth/handler` vào Valid OAuth Redirect
URIs của ứng dụng trên Meta for Developers. Firebase Web SDK xử lý đăng nhập ở
client; private key của service account tuyệt đối không được đưa sang frontend.
SMS thật yêu cầu project liên kết Cloud Billing và chạy frontend trên domain
được Firebase cho phép. Khi phát triển local, ưu tiên Firebase Auth Emulator
hoặc số điện thoại kiểm thử đã cấu hình trong Firebase Console.

Đồng bộ database và generate Prisma Client:

```bash
npm run prisma:deploy
npm run prisma:generate
```

Chạy dev server:

```bash
npm run start:dev
```

API mặc định chạy tại:

```text
http://localhost:5000/api
```

## Docker Runtime

Stack Docker gồm backend NestJS, PostgreSQL và Redis. Service `migrate`
chạy `prisma migrate deploy` một lần sau khi PostgreSQL healthy; API chỉ khởi động
khi migration hoàn tất và Redis đã sẵn sàng. Image chạy API không chứa Prisma CLI
hay các dependency phục vụ build/test.

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f lambe_server
```

Các địa chỉ truy cập từ máy host:

```text
API:        http://localhost:5000/api
Health:     http://localhost:5000/api/health
PostgreSQL: localhost:5433
Redis:     localhost:6379
```

Trong mạng Docker, backend kết nối PostgreSQL tại `postgres:5432` và Redis tại
`redis:6379`. Các giá trị này được khai báo trực tiếp trong
`docker-compose.yml`, vì vậy `.env` vẫn có thể giữ địa chỉ `localhost` để dùng
cho công cụ chạy trực tiếp trên Windows khi cần.

Dừng stack nhưng giữ dữ liệu:

```bash
docker compose down
```

Không thêm `-v` vào lệnh trên nếu muốn giữ volume PostgreSQL và Redis.

## Auth API

```text
POST /api/auth/firebase
POST /api/auth/firebase/phone-link-check
POST /api/auth/complete-registration
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/me
```

Mỗi HTTP response có header `x-request-id`. Client có thể gửi request ID hợp lệ
hoặc backend sẽ tự sinh UUID; giá trị này được lưu cùng audit log để truy vết.

Luồng hiện tại:

1. Người dùng chọn OTP, Google hoặc Facebook trên frontend.
2. Frontend nhận Firebase ID token rồi gửi tới `POST /api/auth/firebase`.
3. Backend dùng Firebase Admin SDK kiểm tra chữ ký, hạn token, trạng thái thu hồi
   và chỉ chấp nhận provider `phone`, `google.com` hoặc `facebook.com`.
4. Nếu token Google/Facebook chưa có số điện thoại, backend yêu cầu frontend liên
   kết và xác minh số qua Firebase Phone Authentication trước khi tiếp tục.
5. Nếu số đã có tài khoản, backend trả access token ngắn hạn và refresh token
   Lambe gắn với một phiên đăng nhập trong database.
6. Nếu là số mới, backend trả `registrationToken` có hạn 5 phút.
7. Frontend gửi `registrationToken` và `fullName` để hoàn tất đăng ký.
8. Gửi access token theo dạng `Authorization: Bearer <token>` để gọi `/auth/me`.
9. Khi access token hết hạn, gửi refresh token tới `POST /api/auth/refresh`.
   Mỗi lần refresh thành công sẽ thay thế refresh token cũ; tái sử dụng token cũ
   sẽ thu hồi phiên.
10. Gửi refresh token tới `POST /api/auth/logout` để thu hồi phiên hiện tại.

Access token mặc định có hạn 15 phút. Refresh token mặc định có hạn 30 ngày và
phải được mobile lưu bằng secure storage; không ghi token vào log hoặc analytics.

Backend không tạo hoặc lưu OTP. Hạn mức gửi, thời gian hiệu lực và chống lạm
dụng OTP thuộc trách nhiệm của Firebase; rate limit tại endpoint đổi token vẫn
được giữ như một lớp bảo vệ bổ sung.

Body hoàn tất đăng ký:

```json
{
  "registrationToken": "token nhận từ POST /api/auth/firebase",
  "fullName": "Nguyen Van A"
}
```

## Internal Admin Auth

Admin và bộ phận kiểm duyệt sử dụng hệ thống tài khoản nội bộ riêng, không đăng
nhập qua luồng Firebase của khách hàng.

```text
POST /api/admin/auth/login
POST /api/admin/auth/refresh
POST /api/admin/auth/logout
GET  /api/admin/auth/me
```

Tạo admin đầu tiên bằng lệnh sau. Mật khẩu không được đưa vào tham số command;
script chỉ đọc từ biến môi trường tạm thời `ADMIN_PASSWORD`.

```powershell
$env:ADMIN_PASSWORD="a-strong-passphrase-at-least-15-characters"
npm run admin:create -- --username admin --name "System Admin"
Remove-Item Env:ADMIN_PASSWORD
```

Đăng nhập:

```json
{
  "username": "admin",
  "password": "a-strong-passphrase-at-least-15-characters"
}
```

Access token nội bộ có thời hạn mặc định 15 phút. Refresh token được luân chuyển,
lưu hash trong database và gửi bằng cookie `HttpOnly`. Tài khoản bị khóa 15 phút
sau 5 lần nhập sai liên tiếp.

## Service Categories

Danh mục là nhóm dịch vụ cấp lớn dạng phẳng như `Tóc`, `Nail` hoặc `Makeup`.
Danh mục mới luôn được tạo ở trạng thái `INACTIVE`; admin phải kích hoạt trước
khi danh mục xuất hiện trong API công khai.

```text
GET   /api/categories
GET   /api/categories/:slug

GET   /api/admin/categories?page=1&limit=20&status=ACTIVE&search=toc
GET   /api/admin/categories/:id
POST  /api/admin/categories
PATCH /api/admin/categories/reorder
PATCH /api/admin/categories/:id/status
PATCH /api/admin/categories/:id
POST  /api/admin/categories/:id/cover-image
DELETE /api/admin/categories/:id/cover-image
```

Tất cả API dưới `/api/admin/categories` yêu cầu access token nội bộ có role
`ADMIN`. Role `MODERATOR` không được phép quản lý danh mục. Mã danh mục không
thể thay đổi sau khi tạo; việc lưu trữ dùng trạng thái `ARCHIVED`, không xóa cứng.
Mọi thao tác ghi đều được lưu vào audit log.

Body tạo danh mục:

```json
{
  "code": "HAIR",
  "name": "Tóc",
  "slug": "toc",
  "description": "Các dịch vụ chăm sóc và tạo kiểu tóc",
  "iconUrl": "content_cut",
  "sortOrder": 1
}
```

Body đổi trạng thái:

```json
{
  "status": "ACTIVE"
}
```

Các luồng trạng thái hợp lệ là `INACTIVE -> ACTIVE|ARCHIVED`,
`ACTIVE -> INACTIVE|ARCHIVED` và `ARCHIVED -> INACTIVE`.
`iconUrl` hiện chấp nhận mã Material Symbol hoặc URL HTTPS để tương thích với
bộ chọn icon của giao diện quản trị.
Ảnh bìa không nhận URL trong body tạo/cập nhật. Hãy tải file từ máy qua
`POST /api/admin/categories/:id/cover-image` để hệ thống kiểm tra nội dung file,
lưu Cloudinary và quản lý vòng đời ảnh.

## Media Upload

Swagger is available at `http://localhost:5000/docs` only in development.
The protected endpoint `POST /api/admin/upload/image` accepts JPEG, PNG, WEBP, and
GIF files up to 5 MB. It is available to `ADMIN` and `MODERATOR` accounts. For a
category cover, prefer `POST /api/admin/categories/:id/cover-image`; that endpoint
updates the category and removes a previously managed Cloudinary image.

Cloudinary is disabled until all required values are configured:

```env
CLOUDINARY_ENABLED="true"
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_UPLOAD_PRESET="your-signed-upload-preset"
CLOUDINARY_KYC_UPLOAD_PRESET="your-signed-authenticated-preset"
CLOUDINARY_PRIVATE_URL_TTL_SECONDS="300"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"
KYC_ENCRYPTION_KEY="base64-encoded-32-byte-key"
```

Do not commit the real API key or API secret. Upload folders are selected from a
server-controlled allowlist; arbitrary folder paths and SVG uploads are rejected.
Create the KYC preset as a signed preset and set its delivery type to
`authenticated`. Generate the encryption key once with
`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`,
store it in the deployment secret manager, and keep backups: losing or rotating
this key without a migration makes existing identity numbers unreadable.

## Standard Services

Standard services are child records of a service category, for example
`Tóc -> Cắt tóc nam`. The platform owns these records; provider applications
reference them when declaring services and proposed prices.

```text
GET    /api/services?categorySlug=toc&targetAudience=MEN&search=cat&maxPriceAmount=300000
GET    /api/services/:slug

GET    /api/admin/services?page=1&limit=20&categoryId=:id&status=ACTIVE&search=toc
GET    /api/admin/services/:id
POST   /api/admin/services
PATCH  /api/admin/services/:id
PATCH  /api/admin/services/:id/status
PATCH  /api/admin/categories/:categoryId/services/reorder
POST   /api/admin/services/:id/cover-image
DELETE /api/admin/services/:id/cover-image
```

Create body example:

```json
{
  "categoryId": "6f0fb120-f590-4b63-8782-15ae57eeaba0",
  "code": "MEN_HAIRCUT",
  "name": "Cắt tóc nam",
  "slug": "cat-toc-nam",
  "description": "Cắt và tạo kiểu tóc nam tại nhà",
  "iconUrl": "content_cut",
  "minPriceAmount": 50000,
  "maxPriceAmount": 300000,
  "defaultDurationMinutes": 45,
  "targetAudience": "MEN",
  "sortOrder": 0
}
```

Prices are integer VND amounts. Both limits must be positive and
`minPriceAmount <= maxPriceAmount`. New services are `INACTIVE`, and they can
only be activated while their parent category is `ACTIVE`. Cover images must be
uploaded through the dedicated multipart endpoint rather than supplied as URLs.
`targetAudience` accepts `ALL`, `MEN`, or `WOMEN`. It is a recommendation signal;
it does not prevent a customer from viewing or booking another service.
`PATCH /api/admin/services/:id` accepts `categoryId` to move a service to
another category. The destination must exist and cannot be `ARCHIVED`; an
`ACTIVE` service requires an `ACTIVE` destination. The service name must remain
unique within the destination category.

## Customer Onboarding And Recommendations

Every newly registered customer receives a `CustomerProfile` with status
`NOT_STARTED`. All endpoints below require a user access token.

```text
GET  /api/onboarding/options
GET  /api/me/onboarding
PUT  /api/me/onboarding
POST /api/me/onboarding/complete
POST /api/me/onboarding/skip
GET  /api/me/recommendations/services?limit=20
```

The update endpoint is idempotent and accepts any subset of `gender`,
`preferredAudience`, `pricePreference`, `categoryIds`, `serviceIds`, and
`defaultAddress`. Completing onboarding requires at least one active category or
service interest. Skipping onboarding does not remove preferences and the user
may resume later.

Service recommendations prioritize explicit service interests, followed by
category interests and audience compatibility. `BUDGET` and `PREMIUM` price
preferences are used as tie breakers. Provider proximity is intentionally not
returned until provider service areas, online locations, and availability are
implemented.

## Provider Applications

Người đăng ký phải đăng nhập bằng access token người dùng. Một tài khoản chỉ có
một hồ sơ `DRAFT`, `PENDING_REVIEW` hoặc `NEEDS_CHANGES` tại cùng thời điểm.

```text
GET    /api/provider-applications/terms/current
GET    /api/provider-applications
GET    /api/provider-applications/:id
POST   /api/provider-applications
PATCH  /api/provider-applications/:id
POST   /api/provider-applications/:id/services
PATCH  /api/provider-applications/:id/services/:itemId
DELETE /api/provider-applications/:id/services/:itemId
POST   /api/provider-applications/:id/service-suggestions
PATCH  /api/provider-applications/:id/service-suggestions/:suggestionId
DELETE /api/provider-applications/:id/service-suggestions/:suggestionId
POST   /api/provider-applications/:id/documents/:type
GET    /api/provider-applications/:id/documents/:documentId/access
DELETE /api/provider-applications/:id/documents/:documentId
POST   /api/provider-applications/:id/terms/accept
POST   /api/provider-applications/:id/submit
POST   /api/provider-applications/:id/withdraw
```

Tài liệu hỗ trợ `PORTRAIT`, `ID_CARD_FRONT`, `ID_CARD_BACK`,
`IDENTITY_SELFIE`, `PROFESSIONAL_CERTIFICATE`, `BUSINESS_LICENSE`, `PORTFOLIO`
và `OTHER`. File phải là JPEG, PNG, WEBP hoặc GIF hợp lệ, tối đa 5 MB. Chứng chỉ
hoặc portfolio có thể gắn với dịch vụ bằng query `applicationServiceId`.

Nhân sự nội bộ dùng token nội bộ và quyền theo từng công việc để xét duyệt:

```text
GET   /api/admin/provider-applications
GET   /api/admin/provider-applications/:id
GET   /api/admin/provider-applications/:id/documents/:documentId/access
PATCH /api/admin/provider-applications/:id/checks/:section
PATCH /api/admin/provider-applications/:id/documents/:documentId/review
PATCH /api/admin/provider-applications/:id/services/:itemId/review
POST  /api/admin/provider-applications/:id/service-suggestions/:suggestionId/approve
POST  /api/admin/provider-applications/:id/service-suggestions/:suggestionId/reject
POST  /api/admin/provider-applications/:id/request-changes
POST  /api/admin/provider-applications/:id/reject
POST  /api/admin/provider-applications/:id/approve
```

Các nhóm kiểm tra là `IDENTITY`, `PORTRAIT`, `EXPERTISE`, `SERVICES` và `TERMS`.
Nếu dịch vụ chưa có, người đăng ký thêm đề xuất vào hồ sơ với `categoryId`,
`name`, `description`, `proposedPriceAmount` và `durationMinutes`. Hồ sơ có thể
được nộp chỉ với đề xuất dịch vụ. Admin duyệt bằng body của API tạo dịch vụ
(`categoryId`, `code`, `name`, `slug`, giá sàn/trần, đối tượng, thời lượng,
yêu cầu chứng chỉ/portfolio/kinh nghiệm). Backend tạo dịch vụ `ACTIVE` trong
catalog và mục dịch vụ `PENDING` cho đối tác trong cùng transaction. Giá đối
tác vẫn phải được duyệt riêng; hồ sơ không thể được duyệt cuối cùng khi còn
đề xuất `PENDING`. Nếu từ chối, Admin gửi `reason`; người đăng ký sửa hoặc xóa
đề xuất khi hồ sơ được trả về `NEEDS_CHANGES`.
Khi yêu cầu bổ sung, hạng mục `NEEDS_CHANGES` hoặc chưa xác minh (`PENDING`)
được chỉnh sửa; hạng mục `VERIFIED` vẫn khóa. Khi
duyệt, backend thực hiện một transaction để cấp role `PROVIDER`, tạo
`ProviderProfile`, ví VND số dư 0 và các `ProviderService` đã được xác minh.
CCCD, selfie và chứng chỉ chỉ xuất hiện trong API của chủ hồ sơ và API nội bộ,
không có trong API công khai cho khách hàng.

National ID values are encrypted with AES-256-GCM in PostgreSQL. An HMAC hash is
kept only for duplicate detection and exact internal search; normal responses
return a masked value. KYC images use Cloudinary `authenticated` delivery and
stored URLs are omitted from application responses. The two `access` endpoints
issue short-lived signed URLs, apply rate limits, and audit the viewer.

### Registration Upgrade

- `ADMIN`: toàn quyền, quản lý và giám sát; không phải bước duyệt bắt buộc.
- `MODERATOR` / `KYC_REVIEWER`: xem CCCD và tài liệu riêng tư, xác minh các nhóm,
  xét duyệt tài liệu/dịch vụ, yêu cầu bổ sung và trực tiếp duyệt/từ chối hồ sơ.
  Không cần chuyển hồ sơ sang Admin để ra quyết định cuối cùng.
- `SERVICE_REVIEWER`: chỉ xét duyệt `EXPERTISE`, `SERVICES` và giá dịch vụ đã đăng ký;
  không xem CCCD/tài liệu KYC và không duyệt/từ chối toàn bộ hồ sơ.
- `SUPPORT`: xem danh sách và thông tin tiến độ tối thiểu, không xem giấy tờ,
  ngày sinh hoặc CCCD. Vai trò mới không tự động cấp cho tài khoản hiện có.

Duyệt trực tiếp vẫn yêu cầu đủ các hạng mục đã xác minh và điều kiện dịch vụ/giá
hợp lệ. Audit log ghi người ra quyết định thực tế; cơ chế chống duyệt trùng và
gửi email kết quả vẫn áp dụng như trước.

Người đăng ký cá nhân phải đủ 18 tuổi (ngày tại Việt Nam). `birthDate` chỉ nhận
`YYYY-MM-DD`. Email trong hồ sơ là email liên hệ để Lambe gửi thông báo tiếp
nhận hồ sơ, yêu cầu bổ sung và kết quả xét duyệt; không dùng email OTP trong
luồng đăng ký đối tác.

API quản lý dịch vụ nhận thêm `requiresCertificate` (mặc định `false`),
`minPortfolioImages` (0-20, mặc định 0), `minExperienceYears` (0-80, mặc định 0).
Chứng chỉ/portfolio phải gắn đúng `applicationServiceId`. Khi duyệt, bằng chứng
phải `VERIFIED`. Cấu hình các yêu cầu này cho từng dịch vụ để áp dụng chính sách
chuyên môn; migration không tự áp đặt yêu cầu mới lên toàn bộ dịch vụ cũ.
`targetAudience` được trả kèm dịch vụ trong hồ sơ và không hạn chế giới tính thợ.

Nộp và duyệt đều kiểm tra lại dịch vụ/danh mục đang hoạt động, giá sàn/trần hiện
hành và điều kiện chuyên môn. Giao dịch khóa hồ sơ cha; nộp/duyệt còn khóa đọc
danh mục/dịch vụ để tránh thay đổi giá/trạng thái trong lúc xác minh. CCCD dùng
bảng `provider_identity_claims` để giữ quyền sở hữu định danh theo tài khoản:
cùng người được nộp hồ sơ mới với CCCD cũ, người khác không được dùng lại.
Giới hạn mỗi hồ sơ: 20 dịch vụ, 60 ảnh (tối đa 40 portfolio, 15 chứng chỉ, 5
tài liệu `OTHER`), mỗi ảnh vẫn tối đa 5 MB. Thay ảnh đơn không tăng số lượng.

Email tiếp nhận/duyệt/bổ sung/từ chối được ghi vào `mail_outbox` trong cùng
transaction với hồ sơ. Worker gửi mỗi 30 giây, thử lại tối đa 8 lần với khoảng
đợi tăng dần, tối đa 1 giờ. Sau khi gửi thành công, nội dung email được xóa khỏi
outbox. SMTP tắt thì email giữ trạng thái chờ. Mã email hết hạn không được gửi.
`failedAt` là dấu hiệu cần nhân sự vận hành xử lý. Cơ chế SMTP là at-least-once:
khi mất kết nối sau lúc gửi, email có thể bị gửi lặp; không cam kết exactly-once.

### Provider Setup

```text
GET /api/me/provider/setup
PUT /api/me/provider/setup
```

Chỉ tài khoản có `ProviderProfile` đã được duyệt mới sử dụng các API này.

```json
{
  "serviceAreaName": "Quận Cầu Giấy, Hà Nội",
  "serviceAreaLatitude": 21.0368,
  "serviceAreaLongitude": 105.7827,
  "serviceRadiusKm": 10,
  "workingHours": [{ "dayOfWeek": 1, "startMinute": 480, "endMinute": 1020 }],
  "enabledServiceIds": ["<ProviderService.id đã được duyệt>"]
}
```

Lịch theo giờ Việt Nam; 0 là Chủ nhật, 1-6 là Thứ hai-Thứ bảy. Bán kính 1-50 km,
tối đa 21 khung giờ không chồng lấn và ít nhất một dịch vụ đủ điều kiện. Không
được dùng thiết lập để bỏ đình chỉ hồ sơ/dịch vụ. Cấu hình hợp lệ chuyển hồ sơ
từ `SETUP_REQUIRED` sang `ACTIVE`, nhưng **không tự bật nhận đơn**.
`serviceAreaName` là nhãn hiển thị. Tọa độ tâm khu vực được dùng cho đơn đặt
lịch; bán kính được dùng cho cả đặt ngay và đặt lịch. Sau đó thợ phải chủ động
bật trạng thái online và gửi heartbeat vị trí. Với tìm kiếm đặt ngay, vị trí GPS
online trong Redis là tâm tính khoảng cách; API chỉ trả về thợ đúng dịch vụ và
nằm trong bán kính nhận đơn đã cấu hình.

Chưa bật tự động xóa KYC của hồ sơ cũ: cần chốt thời hạn lưu trữ, ngoại lệ khiếu
nại và quy trình xóa Cloudinary trước. Các thử nghiệm tự động dùng dữ liệu giả,
database kiểm thử riêng và mock email/upload, không gửi SMS/email thật.

## Customer Addresses And Provider Discovery

Khách hàng quản lý tối đa 10 địa chỉ. Mọi thao tác đều kiểm tra quyền sở hữu;
khi xóa địa chỉ mặc định, hệ thống tự chọn một địa chỉ còn lại làm mặc định.
Địa chỉ đầu tiên tự động là mặc định và không thể bỏ mặc định trực tiếp nếu chưa
chọn địa chỉ khác thay thế.

Mỗi địa chỉ hỗ trợ:

- `type`: `HOME`, `WORK` hoặc `OTHER`.
- `label` và `addressLine` để hiển thị.
- `provinceName`, `districtName`, `wardName`, `streetLine` để tách các cấp địa chỉ.
- `latitude`, `longitude` để tìm nhà cung cấp gần khách.
- `isMapConfirmed` để biết khách đã xác nhận ghim bản đồ.
- `contactName`, `contactPhone`, `note` và `isDefault`.

```text
GET    /api/me/addresses
POST   /api/me/addresses
PATCH  /api/me/addresses/:id
PUT    /api/me/addresses/:id/default
DELETE /api/me/addresses/:id
```

Ví dụ tạo địa chỉ từ vị trí hiện tại:

```json
{
  "type": "HOME",
  "label": "Nhà",
  "addressLine": "12 Nguyễn Huệ, Quận 1, TP.HCM",
  "provinceName": "Thành phố Hồ Chí Minh",
  "districtName": "Quận 1",
  "wardName": "Phường Bến Nghé",
  "streetLine": "12 Nguyễn Huệ",
  "latitude": 10.7731,
  "longitude": 106.703,
  "isMapConfirmed": true,
  "isDefault": true
}
```

Mobile phải tự xin quyền GPS, đọc tọa độ và reverse geocode bằng dịch vụ bản đồ;
backend không thể tự đọc vị trí thiết bị. Khi cập nhật vị trí, API yêu cầu gửi
đồng thời `latitude` và `longitude`. Nếu tọa độ đổi mà request không gửi
`isMapConfirmed`, backend tự đặt lại thành `false`.

Schema được triển khai bởi migration:

```text
20261003100000_expand_customer_addresses
```

Nhà cung cấp đã duyệt và hoàn tất setup có thể bật online khi có ít nhất một
khung giờ làm việc, một dịch vụ thực sự hoạt động và số dư ví khả dụng đạt mức
tối thiểu. `availableAmount = balanceAmount - heldAmount`; mức mặc định là
50.000 VND, cấu hình bằng `PROVIDER_MIN_RECEIVING_BALANCE`. Vị trí hiện tại chỉ
lưu trong Redis GEO, hết heartbeat mặc định sau 120 giây và không được trả công
khai cho khách hàng. PostgreSQL chỉ giữ phiên online để truy vết.

```text
GET  /api/me/provider/availability
POST /api/me/provider/availability/online
PUT  /api/me/provider/availability/heartbeat
POST /api/me/provider/availability/offline
```

Tìm kiếm dùng body để hạn chế tọa độ chính xác xuất hiện trong access log. Có thể
gửi `customerAddressId` hoặc cặp `latitude`/`longitude`; kết quả chỉ trả khoảng
cách đã làm tròn, hồ sơ công khai và dịch vụ phù hợp.

```text
POST /api/discovery/providers/search
GET  /api/providers/:id/public
```

```json
{
  "serviceId": "<Service.id>",
  "customerAddressId": "<CustomerAddress.id>",
  "radiusKm": 10,
  "limit": 20
}
```

`PROVIDER_LOCATION_TTL_SECONDS` cấu hình thời gian sống của heartbeat trong
khoảng 30-600 giây, mặc định 120 giây. Redis là thành phần bắt buộc đối với bật
online và tìm kiếm theo vị trí; các API dữ liệu PostgreSQL vẫn hoạt động nếu
Redis tạm thời không khả dụng.

Response trạng thái online có `receivingEligibility` gồm `eligible`,
`blockerCode`, `availableBalance` và `minimumBalance`. Nếu heartbeat phát hiện
hồ sơ, dịch vụ, lịch hoặc ví không còn hợp lệ, backend đóng phiên online và xóa
vị trí Redis. Discovery, tạo đơn và nhận đơn đều kiểm tra lại điều kiện
`availableAmount >= max(PROVIDER_MIN_RECEIVING_BALANCE, commissionAmount)`.

## Service Orders

Đơn hỗ trợ `ASAP` và `SCHEDULED`. Đặt ngay yêu cầu thợ đang online và dùng vị
trí Redis hiện tại làm tâm bán kính. Đặt lịch yêu cầu thời điểm cách hiện tại từ
60 phút đến 30 ngày, đồng thời kiểm tra tâm khu vực, bán kính riêng của thợ,
giờ làm việc, lịch giữ chỗ, lịch đã nhận và khoảng đệm di chuyển giữa hai khách.

```text
POST /api/orders/quote
POST /api/orders
GET  /api/me/orders
GET  /api/me/orders/:id
POST /api/me/orders/:id/cancel
POST /api/me/orders/:id/cancellation/decision
POST /api/me/orders/:id/review

GET  /api/me/provider/orders
GET  /api/me/provider/orders/:id
POST /api/me/provider/orders/:id/accept
POST /api/me/provider/orders/:id/reject
POST /api/me/provider/orders/:id/cancel
POST /api/me/provider/orders/:id/en-route
POST /api/me/provider/orders/:id/arrive
POST /api/me/provider/orders/:id/start
POST /api/me/provider/orders/:id/complete
POST /api/me/provider/orders/:id/evidence/:type
POST /api/me/provider/orders/:id/contact-attempt
POST /api/me/provider/orders/:id/cancellation-request

GET   /api/orders/:id/evidence/:evidenceId
GET   /api/me/notifications
PATCH /api/me/notifications/:id/read
GET   /api/providers/:id/reviews

GET  /api/admin/orders/cancellation-requests
GET  /api/admin/orders/cancellation-requests/:id
GET  /api/admin/orders/cancellation-requests/:id/evidence/:evidenceId
POST /api/admin/orders/cancellation-requests/:id/decision

GET    /api/providers/:id/availability
GET    /api/me/provider/calendar
POST   /api/me/provider/calendar/time-off
DELETE /api/me/provider/calendar/time-off/:id
```

`POST /api/orders` bắt buộc header `Idempotency-Key` (8-128 ký tự chữ/số/_/-).
Đơn có thể dùng địa chỉ đã lưu hoặc `inlineAddress` nhập riêng tại thời điểm đặt.
Retry cùng nội dung và key trả lại đơn cũ; đổi nội dung phải dùng key mới.
Quote và availability không giữ chỗ. Chỉ tạo đơn thành công mới giữ lịch tạm:
5 phút cho ASAP, tối đa 30 phút cho SCHEDULED. Một khách tối đa 3 yêu cầu chờ.

Khi nhận đơn, hệ thống khóa hồ sơ thợ, đơn và ví trong một transaction, kiểm tra số dư khả
dụng rồi tạo `HOLD`. Khách hủy đơn hợp lệ sẽ giải phóng khoản giữ. Thợ chỉ gọi
`complete` với body `{ "cashReceived": true }` sau khi đã thu đủ tiền mặt; khi
đó `HOLD` được chuyển thành giao dịch `COMMISSION`. Địa chỉ và số điện thoại
khách chỉ được trả cho thợ sau khi nhận đơn, không hiển thị với đơn bị từ chối,
hết hạn hoặc hủy.

Yêu cầu `PENDING_PROVIDER` quá `providerResponseDeadlineAt` được tác vụ bảo trì
chuyển sang `EXPIRED` mỗi phút và ghi `OrderStatusHistory`. API chỉ cho chuyển
tuần tự `ACCEPTED -> EN_ROUTE -> ARRIVED -> IN_PROGRESS -> COMPLETED`; thao tác
không còn hợp lệ trả `409 Conflict`.
Các bước đến nơi/bắt đầu/hoàn thành yêu cầu ảnh riêng tư tương ứng. Sau khi đã
khởi hành, thợ gửi yêu cầu hủy để khách duyệt hoặc chuyển hỗ trợ; yêu cầu chưa
được quyết định vẫn giữ lịch và khoản HOLD. Thông báo hiện lưu trong PostgreSQL
để client tải định kỳ, chưa phát push. Khách đánh giá một lần sau khi hoàn thành.

Schema được triển khai bởi migration:

```text
20261009100000_orders_and_wallet_holds
20261012120000_booking_calendar
20261012123000_booking_pending_index
20261013140000_order_workflow
20261013143000_order_contact_attempts
```

PostgreSQL dùng exclusion constraint GiST ngăn các khoảng lịch active chồng nhau;
Redis chỉ cung cấp vị trí/heartbeat, không quyết định việc giữ lịch hay trừ ví.
Discovery lấy tối đa 300 ứng viên, lọc bán kính từng thợ và đọc lịch theo batch.
Đặt trước dùng PostgreSQL point GiST; đặt ngay dùng Redis GEO. Đây chưa phải
cam kết chịu tải production. Giờ di chuyển là ước lượng bảo thủ, chưa có routing
API/traffic. Một hồ sơ thợ hiện chỉ có năng lực phục vụ một đơn cùng lúc.

Contract, ví dụ request/response, giới hạn và cách chạy test PostgreSQL thật:
[Booking API](docs/booking-api.md). Swagger tương ứng tại `/docs`.

## Provider Wallet, MoMo And SePay Sandbox

The provider-wallet API is implemented for authenticated user accounts that
already own an approved provider profile and wallet. Every `/me/provider/wallet`
route requires `Authorization: Bearer <user_access_token>`.

```text
GET  /api/me/provider/wallet
GET  /api/me/provider/wallet/transactions
POST /api/me/provider/wallet/top-ups/momo
POST /api/me/provider/wallet/top-ups/sepay
GET  /api/me/provider/wallet/top-ups
GET  /api/me/provider/wallet/top-ups/:id

POST /api/payments/momo/ipn
GET  /api/payments/momo/return

POST /api/payments/sepay/ipn
GET  /api/payments/sepay/checkout/:id
GET  /api/payments/sepay/success
GET  /api/payments/sepay/error
GET  /api/payments/sepay/cancel
```

Supported queries:

```text
GET /api/me/provider/wallet/transactions?type=TOP_UP&limit=20
GET /api/me/provider/wallet/top-ups?status=SUCCEEDED&limit=20
```

`limit` is optional and accepts `1..50` (default `20`). Transaction types are
`TOP_UP`, `HOLD`, `RELEASE`, `COMMISSION`, `ADJUSTMENT`, and `REFUND`. Top-up
statuses are `CREATED`, `PENDING_PAYMENT`, `SUCCEEDED`, `FAILED`, and `EXPIRED`.
The wallet summary exposes `balanceAmount`, `heldAmount`, and
`availableAmount = balanceAmount - heldAmount`; order eligibility must use the
available amount.

`POST top-ups/momo` nhận `{ "amount": 100000 }` trong khoảng 1.000 đến
50.000.000 VND và trả `payUrl`, `deeplink`, `qrCodeUrl`. Số dư chỉ được cộng từ
IPN có chữ ký HMAC-SHA256 hợp lệ và khớp toàn bộ partner/order/request/amount.
Transaction khóa yêu cầu nạp và ví, sau đó tạo một giao dịch `TOP_UP` có
idempotency key; callback lặp không cộng tiền lần hai. Redirect không được dùng
để xác nhận thanh toán.

Cấu hình sandbox:

```env
MOMO_ENABLED="true"
MOMO_ENDPOINT="https://test-payment.momo.vn/v2/gateway/api/create"
MOMO_PARTNER_CODE="..."
MOMO_ACCESS_KEY="..."
MOMO_SECRET_KEY="..."
MOMO_IPN_URL="https://<ngrok-domain>/api/payments/momo/ipn"
MOMO_REDIRECT_URL="https://<ngrok-domain>/api/payments/momo/return"
```

Chạy tunnel giới hạn route bằng policy đã lưu trong repo:

```powershell
ngrok http 5000 --traffic-policy-file .\ngrok-momo-policy.yml
```

Policy chỉ công khai hai endpoint MoMo; các API còn lại trả `404`. Yêu cầu nạp
chưa hoàn tất hết hạn sau 30 phút. Migration tương ứng:

```text
20261009160000_momo_wallet_top_ups
```

`MOMO_ENABLED=false` disables only payment creation and is the safe default
until valid sandbox credentials are configured. It does not disable wallet
summary or history endpoints. Sandbox still requires sandbox-specific Partner
Code, Access Key, and Secret Key; ngrok only supplies public HTTPS callback
URLs and does not replace those credentials.

SePay uses the official `sepay-pg-node` SDK. Creating a SePay top-up returns a
Lambe `payUrl`; opening it submits the signed one-time payment form to SePay.
Only a paid IPN that passes authentication and matches the stored invoice,
amount, currency, captured order status and approved payment status can credit
the wallet. The success/error/cancel callbacks are navigation signals only.

```env
SEPAY_ENABLED="true"
SEPAY_ENVIRONMENT="sandbox"
SEPAY_MERCHANT_ID="..."
SEPAY_SECRET_KEY="..."
SEPAY_PUBLIC_BASE_URL="https://<ngrok-domain>"
SEPAY_IPN_URL="https://<ngrok-domain>/api/payments/sepay/ipn"
```

Configure the same `SEPAY_IPN_URL` in SePay Payment Gateway. The IPN endpoint
expects SePay's `X-Secret-Key` header and returns HTTP `200` after successful
processing. Migration: `20261009190000_sepay_wallet_top_ups`.

The SePay dashboard connectivity test sends a mock `PAYMENT_SUCCESS/CAPTURE`
payload without `X-Secret-Key`. Lambe accepts that specific request only when
both `custom_data.test_mode` and `custom_data.webhook_test` are `true` and the
invoice does not match any stored top-up. This path never mutates wallet data.
Every IPN that can match or settle a real top-up still requires the configured
secret.

For local Docker development, expose port `5000` and use the generated HTTPS
domain as both `SEPAY_PUBLIC_BASE_URL` and the base of `SEPAY_IPN_URL`:

```powershell
ngrok http 5000
docker compose up -d --build lambe_server
```

Configure the dashboard IPN URL as:

```text
https://<ngrok-domain>/api/payments/sepay/ipn
```

The free ngrok domain may change after restarting the tunnel. When it changes,
update `.env`, update the SePay dashboard, then rebuild/restart the backend
container so the new values are loaded.

### SePay API flow

1. Call `POST /api/me/provider/wallet/top-ups/sepay` with a provider user access
   token and `{ "amount": 100000 }`.
2. Open the returned `payUrl`. Never expose merchant credentials to clients.
3. SePay sends the server-to-server IPN. Lambe settles the top-up atomically and
   idempotently.
4. Query `GET /api/me/provider/wallet/top-ups/:id` after checkout navigation.
   Treat only `SUCCEEDED` as paid.

Supported top-up statuses are `CREATED`, `PENDING_PAYMENT`, `SUCCEEDED`,
`FAILED`, and `EXPIRED`. A redirect to the success URL is not payment proof.

Troubleshooting:

- `404` from ngrok: verify the tunnel targets host port `5000` and the URL ends
  with `/api/payments/sepay/ipn`.
- `400`: the dashboard payload does not match the accepted SePay schema.
- `401`: a real IPN is missing or has an invalid `X-Secret-Key`.
- `404` for a real invoice: `invoice_no` does not match a stored top-up.
- `409`: amount, currency, or payment state does not match the pending top-up.
- A dashboard test returning `200` never means money was added. Verify a real
  sandbox payment through the top-up status and wallet transaction.

## Scripts

```bash
npm run build
npm run lint
npm run lint:fix
npm run typecheck
npm run typecheck:test
npm run check
npm run check:all
npm test
npm run test:e2e
npm run prisma:generate
npm run prisma:migrate
npm run prisma:deploy
npm run prisma:status
npm run prisma:studio
npm run admin:create -- --username admin --name "System Admin"
```

## Notes

- Prisma schema chính nằm ở `prisma/schema.prisma`.
- Migration chính nằm ở `prisma/migrations`.
- Không dùng schema/migration trong `src/database/prisma` nữa.
- Redis là cache tùy chọn khi chạy local và được bật mặc định trong Docker.
- Firebase Auth Emulator có thể dùng trong development/test mà không gửi SMS thật.
- Production bắt buộc cấu hình CORS bằng các HTTPS origin cụ thể, Firebase project
  và service account; không được bật Firebase Auth Emulator.
- Refresh token quản trị mới gắn với session bằng chữ ký. Dùng lại token đã xoay
  sẽ thu hồi session và ghi audit. Token cũ tạo trước bản nâng cấp vẫn dùng được
  đến lần refresh tiếp theo nhưng chưa phát hiện được replay.
- Giới hạn tốc độ hiện dùng bộ nhớ từng tiến trình; khi chạy nhiều replica cần
  chuyển sang storage dùng chung để giới hạn chính xác trên toàn hệ thống.
