# Booking và API đọc công khai — tối ưu ngày 24/11/2026

## Nguyên nhân đã xác nhận

- Lượt tải trước trên image đang chạy ghi nhận 503 với nội dung `Redis rate limiting unavailable.` ở API danh mục và dịch vụ. Log cùng thời điểm cho thấy Redis nối lại nhiều lần. Đây là nguyên nhân trực tiếp khiến các API đó không trả dữ liệu, kể cả khi CPU chỉ 1,10–20,50%. Chưa xác định được lỗi gốc của kết nối Redis/Upstash vì image đang chạy chưa có đủ chi tiết lỗi và chưa được cập nhật từ mã nguồn hiện tại. Xem [phép đo HTTP](live-backend-performance-2026-11-24.md).
- Đường Feed có mốc dự phòng 100 ms, nhưng trước thay đổi này cũng truyền 100 ms vào lệnh Redis dùng chung kết nối. Khi lệnh vượt mốc, logic deadline có thể hủy kết nối dùng chung và làm các yêu cầu khác lỗi trong lúc nối lại. Redis PING trước đó có p99 127 ms, nên cơ chế khuếch đại này có căn cứ; chưa thể khẳng định nó giải thích toàn bộ lỗi 503 trên image cũ.
- Đường báo giá/kiểm tra lịch đặt hẹn thực hiện tuần tự hai cặp truy vấn độc lập: địa chỉ và dịch vụ của thợ; lịch bận và đề xuất đổi lịch. Với PostgreSQL từ xa, mỗi lượt chờ cộng thêm độ trễ mạng. Các truy vấn trong giao dịch tạo đơn vẫn phải kiểm tra lại dưới khóa.

## Thay đổi mã nguồn

- Chỉ các GET công khai của danh mục, dịch vụ và Feed được dùng giới hạn truy cập cục bộ chặt hơn khi Redis lỗi: tối đa 5 cho cửa sổ ngắn, 30 cho cửa sổ dài trên mỗi replica. Các thao tác đặt lịch, ghi dữ liệu, quản trị, đăng nhập và thanh toán tiếp tục chặn khi Redis không khả dụng. Cache dữ liệu công khai vẫn có thể đọc trực tiếp PostgreSQL khi Redis lỗi.
- GET công khai vẫn chuyển sang giới hạn cục bộ sau 100 ms, nhưng lệnh Redis nền giữ deadline chung 1 giây. Một lệnh Feed chậm vừa phải không còn hủy sớm kết nối Redis dùng chung. Khi lệnh thực sự treo, deadline chung vẫn hủy và nối lại kết nối để tránh giữ hàng đợi vô hạn.
- Hai truy vấn địa chỉ/dịch vụ chạy đồng thời trên đường báo giá và kiểm tra lịch; dữ liệu dịch vụ chỉ lấy các trường thực sự được dùng. Dữ liệu tạo đơn vẫn được đọc lại trong giao dịch sau khi khóa.
- Hai truy vấn lịch bận/đề xuất đổi lịch chạy đồng thời. Trong giao dịch Prisma, chúng vẫn dùng kết nối giao dịch duy nhất.

## Phép đo trước/sau trên PostgreSQL development

Mỗi phép đo dùng cùng truy vấn và dữ liệu, làm nóng 5 lần, đảo thứ tự biến thể giữa các lượt. Các script chỉ đọc, không tạo hoặc sửa đơn. Kết quả là thời gian **cặp truy vấn**, không phải thời gian API/đặt lịch trọn vẹn.

| Cặp truy vấn | Mẫu | Trước p50/p95 | Sau p50/p95 | Trung vị tiết kiệm theo cặp |
| --- | ---: | ---: | ---: | ---: |
| Địa chỉ + dịch vụ | 60 | 387/487 ms | 329/409 ms | 51 ms |
| Lịch bận + đề xuất đổi lịch | 40 | 195/260 ms | 116/181 ms | 62 ms |

Payload dịch vụ nội bộ trong mẫu giảm từ 3.035 xuống 1.685 byte. Các lượt đo 40 mẫu trước đó có độ dao động lớn, nên chưa thể dùng kết quả này để cam kết p95 API dưới tải. Script lặp lại: `scratch/benchmark-booking-read-pair.cjs` và `scratch/benchmark-booking-calendar-pair.cjs` ở thư mục gốc workspace.

Một lượt tải đọc 12 giây cho mỗi biến thể trên cùng PostgreSQL development, không ghi dữ liệu (`scratch/benchmark-booking-read-load.cjs`):

| Worker | Trước RPS/p95 | Sau RPS/p95 | Lỗi |
| ---: | ---: | ---: | ---: |
| 4 | 9,40 / 549 ms | 10,78 / 449 ms | 0 |
| 12 | 27,69 / 510 ms | 32,09 / 550 ms | 0 |

Thông lượng tăng ở cả hai mức; p95 tại 12 worker tăng 40 ms trong lượt này. Cần nhiều lượt trên staging với pool metrics trước khi kết luận về khả năng chịu tải cao hơn. Hai biến thể được chạy nối tiếp, nên điều kiện mạng/Neon có thể thay đổi giữa chúng.

## Xác minh và giới hạn

- Unit test mới tái hiện hai lượt chờ tuần tự trước khi sửa và kiểm tra giới hạn Redis của GET công khai không còn hủy sớm kết nối dùng chung. `npm run check` cuối cùng qua 153 suite, 968/968 test, typecheck và lint.
- Booking cá nhân trên PostgreSQL thử nghiệm: 36/36, gồm 40 HTTP request tranh lịch. Booking tổ chức trên PostgreSQL/Redis thử nghiệm: 21/21; một lượt trước đó có 21 ca qua nhưng suite lỗi lúc đóng Prisma (`Engine is not yet connected`), sau đó chạy lại 21/21. Redis fault suite: 9/9. Cần theo dõi lỗi teardown không ổn định này trong CI.
- Image `lambe_server` đang chạy được build ngày 21/11, nên các phép đo HTTP trước đó **chưa** phản ánh bản sửa này. Cần build/phát hành sau khi duyệt, đo lại 503, p95/p99, Redis timeout/reconnect và pool connections trên môi trường thử nghiệm đại diện. Không dùng tải tạo đơn trên dữ liệu thật.
- Khi chạy nhiều replica và Redis lỗi, mỗi replica có bộ đếm cục bộ riêng; cần kiểm tra tổng lưu lượng và số kết nối PostgreSQL trước khi mở rộng số replica. Giới hạn cục bộ chỉ áp dụng cho GET công khai.
- Nếu tỷ lệ 503 không giảm sau phát hành, ưu tiên phân loại lỗi kết nối Upstash, deadline và hàng đợi Redis bằng telemetry cùng timestamp. Không tăng timeout hoặc bỏ giới hạn truy cập theo phỏng đoán.
