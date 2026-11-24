# 🌸 Lambe - Beauty Booking Platform

Lambe kết nối khách hàng với đối tác thực hiện dịch vụ làm đẹp tại nhà.
Ứng dụng gồm backend NestJS, mobile Flutter và web React; Lambe là nền tảng
kết nối, đối tác là đơn vị trực tiếp cung cấp dịch vụ.

---

## 📐 Kiến trúc dự án (Architecture)

Dự án bao gồm 3 phần chính:

- **`frontend/`**: Ứng dụng Web dành cho khách hàng phát triển bằng **React 19**, **TypeScript**, và **Vite**. Tổ chức theo kiến trúc **Feature-Sliced Design**.
- **`backend/`**: API nghiệp vụ bằng NestJS 11/Prisma, PostgreSQL và Redis; JWT Lambe, Firebase Authentication và SSE.
- **`mobile/`**: Ứng dụng Flutter cho khách hàng/đối tác, tích hợp API và Firebase phía client.

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
├── mobile/               # Flutter application
├── tailieuUI.md          # Luồng màn hình và dữ liệu API
├── tailieunghiepvu.md     # Phân tích nghiệp vụ
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
- **Database/cache:** PostgreSQL, Redis
- **Authentication:** Firebase Phone/Google/Facebook → JWT và phiên Lambe; tài khoản nội bộ đăng nhập riêng
- **Security:** Input validation, kiểm tra quyền theo tài nguyên, rate limiting và security headers

---

## 🛠️ Hướng dẫn cài đặt & Chạy ứng dụng (Getting Started)

### 1. Yêu cầu hệ thống (Prerequisites)
- Docker Desktop cho backend/PostgreSQL/Redis; image backend hiện dùng Node.js 22.
- Node/npm cho công cụ phát triển web/backend; Flutter SDK cho mobile.
- PostgreSQL dùng Neon; Docker chỉ chạy backend, Redis và các dịch vụ phụ trợ. Backend dùng cổng 5000.

---

### 2. Cấu hình & Chạy Backend

```powershell
cd backend

# Tạo mẫu nếu chưa có cấu hình, giữ file .env hiện tại.
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

*Chỉnh sửa file `.env` trong thư mục `backend` với thông tin kết nối Database và Secret Keys.*

```powershell
# Sau khi cấu hình biến môi trường/credential theo backend/README.md:
docker compose up -d --build
```
> API Server sẽ chạy tại: `http://localhost:5000/api`

Cấu hình chi tiết: [Backend README](backend/README.md).
Kết nối emulator/máy thật: [Mobile README](mobile/README.md). Đường dẫn/biến kết
nối bên trong Docker khác địa chỉ host; không dùng DB ứng dụng cho kiểm thử.

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

- 📱 **Xác thực người dùng**: Firebase Phone/Google/Facebook; backend kiểm tra ID token, hoàn thiện tài khoản và cấp phiên Lambe.
- 🔐 **Phân quyền**: User, đối tác và tài khoản vận hành nội bộ theo phạm vi API.
- 💅 **Giao diện đặt lịch làm đẹp**: Tìm kiếm dịch vụ, chuyên gia, salon và quản lý lịch hẹn.
- 🎨 **Hệ thống Design System thống nhất**: Sử dụng CSS Variables chuẩn hóa màu sắc và giao diện.

---

## Tài liệu tích hợp

- [Phân tích nghiệp vụ](tailieunghiepvu.md)
- [Luồng màn hình và API cho mobile/frontend](tailieuUI.md)
- [Booking API](backend/docs/booking-api.md)
- [Order Safety/SOS API](backend/docs/order-safety-api.md)
- [Operations API](backend/docs/operations-api.md)
- [Chat khách–thợ REST/SSE, ảnh và retry](backend/docs/customer-provider-chat-design.md)
- [Chatbot AI và kiểm tra lại gợi ý](backend/docs/ai-consultation-api.md)
- [Kiểm thử, vận hành và giới hạn chat/AI](backend/docs/chat-ai-verification.md)
- [API giám sát dành cho Admin — contract dữ liệu đầy đủ](backend/docs/observability-api.md)
- [Runbook cấu hình, sự cố, kiểm thử và rollback P6](backend/docs/quality-operations-runbook.md)
- [Nghiệm thu P6, hiệu năng và giới hạn](backend/docs/quality-verification-2026-10-30.md)
- [Dependency runtime đã đối chiếu](backend/docs/quality-runtime-dependencies-2026-10-31.md)
- [So sánh hợp đồng OpenAPI](backend/docs/quality-openapi-compatibility.md)
- [Kế hoạch và tiến độ](tasks/ke-hoach-cai-tien-he-thong.md)
- Swagger khi backend development đang chạy: `http://localhost:5000/docs`

Mốc chat/AI 30/10/2026: retry ảnh/thẻ dịch vụ, kiểm tra lại card/giá và refresh
lịch sử đã triển khai; 774 unit backend, 93 integration/E2E liên quan và
215 test Flutter đạt. Đây là mốc kiểm chứng, không thay nghiệm thu thiết bị
thật/chất lượng AI. Phần đối tác tổ chức tạm ngưng phát triển thêm;
MoMo/SePay giữ sandbox, rút tiền nằm ngoài phạm vi hiện tại.

Mốc P6 **31/10/2026** bổ sung sau mốc chat/AI ở trên: **313 HTTP API / 101
schema**, Admin-only observability, khôi phục Redis/realtime, health và log
được giới hạn. Đã nghiệm thu 808 unit backend, 319 trường hợp API/integration
duy nhất và 215 Flutter test; kết quả/giới hạn nằm trong báo cáo P6. Hoàn thành
27/39 mục QA, chưa chốt 12 mục còn mở hoặc nghiệm thu production toàn roadmap.

## 📝 License & Contact

Phát triển bởi **hiepnguyen05** - [GitHub](https://github.com/hiepnguyen05)
