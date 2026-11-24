# Kế hoạch nâng cấp kiểm duyệt Beauty Feed

Cập nhật: 20/11/2026

## Tiến độ hoàn thiện cục bộ

Đã triển khai cổng kiểm duyệt bắt buộc, hàng chờ ưu tiên, lịch sử, outbox in-app/push/email, gộp report theo revision, khiếu nại 30 ngày, đóng khiếu nại cũ khi sửa/xóa, kiểm duyệt bình luận, chống spam lặp, hash media cấm và khóa riêng quyền đăng Feed. Admin/mobile đã nối các luồng này. Media mới riêng tư với URL ký 300 giây; hồ sơ thợ và chatbot cũng áp dụng URL có hạn và cổng hiển thị.

Migration `20261120120000_feed_platform_moderation` đã chạy trên database thử riêng. Chưa áp dụng migration vào DB ứng dụng hoặc restart server đang chạy. Chỉ sau khi migration và bản server mới được triển khai thì hành vi mới có hiệu lực trên ứng dụng hiện tại.

Người dùng đã chốt chưa có staging, hoàn tất mã nguồn và kiểm thử cục bộ. [Chính sách](feed-content-policy.md) và [runbook](feed-moderation-runbook.md) ghi quy tắc/giới hạn và cách triển khai. Các mục staging/production, giao email/push tới thiết bị thật và chuyển kho media legacy được giữ là nghiệm thu vận hành chưa chạy. Quét ảnh/video bằng nhà cung cấp AI bên ngoài và tự duyệt là hạng mục có điều kiện, chưa được chọn dịch vụ/model; bản hiện tại dùng `rules-v1` hỗ trợ người duyệt.

Đã diễn tập 68 migration từ DB rỗng và nâng cấp DB thử có dữ liệu, kiểm thử rollback quyết định/audit/outbox và quyền truy cập. Probe Cloudinary thật đã đạt với PNG giả và MP4 đen: URL không ký/hết hạn bị chặn, URL có hạn hoạt động; toàn bộ asset giả đã xóa. Các bộ kiểm thử và giới hạn được ghi trong runbook; không coi test cục bộ là nghiệm thu production.

Bằng chứng chi tiết: [báo cáo nghiệm thu cục bộ](qa/feed-moderation-2026-11-20.md). Kho media cũ có script chuyển riêng tư với dry-run và cơ chế tiếp tục sau lỗi; chưa chạy chuyển dữ liệu nghiệp vụ.

## Mục tiêu

Không để bài mới hoặc bài vừa sửa xuất hiện công khai trước khi qua kiểm duyệt nền tảng. Duyệt nội bộ của tổ chức và kiểm duyệt an toàn là hai quyết định độc lập. PostgreSQL tiếp tục là nguồn trạng thái chuẩn; cache và hệ thống gợi ý chỉ đọc bài đã đủ điều kiện.

Phiên bản đầu dùng người kiểm duyệt. Chưa dùng AI làm người ra quyết định cuối và chưa xây mô hình ML riêng. Khi có đủ dữ liệu quyết định thật, hệ thống tự động chỉ chấm điểm rủi ro, phát hiện trường hợp rõ ràng và ưu tiên hàng chờ.

## Hiện trạng cần khắc phục

- [x] Ảnh/video đã có kiểm tra định dạng, kích thước, thời lượng và số lượng.
- [x] Bài có khách hàng yêu cầu người đăng xác nhận consent.
- [x] Worker phải qua owner duyệt; owner tự được duyệt nội bộ.
- [x] Người dùng có thể báo cáo bài; Admin/Moderator có thể ẩn hoặc hiện lại.
- [x] Quyết định hiện tại có audit cơ bản.
- [x] Đóng đường owner/cá nhân đăng thẳng lên Feed.
- [x] Trạng thái kiểm duyệt độc lập với vòng đời và duyệt tổ chức.
- [x] Lý do chính sách, thông báo quyết định và khiếu nại.
- [x] Tách hiển thị khỏi điều kiện được gợi ý, gồm cả chatbot.
- [x] Hàng chờ ưu tiên theo rủi ro, report và tương tác; dashboard theo dõi backlog/tuổi chờ/thời gian duyệt/tỷ lệ đảo quyết định.
- [x] Kiểm duyệt bình luận và chống tái tải media trùng byte đã xác nhận vi phạm.

