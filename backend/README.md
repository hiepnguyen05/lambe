# Lambe Backend

Backend NestJS cho Lambe Beauty Booking. Phần hiện tại tập trung vào xác thực bằng số điện thoại, OTP qua SpeedSMS, JWT và PostgreSQL qua Prisma.

## Stack

- NestJS 11
- Prisma 6
- PostgreSQL
- JWT
- SpeedSMS OTP gateway

## Setup

```bash
npm install
```

Tạo file `.env` từ `.env.example`. `JWT_SECRET` và `OTP_HASH_SECRET` phải là
hai giá trị ngẫu nhiên độc lập, mỗi giá trị dài ít nhất 32 ký tự. PostgreSQL
local mặc định được kết nối tại `localhost:5432`.

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

## Auth API

```text
POST /api/auth/send-otp
POST /api/auth/verify-otp
POST /api/auth/complete-registration
GET  /api/auth/me
```

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

## Scripts

```bash
npm run build
npm run lint
npm run lint:fix
npm test
npm run test:e2e
npm run prisma:generate
npm run prisma:migrate
npm run prisma:deploy
npm run prisma:status
npm run prisma:studio
```

## Notes

- Prisma schema chính nằm ở `prisma/schema.prisma`.
- Migration chính nằm ở `prisma/migrations`.
- Không dùng schema/migration trong `src/database/prisma` nữa.
- OTP giả lập chỉ được phép trong môi trường `development` và `test`.
- Production bắt buộc cấu hình CORS và SpeedSMS Access Token.
