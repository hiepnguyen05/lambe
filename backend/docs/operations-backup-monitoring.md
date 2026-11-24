# Backup và cảnh báo vận hành

## Diễn tập backup/restore

Chạy `./scripts/test-postgres-backup-restore.ps1 -SourceDatabase lambe_booking_test_codex`
từ thư mục `backend` trên máy có Docker Compose. Script chỉ nhận tên DB thử
`lambe_booking_test_*`, tạo archive `pg_dump` trong thư mục tạm của máy chạy
script (ngoài Git), khôi phục sang một DB thử **mới**, rồi đối chiếu số bảng, migration đã
hoàn tất, đơn và tin nhắn AI. Nó không xóa DB nguồn hoặc DB khôi phục.

Ngày 13/11/2026, diễn tập trên DB thử cục bộ: archive 532.786 byte; khôi phục
thành công vào `lambe_booking_test_restore_553798afbdc4`; các số đối chiếu là
84 bảng, 62 migration, 23 đơn, 112 tin nhắn AI. Đây là dữ liệu thử, không phải
backup production.

Trước khi bật backup production cần nơi lưu **ngoài máy chủ**, mã hóa archive,
quy định quyền truy cập/thời hạn giữ và lịch diễn tập khôi phục. Không lưu
archive production trong thư mục tạm hoặc thư mục dự án.

## Cảnh báo API

`ops_monitor` là tiến trình riêng trong Docker Compose, kiểm tra
`/api/health` mỗi 60 giây. Sau 3 lần lỗi liên tiếp, nó gửi một email tới
`OPS_ALERT_EMAILS`; khi phục hồi, nó gửi một email nữa. Gửi lỗi sẽ thử lại ở
lần kiểm tra kế tiếp. Lệnh `npm run ops:monitor -- --probe-only` chỉ đọc health;
`npm run ops:monitor -- --send-test` gửi một thư kiểm tra.

Để giám sát cả khi máy chạy Docker chết, chạy cùng script trên **máy khác** với
`MONITOR_HEALTH_URL` trỏ tới URL HTTPS của staging/production, cùng SMTP và
`OPS_ALERT_EMAILS` được cấp riêng. Bản Compose hiện tại chỉ cảnh báo khi API,
PostgreSQL hoặc Redis lỗi trong lúc Docker host còn hoạt động. Nếu SMTP cũng
lỗi, email không thể đến; cần kênh cảnh báo thứ hai trước production.

Email cảnh báo đơn treo sử dụng email gắn với tài khoản Admin/Support đang hoạt
động. Chỉ những tài khoản còn vai trò phù hợp mới được gửi khi mail worker phát
thư. Kiểm tra định kỳ hàng đợi mail/push và trang quan sát nội bộ; health công
khai chưa chứng minh worker hoặc FCM đang gửi thành công.
