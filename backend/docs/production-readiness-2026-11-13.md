# Tình trạng hoàn thiện backend — 13/11/2026

## Đã triển khai và kiểm chứng

- CI backend chạy cài đặt theo lockfile, tạo Prisma client, áp dụng migration
  trên PostgreSQL tạm, typecheck, lint, unit test, API e2e và AI integration
  trên Redis database 15.
- Watchdog đơn treo gửi `ORDER_DELAYED` qua order notification/push relay tới
  khách và người phục vụ; xếp email cho Admin/Support và nhắc lại khi quá hạn.
- Mail worker kiểm tra lại tài khoản, email và vai trò trước khi gửi cảnh báo.
- Support có thể hủy đơn chưa bắt đầu bằng cảnh báo, giải phóng hold/lịch/voucher
  trong một transaction. Đơn đang thực hiện quá hạn được chuyển sang tranh chấp
  và vẫn giữ hold cho tới khi có quyết định thanh toán.
- Runtime Docker build ngày 13/11 báo 9 advisory mức trung bình, không có mức
  cao/nghiêm trọng trong image cuối. `nodemailer` 10.5.0 và
  `fast-xml-parser` 5.12.0 được khóa trong lockfile. `ts-jest` đã nâng lên
  29.4.15 để loại advisory nghiêm trọng của Handlebars trong cây build/test.
- `npm run check`: 144 suite, 840 test đạt. API e2e: 10 suite, 79 test đạt.
  AI integration: 25 test đạt; booking integration: 21 test đạt. Container cục bộ healthy; lượt quét
  thật không tạo bản ghi cảnh báo trùng.
- API feedback AI ghi nhận mức hữu ích/lý do, chỉ cho chủ hội thoại cập nhật
  phản hồi đã hoàn tất; đánh giá được xóa theo hội thoại. Migration đã chạy
  thành công trên database thử riêng và Docker cục bộ. Health sau cập nhật:
  HTTP 200, PostgreSQL và Redis đều `up`.
- Diễn tập backup/restore ngày 13/11 trên DB thử đạt: 84 bảng, 62 migration,
  23 đơn, 112 tin nhắn AI khớp sau khôi phục. Monitor độc lập trong Compose
  đang chạy và báo health `ok`; SMTP đã chấp nhận thư thử tới email Admin.

## AI: kết quả kiểm chứng trực tiếp

`npm run ai:evaluate -- --live` dùng 5 câu tổng hợp, không lấy hội thoại khách.
Ngày 13/11: lượt đầu 1/5 câu có phản hồi; lượt sau 4/5, câu nail vẫn lỗi sau
12 giây. Kết quả biến động và chưa đạt điều kiện mở rộng/chấm 30 ca. Cần chạy
lại theo nhiều thời điểm, chấm tay độ phù hợp dịch vụ và an toàn; không coi
fallback là bằng chứng model hoạt động.

## Dữ liệu nhạy cảm và việc chưa thể bật

| Nhóm dữ liệu | Nơi lưu chính | Trạng thái |
| --- | --- | --- |
| KYC, giấy tờ, ảnh riêng tư | PostgreSQL và Cloudinary | Có phân quyền; chưa chốt thời hạn lưu/xóa |
| Địa chỉ, số điện thoại đơn | PostgreSQL | API vận hành có projection theo role; cần kiểm thử IDOR/BOLA toàn diện |
| Chat và tư vấn AI | PostgreSQL | Có quyền sở hữu và quota; chưa chốt thời hạn lưu/xóa |
| Log/audit | PostgreSQL và log container | Cần rà định kỳ trường metadata/retention và kho log tập trung |

Theo quyết định của nhóm, giữ nguyên KYC/ảnh bằng chứng cho tới khi có chính
sách thời hạn lưu. Có [truy vấn báo cáo chỉ đọc](sensitive-media-inventory.sql)
đếm số ảnh/tài liệu và tuổi lưu theo nhóm, không trả ID hay URL. Chưa chạy job
xóa hay thử xóa dữ liệu thật. Trên DB Docker cục bộ ngày 13/11, cả bốn nhóm
trong báo cáo đều có 0 bản ghi; đây không phải kiểm kê môi trường production.

## Chưa đạt production

- Đã diễn tập [backup/restore trên DB thử](operations-backup-monitoring.md)
  và chuẩn bị script. Chưa có nơi lưu ngoài máy chủ, mã hóa, lịch backup hay
  diễn tập restore từ bản sao production.
- Đã thêm monitor riêng trong Docker Compose và thử gửi email SMTP. Monitor
  trên cùng host không phát hiện được host chết; cần chạy thêm ở máy khác.
  Health chưa bao phủ worker, SMTP hoặc FCM lỗi kéo dài; cần kênh cảnh báo thứ
  hai để phát hiện SMTP hỏng.
- Chưa có kiểm thử phân quyền IDOR/BOLA toàn diện. API e2e đã kiểm tra quyền
  đăng nhập Support, chặn tài khoản khác đối với feedback AI và không cho
  tài khoản khác hủy/đổi lịch/nhận đơn. Kiểm thử giao
  dịch thật trên DB riêng xác nhận hủy đơn trước dịch vụ giải phóng hold/lịch,
  còn tranh chấp khi đang thực hiện giữ nguyên hold.
- AI live hiện không ổn định. Đã chuẩn bị 30 ca tổng hợp và feedback API;
  chưa có kết quả chấm chuyên môn/thiết bị thật cho cả 30 ca.
- Cây cài đặt đầy đủ sau cập nhật còn 31 advisory (2 low, 23 moderate, 6 high,
  0 critical), gồm dependency build/test. Image production sau `npm prune --omit=dev
  --omit=peer` còn 9 moderate. Không nâng Prisma major khi chưa kiểm thử tương
  thích migration; tiếp tục theo dõi advisory.

Không kết luận sẵn sàng production từ health 200 hoặc unit test. Cần môi trường
staging, diễn tập backup/restore, kiểm thử bảo mật và kênh trực vận hành.
