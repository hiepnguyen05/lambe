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
POST /api/auth/complete-registration
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
5. Nếu số đã có tài khoản, backend trả access token Lambe.
6. Nếu là số mới, backend trả `registrationToken` có hạn 5 phút.
7. Frontend gửi `registrationToken` và `fullName` để hoàn tất đăng ký.
8. Gửi access token theo dạng `Authorization: Bearer <token>` để gọi `/auth/me`.

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

Swagger is available at `http://localhost:5000/docs` outside production and test.
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
POST   /api/provider-applications/:id/documents/:type
GET    /api/provider-applications/:id/documents/:documentId/access
DELETE /api/provider-applications/:id/documents/:documentId
POST   /api/provider-applications/:id/terms/accept
POST   /api/provider-applications/:id/email/request-code
POST   /api/provider-applications/:id/email/verify
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
POST  /api/admin/provider-applications/:id/request-changes
POST  /api/admin/provider-applications/:id/reject
POST  /api/admin/provider-applications/:id/approve
```

Các nhóm kiểm tra là `IDENTITY`, `PORTRAIT`, `EXPERTISE`, `SERVICES` và `TERMS`.
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
- `SERVICE_REVIEWER`: chỉ xét duyệt `EXPERTISE`, `SERVICES` và dịch vụ đề xuất;
  không xem CCCD/tài liệu KYC và không duyệt/từ chối toàn bộ hồ sơ.
- `SUPPORT`: xem danh sách và thông tin tiến độ tối thiểu, không xem giấy tờ,
  ngày sinh hoặc CCCD. Vai trò mới không tự động cấp cho tài khoản hiện có.

Duyệt trực tiếp vẫn yêu cầu đủ các hạng mục đã xác minh, điều kiện dịch vụ/giá
hợp lệ và email đã xác minh. Audit log ghi người ra quyết định thực tế; cơ chế
chống duyệt trùng và gửi email kết quả vẫn áp dụng như trước.

Người đăng ký cá nhân phải đủ 18 tuổi (ngày tại Việt Nam). `birthDate` chỉ nhận
`YYYY-MM-DD`. Email phải được xác minh trước khi nộp hồ sơ. Yêu cầu mã bằng
`POST /api/provider-applications/:id/email/request-code`, sau đó xác minh bằng
`POST /api/provider-applications/:id/email/verify` với body `{"code":"123456"}`.
Mã hết hạn sau 10 phút, tối đa 5 lần nhập sai, gửi lại cách nhau ít nhất 60 giây.
Đổi email làm mất xác minh cũ. `emailVerifiedAt` không nhận từ client.
Hồ sơ cũ đang `PENDING_REVIEW` vẫn được xác minh email hiện tại (không được
chỉnh sửa nội dung); tránh phải tự coi email cũ là đã xác minh khi migration.

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
  "serviceRadiusKm": 10,
  "workingHours": [{ "dayOfWeek": 1, "startMinute": 480, "endMinute": 1020 }],
  "enabledServiceIds": ["<ProviderService.id đã được duyệt>"]
}
```

Lịch theo giờ Việt Nam; 0 là Chủ nhật, 1-6 là Thứ hai-Thứ bảy. Bán kính 1-50 km,
tối đa 21 khung giờ không chồng lấn và ít nhất một dịch vụ đủ điều kiện. Không
được dùng thiết lập để bỏ đình chỉ hồ sơ/dịch vụ. Cấu hình hợp lệ chuyển hồ sơ
từ `SETUP_REQUIRED` sang `ACTIVE`, **không bật nhận đơn**. Vị trí online, kiểm
tra số dư ví, giới hạn địa lý và tìm thợ gần khách vẫn thuộc luồng nhận đơn sẽ
phát triển riêng. `serviceAreaName` hiện là mô tả, chưa phải ranh giới địa lý.

Chưa bật tự động xóa KYC của hồ sơ cũ: cần chốt thời hạn lưu trữ, ngoại lệ khiếu
nại và quy trình xóa Cloudinary trước. Các thử nghiệm tự động dùng dữ liệu giả,
database kiểm thử riêng và mock email/upload, không gửi SMS/email thật.

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
- Production bắt buộc cấu hình CORS, Firebase project và service account.
