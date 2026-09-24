# 🌸 Lambe - Beauty Booking Platform

Nền tảng đặt lịch làm đẹp và chăm sóc cá nhân (Beauty & Spa Booking Platform) hiện đại, phát triển với kiến trúc tách biệt Frontend & Backend.

---

## 📐 Kiến trúc dự án (Architecture)

Dự án bao gồm 2 phần chính:

- **`frontend/`**: Ứng dụng Web dành cho khách hàng phát triển bằng **React 19**, **TypeScript**, và **Vite**. Tổ chức theo kiến trúc **Feature-Sliced Design**.
- **`backend/`**: Hệ thống máy chủ RESTful API phát triển bằng **NestJS 11**, **Prisma ORM**, **PostgreSQL**, tích hợp cổng SMS OTP (**SpeedSMS**) và **JWT Auth**.

```text
Lambe/
├── frontend/             # React + Vite Frontend App
│   ├── src/
│   │   ├── features/     # Auth, Booking, Home features...
│   │   ├── components/   # Layout, UI components
│   │   └── styles/       # Design tokens & CSS variables
│   └── package.json
├── backend/              # NestJS Backend API
│   ├── src/
│   │   ├── modules/      # Auth, Users, Bookings, Database...
│   │   └── config/       # Environment & Security configs
│   ├── prisma/           # Database schema & migrations
│   └── package.json
└── README.md
```

---

## 🚀 Công nghệ sử dụng (Tech Stack)

### Frontend
- **Framework:** React 19, TypeScript
- **Build Tool:** Vite
- **Styling:** CSS Variables (Semantic Tokens), Vanilla CSS
- **Code Quality:** Oxlint / ESLint

### Backend
- **Framework:** NestJS 11, TypeScript
- **ORM:** Prisma 6
- **Database:** PostgreSQL
- **Authentication:** JWT, SpeedSMS Gateway (OTP qua số điện thoại)
- **Security:** HMAC OTP hashing, Rate limiting, Security Headers

---

## 🛠️ Hướng dẫn cài đặt & Chạy ứng dụng (Getting Started)

### 1. Yêu cầu hệ thống (Prerequisites)
- **Node.js**: `>= 18.x`
- **npm** hoặc **yarn / pnpm**
- **PostgreSQL**: Đang chạy tại `localhost:5432`

---

### 2. Cấu hình & Chạy Backend

```bash
cd backend

# Cài đặt dependencies
npm install

# Tạo file cấu hình môi trường từ template
cp .env.example .env
```

*Chỉnh sửa file `.env` trong thư mục `backend` với thông tin kết nối Database và Secret Keys.*

```bash
# Migrate Database & Generate Prisma Client
npm run prisma:deploy
npm run prisma:generate

# Chạy server ở chế độ Development
npm run start:dev
```
> API Server sẽ chạy tại: `http://localhost:5000/api`

---

### 3. Cấu hình & Chạy Frontend

```bash
cd ../frontend

# Cài đặt dependencies
npm install

# Chạy Frontend ở chế độ Development
npm run dev
```
> Web App sẽ chạy tại: `http://localhost:5173`

---

## 🔑 Các tính năng chính (Features)

- 📱 **Xác thực OTP bằng Số Điện Thoại**: Tích hợp cổng SpeedSMS gửi mã OTP, bảo mật bằng mã hóa HMAC.
- 🔐 **Phân quyền & Đăng ký**: Luồng xác thực hai bước (Verify OTP -> Complete Profile -> JWT Session).
- 💅 **Giao diện đặt lịch làm đẹp**: Tìm kiếm dịch vụ, chuyên gia, salon và quản lý lịch hẹn.
- 🎨 **Hệ thống Design System thống nhất**: Sử dụng CSS Variables chuẩn hóa màu sắc và giao diện.

---

## 📝 License & Contact

Phát triển bởi **hiepnguyen05** - [GitHub](https://github.com/hiepnguyen05)