## Mô hình trạng thái

Giữ `FeedPostStatus` hiện có cho vòng đời bài (`PUBLISHED`, `HIDDEN`, `DELETED`) để tránh phá API. Thêm hai chiều trạng thái độc lập:

```text
Kiểm duyệt nền tảng:
PENDING -> APPROVED | REJECTED

Khả năng được gợi ý:
INELIGIBLE | ELIGIBLE

Cổng public:
status=PUBLISHED
AND moderationStatus=APPROVED
AND organizationReviewStatus IS NULL hoặc APPROVED

Cổng recommended:
cổng public
AND recommendationStatus=ELIGIBLE
```

Quy tắc bắt buộc:

- [x] Mọi bài mới, kể cả owner và provider cá nhân, bắt đầu với `moderationStatus=PENDING` và `recommendationStatus=INELIGIBLE`.
- [x] Worker cần cả owner duyệt và nền tảng duyệt; thứ tự hai quyết định không ảnh hưởng kết quả.
- [x] Sửa caption hoặc dịch vụ làm bài quay lại `PENDING` và `INELIGIBLE`.
- [x] `REJECTED` không xuất hiện public dù `FeedPostStatus=PUBLISHED`.
- [x] Provider không thể tự đổi trạng thái kiểm duyệt hoặc mở lại bài bị nền tảng ẩn.
- [x] Chỉ Admin/Moderator có quyền ra quyết định; quyết định khiếu nại phải do tài khoản khác xử lý.

## Giai đoạn 1: Chính sách và dữ liệu

- [x] Chốt bộ mã chính sách phiên bản 1:
  - `SEXUAL_OR_NUDITY`
  - `PRIVACY_OR_NO_CONSENT`
  - `MISLEADING_OR_MEDICAL_CLAIM`
  - `SPAM_OR_SCAM`
  - `VIOLENCE_OR_GRAPHIC`
  - `COPYRIGHT_OR_REUPLOAD`
  - `OTHER`
- [x] Viết hướng dẫn riêng cho ảnh trước/sau, vùng da nhạy cảm, thủ thuật thẩm mỹ, vết thương và nội dung có khách hàng.
- [x] Thêm enum `FeedModerationStatus` và `FeedRecommendationStatus`.
- [x] Thêm trạng thái hiện tại vào `FeedPost`: trạng thái, mã chính sách, ghi chú ngắn, thời điểm và người quyết định.
- [x] Thêm `FeedModerationDecision` bất biến qua API để lưu lịch sử quyết định theo `postId` và `revisionNumber`.
- [x] Thêm `FeedModerationAppeal`, tối đa một khiếu nại cho mỗi revision.
- [x] Migration backfill bài cũ: bài public hợp lệ thành `APPROVED`; bài `HIDDEN/DELETED` giữ nguyên vòng đời. Ghi nguồn `LEGACY_BACKFILL` để phân biệt với quyết định thật.
- [x] Thêm index cho hàng chờ theo `moderationStatus`, `createdAt` và `id`.

Điều kiện hoàn thành:

- [x] Migration chạy được trên DB thử sạch và DB thử có dữ liệu cũ.
- [x] Runbook rollback giữ schema/lịch sử, không quay về backend bỏ qua kiểm duyệt khi vẫn nhận bài.
- [x] Không dùng `organizationReviewStatus` thay cho kiểm duyệt nền tảng.

## Giai đoạn 2: Chặn công khai trước khi duyệt

- [x] Khi tạo bài, ghi `PENDING/INELIGIBLE` trong cùng transaction với bài và media metadata.
- [x] Cập nhật `publicFeedWhere`, truy vấn SQL live, detail, following, saved và gợi ý để áp dụng cùng một cổng hiển thị.
- [x] Cache trigger hiện có bao phủ mọi thay đổi bài, gồm trạng thái kiểm duyệt và khả năng gợi ý.
- [x] Không ghi snapshot Redis cho bài chưa được duyệt.
- [x] Khi sửa bài, tăng revision và vô hiệu quyết định của revision cũ.
- [x] API quản lý bài trả trạng thái kiểm duyệt và lý do an toàn cho chính provider; API public không trả metadata nội bộ.
- [x] Mobile hiển thị chờ kiểm duyệt, công khai/bị ẩn/bị từ chối, lý do và form khiếu nại.

