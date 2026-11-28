# Tối ưu đặt đơn và phản hồi chuyên viên — 27/11/2026

## Số đo

Đo chỉ đọc trên cùng đơn trong container API, PostgreSQL development từ xa. Mỗi biến thể làm nóng 5 lượt, lấy 20 mẫu, đảo thứ tự giữa các lượt. Không tạo đơn hoặc thay đổi trạng thái trên database thật.

| Phần đọc | Số SQL | p50 | p95 |
| --- | ---: | ---: | ---: |
| Đọc toàn bộ đơn cũ | 13 | 760 ms | 1.019 ms |
| Dữ liệu kiểm tra trước nhận đơn | 3 | 172 ms | 242 ms |
| Phản hồi đơn chờ / vừa nhận / vừa từ chối | 6 | 339 ms | 406 ms |
| Phản hồi đầy đủ không tải ví chuyên viên | 12 | 676 ms | 1.000 ms |
| Nhóm đọc quan hệ khi tạo đơn trước tối ưu | 5 | 288 ms | 573 ms |
| Nhóm đọc quan hệ khi tạo đơn sau tối ưu | 2 | 116 ms | 125 ms |

Lượt đo đầu: đọc cũ p50/p95 743/1.040 ms, đọc kiểm tra nhận đơn 171/246 ms. Kết quả hai lượt cùng chiều. Đây là phép đo nhóm truy vấn đọc, không phải p50/p95 API trọn vẹn hoặc thời gian hiển thị trên máy ảo.

Lặp lại từ thư mục backend bằng `node scripts/benchmark-order-projections.cjs` với DATABASE_URL thích hợp và mã dist đã build. Script chỉ xuất số đo, không xuất dữ liệu khách hàng.

## Thay đổi

- Nhận đơn chỉ tải các snapshot scalar và ID ví trước khi kiểm tra; số dư được đọc lại dưới khóa ví như trước.
- Phản hồi chuyển từ PENDING_PROVIDER và danh sách lọc PENDING_PROVIDER dùng projection nhỏ. Bằng chứng, đánh giá, dịch vụ bổ sung và đổi lịch chưa tồn tại ở trạng thái này; presenter vẫn trả các giá trị mặc định của API. Chi tiết đơn đang thực hiện tiếp tục dùng projection đầy đủ.
- Tạo đơn dùng lại thông tin khách, chuyên viên và dịch vụ đã đọc/kiểm tra trong giao dịch. Không tải lại ba quan hệ đó sau INSERT; lịch sử trạng thái vẫn lấy từ database. Trả cùng cấu trúc công khai và không lộ ví.
- Mobile gộp yêu cầu tải đơn đến trong lúc chuyên viên nhận/từ chối; chỉ tải lại một lượt sau khi thao tác kết thúc. Không hiển thị thành công trước phản hồi API.
- Debug mobile ghi thời gian API orders; backend ghi mọi HTTP không phải SSE chậm từ 1 giây. Không ghi payload/token trong các log thời gian mới.

## Kiểm tra

- Backend: 155 suite, 979 unit test đạt.
- HTTP + PostgreSQL/Redis riêng tại localhost: 57 test đặt đơn cá nhân/tổ chức đạt, gồm quyền chuyên viên, tranh lịch, giữ hoa hồng, từ chối và hoàn thành.
- Mobile: 4 test luồng đơn đến đạt; phân tích mã các tệp liên quan không báo lỗi.
- 40 HTTP request tranh lịch trong suite cục bộ: 937 ms; đây là kiểm tra tính đúng trong môi trường cục bộ, không so trực tiếp với PostgreSQL từ xa.
- Không thêm index theo phỏng đoán; tối ưu số lần đọc quan hệ vốn đang chiếm thời gian mạng. Không đổi schema hay bỏ khóa giao dịch.

## Giới hạn

Chưa có phép đo toàn bộ thao tác trên hai máy ảo cùng phiên khách/chuyên viên. Sau khi cập nhật backend và khởi động lại ứng dụng, dùng log `[Order API]` và `http.request.completed` để đối chiếu độ trễ API với giao diện. Không khẳng định mức giảm tổng thời gian bằng tỷ lệ giảm nhóm SQL.
