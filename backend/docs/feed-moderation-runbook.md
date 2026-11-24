# Vận hành kiểm duyệt Feed

## Triển khai

1. Tạm dừng đăng/sửa Feed và dừng toàn bộ process cũ. Sao lưu DB theo runbook hiện có.
2. Chạy các migration 20261120120000, 20261121000000 và 20261121001000 bằng quy trình Prisma deploy hiện có. Không chỉnh checksum migration đã chạy.
3. Triển khai backend, Admin và mobile đồng bộ. Phiên bản backend cũ không biết cổng kiểm duyệt; không vận hành trộn process cũ/mới.
4. Xác minh bài owner/cá nhân/worker pending không trả qua list/detail/following/saved/recommended, cả cache tắt/bật. Mở lại ghi sau kiểm tra.
5. Theo dõi hàng chờ và thông báo trước khi mở rộng canary. Nếu hàng chờ lỗi, tạm dừng nhận bài, không phê duyệt hàng loạt để chữa lỗi.

Rollback ứng dụng giữ nguyên schema và lịch sử. Không rollback về backend chưa biết cổng kiểm duyệt trong lúc tiếp tục nhận bài. `FEED_SAFETY_ENABLED=false` chỉ dừng quét lại theo quy tắc, không mở bài pending hay bỏ kiểm duyệt thủ công. `FEED_CACHE_ENABLED=false` chuyển đọc DB; không giảm generation/xóa pending outbox.

## API vận hành

- `GET /internal/feed/review-queue`: hàng chờ ưu tiên theo điểm rủi ro, số report, tương tác, rồi tuổi bài/ID. Cursor theo trạng thái sống; khi ưu tiên đổi, làm mới từ đầu để tránh bỏ sót.
- `GET /internal/feed/operations`: backlog, tuổi bài cũ nhất, số quyết định thủ công, khiếu nại đảo quyết định và mẫu lịch sử vi phạm tối đa 50 bài.
- `PATCH /internal/feed/posts/:id/review`: quyết định có revision; từ chối/hạn chế cần mã/lý do; `blockMedia=true` chỉ khi chính media vi phạm.
- `PATCH /internal/feed/reports/:id`: `NO_VIOLATION`, `CONTENT_RESTRICTED`, `CONTENT_REMOVED`. Hai mã cũ DISMISSED/POST_HIDDEN được ánh xạ tương thích. Mọi report đang mở của revision được đóng cùng transaction, bản ghi và ghi chú vẫn giữ.
- `GET/PATCH /internal/feed/comment-reports/:id`: danh sách dùng GET `/comment-reports`, quyết định PATCH nhận `{hide,note}`. Nội dung ẩn giữ tombstone và replies; chỉ Moderator/Admin xử lý.
- `PATCH /internal/feed/providers/:id/posting-restriction`: Admin, `{blocked,note}`; chỉ ảnh hưởng đăng/sửa Feed.
- `GET /me/feed/notices`, `PATCH /me/feed/notices/:id/read`: thông báo theo tài khoản. Ghi chú quản lý chỉ hiện khi còn quyền đọc bài; reporter chỉ nhận kết quả chung.

Lịch sử và quyết định/audit nằm trong PostgreSQL. Sự cố gửi email/push không thay đổi quyết định; outbox có retry độc lập. Email gửi thông báo chung tới email liên hệ trong hồ sơ provider được duyệt; không chứa caption/ghi chú/thông tin khách. Worker nhận in-app/push, không giả định có email riêng.

Push dùng `FEED_NOTICE`, thông điệp tối thiểu, kiểm tra lại session/device và quyền đọc notice ngay trước gửi. Thông báo reporter được tạo theo lô khi đóng report và relay tối đa 20 notice mỗi vòng; khử trùng theo notice/device. Bật SMTP/Firebase theo cấu hình hiện có mới có giao thực tế. Không dùng test tự động làm bằng chứng email đã đến hộp thư hoặc push đã tới máy thật.

## Bảo vệ media

Media mới được upload Cloudinary với type `authenticated`. Sau khi kiểm tra quyền/trạng thái, server cấp URL download ký có hạn 300 giây cho ảnh và video. Original và bản biến đổi không có chữ ký không được công khai. URL đã được cấp vẫn có thể dùng đến hạn; không thể thu hồi file người dùng đã tải. Cache snapshot TTL 120 giây ngắn hơn hạn URL; offline cache có thể cần refresh khi URL hết hạn.

Ảnh/video legacy có `deliveryType=upload` vẫn dùng URL cũ. Không đánh dấu toàn bộ kho legacy đã riêng tư; cần kiểm kê và chuyển delivery type theo quy trình riêng trước khi cam kết thu hồi URL legacy. Cloudinary ghi rõ URL download ký không dùng cache CDN và có chi phí băng thông cao hơn: [tài liệu Cloudinary](https://cloudinary.com/documentation/control_access_to_media). Với tải lớn, đánh giá token-based delivery phù hợp gói dịch vụ trước khi đổi cơ chế.

Đã chuẩn bị `scripts/migrate-feed-private-media.ts`: mặc định chỉ đếm asset legacy. Khi đã backup, dừng ghi và dừng worker, operator chạy với `--run --writes-paused --database=<tên DB chính xác>`. Script đổi delivery type bằng Cloudinary rename `to_type=authenticated`, yêu cầu invalidate CDN, cập nhật metadata/cleanup và tăng generation cache qua trigger cập nhật bài. Nếu remote thành công nhưng DB thất bại, chạy lại sẽ kiểm tra asset authenticated để tiếp tục. Chưa chạy chuyển kho legacy thật vì người dùng chọn nghiệm thu cục bộ. Invalidation CDN có độ trễ, cần kiểm tra URL legacy sau chuyển theo [Cloudinary rename](https://cloudinary.com/documentation/image_upload_api_reference).

TTL snapshot có chặn trên 240 giây dù biến môi trường cao hơn, để không giữ URL download quá hạn 300 giây. Đây là điều chỉnh bảo vệ tính đúng của cache media.

Chạy probe bằng dữ liệu giả: `npx ts-node scripts/verify-feed-private-media.ts --run` cho PNG; thêm `--video` để tạo MP4 đen 1 giây bằng ffmpeg. Script không sửa DB nghiệp vụ, chỉ upload một asset giả rồi xóa trong finally, không in credential/URL ký. Ngày 20/11/2026 đã kiểm chứng Cloudinary thật: URL không ký bị từ chối, URL ký xem được, URL hết hạn bị từ chối; cả ảnh và video thử đã được xóa.

## Phạm vi kiểm chứng và phần cần môi trường thật

Các bộ test Feed dùng DB `lambe_booking_test_*` và Redis 15, không reset DB ứng dụng. Cần nghiệm thu cuối trên thiết bị thật, email/push thật, staging và kiểm tra migration/backup theo quy trình triển khai. Quét ảnh/video bằng AI bên ngoài, tự duyệt theo confidence, ML/A-B vẫn là bước có điều kiện; hiện không có nhà cung cấp/model được chọn và không tự gửi media khách sang một dịch vụ mới.