Điều kiện hoàn thành:

- [x] Owner, worker và provider cá nhân đều không thể làm bài pending xuất hiện public.
- [x] Cache cũ không thể làm bài pending/rejected xuất hiện lại.
- [x] Hai quyết định tổ chức/nền tảng đến theo mọi thứ tự vẫn cho kết quả đúng.

## Giai đoạn 3: Hàng chờ và quyết định của Moderator

- [x] Thêm API danh sách bài `PENDING`, phân trang cursor ổn định.
- [x] Trả đủ caption, ảnh/video, provider, dịch vụ, consent khai báo, số báo cáo và revision cho người kiểm duyệt.
- [x] Thêm API quyết định với optimistic concurrency theo `revisionNumber`:
  - `APPROVE` và chọn `ELIGIBLE` hoặc `INELIGIBLE`.
  - `REJECT` bắt buộc policy code và ghi chú 5–500 ký tự.
- [x] Ghi quyết định, cập nhật bài, audit và event thông báo trong cùng transaction.
- [x] Ngăn hai moderator xử lý cùng một revision; người xử lý sau nhận `409`.
- [x] Giao diện Admin có chờ duyệt, báo cáo sau đăng và lịch sử tại chi tiết từng bài.
- [x] Xem video theo yêu cầu, không tự phát toàn bộ video trong danh sách.
- [x] Bỏ số điện thoại người báo cáo khỏi response kiểm duyệt vì không cần cho quyết định nội dung.

Ưu tiên hàng chờ phiên bản đầu:

```text
độ nghiêm trọng của lý do
-> bài đang có nhiều report chưa xử lý
-> bài có nhiều lượt xem/tương tác
-> thời gian chờ lâu nhất
```

Không cần ML để sắp hàng chờ ở giai đoạn này.

## Giai đoạn 4: Báo cáo, thông báo và khiếu nại

- [x] Khi một quyết định xử lý bài được đưa ra, đóng tất cả report đang mở của revision trong cùng transaction; vẫn giữ từng report làm bằng chứng.
- [x] Phân biệt `NO_VIOLATION`, `CONTENT_RESTRICTED`, `CONTENT_REMOVED`; ánh xạ hai mã cũ để tương thích client cũ.
- [x] Người đăng xem quyết định/mã/lý do trong quản lý bài, nhận notice/push/email chung và biết hạn khiếu nại 30 ngày.
- [x] Cho người đăng khiếu nại một lần trên revision bị từ chối.
- [x] Khiếu nại được quyết định ẩn bài sau báo cáo; hạn nộp 30 ngày. Sửa/xóa bài đóng khiếu nại cũ.
- [x] Khiếu nại chỉ được xử lý bởi moderator khác; kết quả là `UPHELD` hoặc `REVERSED`.
- [x] Khôi phục qua quyết định có thẩm quyền, không cho provider tự chuyển `PUBLISHED`; không phục hồi bài đã xóa.
- [x] Thông báo kết quả chung cho reporter, không tiết lộ danh tính/dữ liệu người đăng.
- [x] Email/push bằng outbox; lỗi vận chuyển retry độc lập; kiểm tra lại quyền trước gửi.

## Giai đoạn 5: Tự động hỗ trợ sau khi luồng thủ công ổn định

- [x] Chuẩn hóa caption để phát hiện spam lặp, số điện thoại/link ngoài, dấu hiệu chuyển tiền và cam kết điều trị. Không tự kết luận vi phạm từ từ khóa.
- [x] Lưu SHA-256 media đã bị xác nhận vi phạm để chặn bản tải lên trùng hoàn toàn; từ chối caption không tự cấm media.
- [ ] Nếu tích hợp dịch vụ quét ảnh/video, lưu `provider`, `modelVersion`, nhãn và confidence; không lưu toàn bộ response chứa dữ liệu không cần thiết.
- [x] Rủi ro thấp vẫn `PENDING`; chưa có tự duyệt theo điểm.
- [x] Rủi ro trung bình ưu tiên hàng chờ, không tự xóa.
- [x] Bài chờ duyệt cách ly khỏi Feed; media mới authenticated, hash cấm bị chặn trước upload và kiểm tra lại trong transaction.
- [x] Quét lại theo lô, report tăng ưu tiên; từ 20 VIEW/5 phút có thể yêu cầu quét lại khi thu thập event đã bật.
- [x] `FEED_SAFETY_ENABLED=false` dừng quét lại; không mở cổng duyệt thủ công.

