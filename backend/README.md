# Lambe Backend

Backend NestJS cho Lambe Beauty Booking. Phần hiện tại tập trung vào xác thực bằng số điện thoại, OTP qua SpeedSMS, JWT và PostgreSQL qua Prisma.

## Stack

- NestJS 11
- Prisma 6
- PostgreSQL
- Redis cache
- JWT
- SpeedSMS OTP gateway

## Architecture

Backend sử dụng modular monolith: mỗi nghiệp vụ nằm trong một NestJS module và
không truy cập trực tiếp vào chi tiết nội bộ của module khác.

```text
src/
├── bootstrap/       # Thiết lập HTTP toàn cục
├── common/          # Thành phần dùng chung không thuộc nghiệp vụ cụ thể
├── config/          # Đọc và kiểm tra biến môi trường
├── infrastructure/  # PostgreSQL, Redis, SMS và audit
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
Chi tiết PostgreSQL, Redis và SMS chỉ đi qua các provider trong
`infrastructure`. Giao dịch thay đổi dữ liệu và audit log được ghi chung một
Prisma transaction. Redis chỉ làm cache-aside và không phải nguồn dữ liệu gốc.

## Setup

```bash
npm install
```

Tạo file `.env` từ `.env.example`. `JWT_SECRET`, `OTP_HASH_SECRET` và
`INTERNAL_JWT_SECRET` phải là ba giá trị ngẫu nhiên độc lập, mỗi giá trị dài ít
nhất 32 ký tự. `INTERNAL_JWT_SECRET` không được trùng với `JWT_SECRET` để token
người dùng và token nội bộ không thể dùng thay thế cho nhau. PostgreSQL local
mặc định được kết nối tại `localhost:5432`.

Lấy Access Token tại SpeedSMS Connect trong `Settings -> Profile`, sau đó thêm
vào `.env`:

```env
SPEEDSMS_ACCESS_TOKEN="your-access-token"
SPEEDSMS_SMS_TYPE="4"
SPEEDSMS_SENDER=""
```

`SPEEDSMS_SMS_TYPE=4` sử dụng brandname mặc định của SpeedSMS. Khi chưa có
token, môi trường development và test sẽ ghi OTP giả lập vào terminal thay vì
gọi API thật. Production luôn bắt buộc có Access Token hợp lệ.

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

Stack Docker gồm backend NestJS, PostgreSQL, Redis và pgAdmin. Service `migrate`
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
pgAdmin:   http://localhost:8080
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
POST /api/auth/send-otp
POST /api/auth/verify-otp
POST /api/auth/complete-registration
GET  /api/auth/me
```

Mỗi HTTP response có header `x-request-id`. Client có thể gửi request ID hợp lệ
hoặc backend sẽ tự sinh UUID; giá trị này được lưu cùng audit log để truy vết.

Luồng hiện tại:

1. Gửi OTP theo số điện thoại.
2. Xác thực OTP.
3. Nếu số đã có tài khoản, backend trả access token.
4. Nếu là số mới, backend trả `registrationToken` có hạn 5 phút.
5. Frontend gửi `registrationToken` và `fullName` để hoàn tất đăng ký.
6. Gửi access token theo dạng `Authorization: Bearer <token>` để gọi `/auth/me`.

OTP chỉ được lưu dưới dạng HMAC hash. Mỗi số điện thoại được yêu cầu tối đa 3
mã trong 10 phút và mỗi mã bị vô hiệu hóa sau 5 lần nhập sai. Khi gửi OTP mới,
các OTP cũ còn hiệu lực của số đó cũng bị vô hiệu hóa.

Body hoàn tất đăng ký:

```json
{
  "registrationToken": "token nhận từ verify-otp",
  "fullName": "Nguyen Van A"
}
```

## Internal Admin Auth

Admin và bộ phận kiểm duyệt sử dụng hệ thống tài khoản nội bộ riêng, không đăng
nhập qua luồng OTP của khách hàng.

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
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"
```

Do not commit the real API key or API secret. Upload folders are selected from a
server-controlled allowlist; arbitrary folder paths and SVG uploads are rejected.

## Standard Services

Standard services are child records of a service category, for example
`Tóc -> Cắt tóc nam`. The platform owns these records; provider offerings and
provider-proposed prices will reference them in a later module.

```text
GET    /api/services?categorySlug=toc
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
  "sortOrder": 0
}
```

Prices are integer VND amounts. Both limits must be positive and
`minPriceAmount <= maxPriceAmount`. New services are `INACTIVE`, and they can
only be activated while their parent category is `ACTIVE`. Cover images must be
uploaded through the dedicated multipart endpoint rather than supplied as URLs.

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
- OTP giả lập chỉ được phép trong môi trường `development` và `test`.
- Production bắt buộc cấu hình CORS và SpeedSMS Access Token.
