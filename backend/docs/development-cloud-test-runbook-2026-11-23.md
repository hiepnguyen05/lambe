# Kiểm thử Neon và Upstash hiện tại trong môi trường phát triển

Theo xác nhận của chủ dự án ngày 23/11/2026, Lambe chưa lên production và dữ liệu trên Neon/Upstash hiện tại có thể dùng để kiểm thử. Bộ lệnh này **không sửa `.env`**; nó đọc cấu hình hiện tại rồi tự đặt `NODE_ENV=test`, dùng JWT/key giả và tắt Firebase, Cloudinary, email, MoMo, SePay và Gemini trong tiến trình test. Lệnh chỉ in trạng thái hoặc số đếm; không in URL, mật khẩu hay nội dung lỗi kết nối.

Trong PowerShell của máy (nơi kết nối Internet/DNS hoạt động):

```powershell
cd D:\Project\Lambe\backend
npm run dev-cloud:check
npm run dev-cloud:probe
npm run dev-cloud:status
```

`check` kiểm tra URL Neon pooled/direct và Upstash TLS mà không mở kết nối. `probe` chỉ đọc `current_database`, phiên bản, `max_connections`, số kết nối hiện tại nếu được cấp quyền, Redis `PING` và `DBSIZE`. `status` kiểm tra migration; **không chạy migration**. Nếu migration chưa áp dụng và bạn muốn kiểm tra booking với schema hiện tại:

```powershell
npm run dev-cloud:migrate
npm run dev-cloud:booking
```

`migrate` sử dụng `DIRECT_URL` của chính database phát triển. `booking` dùng Jest booking integration, tạo các tài khoản, dịch vụ và đơn hàng giả với ID ngẫu nhiên trong database phát triển; suite hiện chỉ đóng kết nối sau khi chạy và **chưa dọn toàn bộ fixture**. Nếu muốn giữ dữ liệu phát triển sạch, chỉ chạy `check`, `probe`, `status` trước. Bộ chạy không cho `booking` hoặc migration chạy khi probe PostgreSQL thất bại; `booking` còn yêu cầu Upstash sẵn sàng. Lỗi chỉ báo giai đoạn thất bại, không in raw exception chứa bí mật.

Từ phiên ChatGPT Work Mode hiện tại, DNS Upstash trả `ENOTFOUND` và PostgreSQL không khởi tạo được client. Vì vậy không có kết quả test cloud thật trong phiên này. Chạy các lệnh trên trong PowerShell của máy rồi chia sẻ **chỉ kết quả JSON đã lọc** để tiếp tục phân tích. Script baseline cũ yêu cầu database/Redis hoàn toàn trống; không chạy nó trên dữ liệu phát triển hiện tại.

Để đổi lại phương án cô lập, dùng mẫu `.env.cloud-test.example` để chuẩn bị Neon database và Upstash riêng. Guard cloud và guard development đều từ chối URL/test flags không khớp.

Giới hạn hiện tại: bài test booking dùng PostgreSQL thật nhưng mô phỏng Redis; bước probe chỉ xác nhận Upstash trả lời PING và DBSIZE. Kiểm tra timeout và phục hồi Redis thật cần một suite riêng.
