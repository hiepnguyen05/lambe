# ADR-0001: Giữ đơn khi có sự cố an toàn

## Trạng thái

Accepted

## Ngày

2026-10-22

## Bối cảnh

Đơn làm đẹp tại nhà có thể phát sinh nguy cơ tới khách hoặc thợ. Luồng hủy đơn
thông thường có thể yêu cầu bằng chứng, chờ bên còn lại quyết định và cuối cùng
giải phóng lịch, tiền giữ. Các đặc tính đó không phù hợp khi người dùng cần báo
nguy hiểm ngay và hệ thống chưa biết bên nào có lỗi.

## Quyết định

Tạo một hồ sơ sự cố duy nhất cho mỗi đơn và chuyển đơn sang trạng thái riêng
`SAFETY_HOLD` bằng transaction. Ảnh/mô tả không phải điều kiện gửi SOS. Trong
trạng thái giữ, đơn không được tiếp tục hoặc hoàn thành; lịch và wallet hold
không tự giải phóng; thợ không được nhận đơn mới. Chỉ `ADMIN` hoặc `SUPPORT`
được đọc hồ sơ riêng tư và đóng hồ sơ. Đóng hồ sơ hiện hủy đơn và giải phóng
tài nguyên trong một transaction, nhưng không tự kết luận trách nhiệm.

## Phương án đã cân nhắc

### Dùng yêu cầu hủy hiện có

Không chọn vì yêu cầu hủy có thể đòi ảnh, chờ khách phản hồi và không tạo mức
ưu tiên riêng cho nhân sự hỗ trợ.

### Hủy đơn ngay khi nhấn SOS

Không chọn vì giải phóng lịch/tiền quá sớm làm mất trạng thái điều tra và có thể
cho thợ tiếp tục nhận đơn trong khi sự cố chưa được xử lý.

### Tự động liên hệ cơ quan khẩn cấp

Chưa chọn vì cần căn cứ pháp lý, dữ liệu vị trí đáng tin cậy, quy trình vận hành
theo địa phương và cơ chế chống báo giả. Mobile phải cung cấp đường gọi khẩn cấp
trực tiếp độc lập với API Lambe.

## Hệ quả

- Cần migration enum và ba bảng sự cố/báo cáo/bằng chứng.
- Discovery, eligibility, lịch và online state phải coi `SAFETY_HOLD` là blocker.
- Bằng chứng dùng private storage và mọi truy cập nội bộ phải được audit.
- Dashboard, push on-call, acknowledgment, SLA và retention là điều kiện còn
  thiếu trước khi công bố đây là hệ thống phản ứng khẩn cấp production.