Chỉ mở tự động duyệt/chặn sau khi có tập quyết định thật và đo riêng precision, recall, false-positive theo từng policy code. Chatbot tư vấn của đề tài không được dùng làm bộ kiểm duyệt nếu chưa được đánh giá cho nhiệm vụ này.

## Giai đoạn 6: Bình luận và tái phạm

- [x] Báo cáo bình luận theo lý do giới hạn, mỗi tài khoản một report/bình luận.
- [x] Moderator ẩn bình luận, giữ tombstone/replies/audit và đóng report cùng transaction.
- [x] Rate limit bình luận/report; chặn nội dung bình luận giống nhau trong 60 giây.
- [x] Lịch sử quyết định gắn post/provider và người thao tác; dashboard tổng hợp.
- [x] Provider tái phạm nhận thông báo; mọi bài vẫn duyệt thủ công, chưa tự khóa theo ba strike.
- [x] Admin khóa đăng/sửa Feed độc lập với đặt lịch/đơn hàng, vẫn cho xem/khiếu nại/xóa bài.

## Kiểm thử bắt buộc

- [x] Cổng public chung chặn pending/rejected ở list/detail/following/saved/recommended.
- [x] Worker chỉ công khai sau cả hai quyết định duyệt.
- [x] Sửa bài yêu cầu kiểm duyệt revision mới và rút khỏi public.
- [x] Cache cũ không mở bài đã ẩn; mobile xử lý 403/404 và làm mới.
- [x] Duyệt đồng thời không ghi đè; revision cũ trả 409.
- [x] Provider bị chặn API moderator; không tự mở bài đã ẩn.
- [x] Public contract không lộ metadata kiểm duyệt.
- [x] Khiếu nại cần moderator khác và đúng revision; kiểm tra hạn nộp.
- [x] Migration có backfill legacy phân biệt nguồn quyết định.
- [x] Fallback DB vẫn giữ cổng kiểm duyệt khi Redis lỗi.
- [x] Test MIME/giới hạn và hash media cấm; probe thật ảnh/video riêng tư có hạn.
- [x] Test rollback quyết định, notice và audit cùng transaction.

## Triển khai

Người dùng chọn nghiệm thu cục bộ vì chưa có staging. Các checkbox dưới đây là nghiệm thu vận hành sau này, không phải công việc code chưa làm. Quy trình deploy an toàn nằm trong runbook; không vận hành trộn process cũ/mới.

- [ ] Giai đoạn A: deploy schema, backfill và API đọc trạng thái; chưa đổi cổng public.
- [ ] Giai đoạn B: bật tạo bài mới ở `PENDING`, hoàn thiện hàng chờ Admin và mobile.
- [ ] Giai đoạn C: bật cổng public bắt buộc `APPROVED` tại staging.
- [ ] Duyệt thử owner, worker, cá nhân, bài sửa, bài bị report và khiếu nại.
- [ ] Theo dõi số bài chờ, tuổi bài cũ nhất, thời gian xử lý và tỷ lệ bị đảo quyết định.
- [ ] Chỉ bật production khi không còn bài pending bị lọt public và moderator xử lý được hàng chờ.

Rollback an toàn: tắt nhận bài mới nếu hàng chờ hỏng; không đổi pending thành approved hàng loạt. Có thể tắt phần quét tự động độc lập, nhưng cổng kiểm duyệt thủ công vẫn phải giữ.

## Thứ tự thực hiện đề xuất

1. Giai đoạn 1–2 để đóng lỗ hổng đăng thẳng.
2. Giai đoạn 3 để vận hành được hàng chờ.
3. Giai đoạn 4 để quyết định minh bạch và sửa sai.
4. Giai đoạn 5–6 chỉ sau khi luồng thủ công có số liệu ổn định.

Phạm vi tối thiểu đủ dùng cho đồ án là giai đoạn 1–4. Không cần tự xây mô hình AI kiểm duyệt riêng.
