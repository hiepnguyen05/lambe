# Chính sách kiểm duyệt Feed — phiên bản 1

Ngày áp dụng dự kiến: khi triển khai bản kiểm duyệt nền tảng. Đây là chính sách sản phẩm của Lambe; không phải kết luận pháp lý hay đánh giá điều trị.

Mọi bài mới và bài sửa đều chờ người duyệt. Owner duyệt bài nhân viên không thay thế quyết định của nền tảng. Moderator phải xem toàn bộ ảnh/video, caption, dịch vụ và ngữ cảnh; không kết luận chỉ dựa trên một từ khóa hoặc điểm rủi ro.

| Mã | Cách xử lý |
|---|---|
| SEXUAL_OR_NUDITY | Từ chối ảnh/video khỏa thân tình dục, hành vi tình dục hoặc nội dung khai thác. Ảnh chăm sóc da/vùng da nhạy cảm cần xem ngữ cảnh và mức độ che chắn; không tự coi mọi ảnh cơ thể là vi phạm. |
| PRIVACY_OR_NO_CONSENT | Từ chối khi lộ thông tin riêng tư hoặc có căn cứ không được khách đồng ý. Checkbox consent là lời khai của người đăng, không chứng minh sự đồng ý thực tế. Không yêu cầu công khai giấy tờ khách hàng. |
| MISLEADING_OR_MEDICAL_CLAIM | Yêu cầu sửa/từ chối tuyên bố chữa khỏi, cam kết tuyệt đối, thông tin giá/dịch vụ giả. Ảnh trước/sau có thể được chấp nhận nếu trung thực, đúng dịch vụ và không suy diễn thành bảo đảm hiệu quả. Trường hợp thiếu ngữ cảnh có thể được hiển thị nhưng không được gợi ý. |
| SPAM_OR_SCAM | Từ chối spam lặp, giả mạo, lừa đảo hoặc dụ chuyển tiền ngoài nền tảng. Một đường link hoặc số điện thoại chỉ là tín hiệu cần xem xét, không tự động kết luận lừa đảo. |
| VIOLENCE_OR_GRAPHIC | Từ chối hình ảnh ghê rợn, máu/vết thương hở hoặc nội dung nguy hiểm không phù hợp Feed làm đẹp. Nội dung có bối cảnh chăm sóc không đồ họa có thể duyệt nhưng loại khỏi gợi ý. |
| COPYRIGHT_OR_REUPLOAD | Xử lý theo bằng chứng sở hữu/khiếu nại. Trùng hash chỉ chứng minh trùng byte, không tự chứng minh vi phạm bản quyền. |
| OTHER | Phải ghi rõ quy tắc/ngữ cảnh và phần cần sửa; không dùng lý do chung chung để thay cho việc xem bài. |

Khi từ chối hoặc hạn chế gợi ý, ghi mã và lý do 5–500 ký tự, tránh đưa dữ liệu khách hàng vào ghi chú. Chỉ chọn chặn tái tải media khi chính ảnh/video vi phạm; từ chối caption không đồng nghĩa cấm ảnh. SHA-256 chỉ chặn bản trùng hoàn toàn, không phát hiện bản crop/reencode.

Người đăng có 30 ngày từ quyết định gần nhất để khiếu nại revision bị từ chối/ẩn. Một revision có một lượt khiếu nại. Người quyết định đầu không được xét lại; sửa/xóa bài hoặc có quyết định mới sẽ đóng khiếu nại cũ. Đảo quyết định gỡ bài có thể mở lại bài nhưng vẫn phải qua điều kiện duyệt tổ chức; mặc định chưa cho gợi ý. Nội dung đã bị người đăng xóa không được khôi phục.

Không tự khóa tài khoản sau ba vi phạm. Admin có thể khóa quyền đăng/sửa Feed của một provider với lý do và audit; quyền xem, khiếu nại, xóa bài và xử lý đơn hàng vẫn hoạt động. Mọi nội dung vẫn qua người duyệt, kể cả provider chưa từng vi phạm.

Điểm rủi ro hiện do quy tắc `rules-v1` tạo: chuẩn hóa Unicode/tiếng Việt, nhận diện liên kết, số điện thoại, cam kết điều trị, dấu hiệu chuyển tiền và spam lặp. Điểm không phải xác suất vi phạm. Báo cáo tăng độ ưu tiên; nhiều báo cáo không tự động gỡ bài. Quét ảnh/video bằng mô hình bên ngoài và tự động duyệt chỉ được mở sau khi chọn nhà cung cấp, kiểm tra dữ liệu gửi đi và đánh giá precision/recall/false-positive trên dữ liệu có nhãn.
