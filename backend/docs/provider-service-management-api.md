# Quản lý dịch vụ của đối tác sau khi được duyệt

API prefix: `/api`. Token đối tác là access token người dùng có hồ sơ đối tác; token nội bộ dùng riêng cho bộ phận kiểm duyệt. Tài liệu tương tác có tại `/docs` trong môi trường phát triển.

## Quy tắc

- Danh mục và dịch vụ chuẩn là dữ liệu của nền tảng. Đối tác chỉ thay đổi trạng thái cung cấp dịch vụ của mình; thay đổi giá, thời lượng, mô tả hoặc thêm dịch vụ cần gửi đề xuất.
- Giá đề xuất phải nằm trong giá sàn và giá trần của dịch vụ chuẩn ở cả lúc gửi và lúc duyệt. Khi duyệt, backend kiểm tra lại điều kiện chứng chỉ, portfolio và kinh nghiệm. Mỗi đối tác có tối đa 20 dịch vụ.
- Dịch vụ mới được duyệt cho đối tác bắt đầu ở trạng thái `INACTIVE`; đối tác tự bật sau khi hoàn tất thiết lập. Giá được duyệt thay đổi trên dịch vụ hiện có ngay; đơn đã tạo vẫn giữ giá snapshot.
- Tạm ngừng chỉ chặn đơn mới. Đơn đã nhận giữ nguyên. Không thể tạm ngừng khi còn đơn ASAP đang chờ phản hồi cho dịch vụ đó. Nếu không còn dịch vụ hợp lệ nào đang bật, phiên online của đối tác kết thúc.
- `SUSPENDED` do Admin/Moderator quyết định. Đối tác không thể tự bật dịch vụ đó; khôi phục về `INACTIVE` để đối tác tự bật. Đơn đang chờ nhận có thể bị chặn khi dịch vụ đã đình chỉ.

## API của đối tác

| Phương thức | Đường dẫn | Công dụng |
| --- | --- | --- |
| GET | `/me/provider/services` | Danh sách dịch vụ đã có, giá, trạng thái và `blockerCode` |
| GET | `/me/provider/services/:id` | Chi tiết dịch vụ của mình |
| PUT | `/me/provider/services/:id/availability` | Bật/tạm ngừng bằng body `{"active": true}` hoặc `false` |
| GET | `/me/provider/service-change-requests` | Danh sách đề xuất; lọc `status`, phân trang `page`, `limit` |
| POST | `/me/provider/service-change-requests` | Tạo bản nháp |
| GET | `/me/provider/service-change-requests/:id` | Xem chi tiết và trạng thái xét duyệt |
| PATCH | `/me/provider/service-change-requests/:id` | Sửa khi `DRAFT` hoặc `NEEDS_CHANGES` |
| POST | `/me/provider/service-change-requests/:id/submit` | Gửi để xét duyệt |
| POST | `/me/provider/service-change-requests/:id/withdraw` | Rút đề xuất chưa xử lý |
| POST | `/me/provider/service-change-requests/:id/documents/:type` | Upload ảnh chứng chỉ/portfolio qua `multipart/form-data`, trường `file` |
| GET | `/me/provider/service-change-requests/:id/documents/:documentId/access` | Nhận URL xem ảnh riêng tư ngắn hạn |
| DELETE | `/me/provider/service-change-requests/:id/documents/:documentId` | Xóa ảnh khi còn được phép sửa |

`type` khi tạo đề xuất:

| Loại | Trường bắt buộc | Ý nghĩa |
| --- | --- | --- |
| `UPDATE_OFFERING` | `providerServiceId`, `proposedPriceAmount` | Chỉnh giá/thời lượng/mô tả dịch vụ đang cung cấp |
| `ADD_EXISTING_SERVICE` | `serviceId`, `proposedPriceAmount` | Xin cung cấp dịch vụ đã có trong catalog |
| `PROPOSE_NEW_SERVICE` | `categoryId`, `name`, `proposedPriceAmount` | Đề xuất dịch vụ mới chưa có trong catalog |

Có thể thêm `proposedDurationMinutes`, `proposedDescription`. Trường `proposedDurationMinutes` và `proposedDescription` có thể để `null` khi sửa. Ảnh chứng chỉ dùng type `PROFESSIONAL_CERTIFICATE`, ảnh sản phẩm dùng `PORTFOLIO`. File ảnh tối đa 5 MB, lưu ở chế độ riêng tư; API danh sách không trả URL gốc.

Trạng thái đề xuất: `DRAFT` → `PENDING_REVIEW` → `APPROVED` hoặc `NEEDS_CHANGES`/`REJECTED`. Sau `NEEDS_CHANGES`, đối tác sửa và gửi lại. Có thể `WITHDRAWN` trước khi được xử lý. Mỗi dịch vụ/đề xuất cùng tên chỉ được có một yêu cầu đang mở tại một thời điểm.

## API nội bộ

| Phương thức | Đường dẫn | Quyền |
| --- | --- | --- |
| GET | `/admin/provider-service-change-requests` | Admin, Moderator, Service Reviewer |
| GET | `/admin/provider-service-change-requests/:id` | Admin, Moderator, Service Reviewer |
| GET | `/admin/provider-service-change-requests/:id/documents/:documentId/access` | Admin, Moderator, Service Reviewer |
| POST | `/admin/provider-service-change-requests/:id/approve` | Admin, Moderator, Service Reviewer; đề xuất dịch vụ chuẩn mới chỉ Admin |
| POST | `/admin/provider-service-change-requests/:id/request-changes` | Như trên; body `{"reason":"..."}` |
| POST | `/admin/provider-service-change-requests/:id/reject` | Như trên; body `{"reason":"..."}` |
| POST | `/admin/providers/:id/services/:serviceId/suspend` | Admin, Moderator; body `{"reason":"..."}` |
| POST | `/admin/providers/:id/services/:serviceId/restore` | Admin, Moderator |

Với `PROPOSE_NEW_SERVICE`, body duyệt phải chọn **một** trong hai cách: `{"mapToServiceId":"uuid"}` để ghép dịch vụ chuẩn đã có, hoặc `{"createService":{...}}` theo DTO tạo dịch vụ chuẩn (`categoryId`, `code`, `name`, `slug`, `minPriceAmount`, `maxPriceAmount`, ...). Nếu tạo mới, dịch vụ chuẩn và dịch vụ của đối tác được tạo trong cùng giao dịch. Thông tin xét duyệt và người thực hiện được ghi audit; thông báo kết quả được đưa vào mail outbox.

`blockerCode` trong danh sách dịch vụ có thể là `SUSPENDED`, `SERVICE_INACTIVE`, `CATEGORY_INACTIVE`, `PRICE_OUT_OF_RANGE` hoặc `null`. Ứng dụng nên dùng trường này để giải thích vì sao dịch vụ chưa thể nhận đơn.

## Tích hợp mobile M4 — 02/11/2026

Mobile đã có danh sách/chi tiết dịch vụ và đề xuất, tạo đủ ba loại, sửa/gửi
lại NEEDS_CHANGES, rút, upload/xóa/xem tài liệu riêng tư. Điểm vào là mục Dịch
vụ của tôi trong hồ sơ, route `/provider/services`; không mở API admin/member
để thực hiện thay cho chủ đối tác.

Offering trả `id`, `serviceId`, `priceAmount`, `durationMinutes`, `description`,
`status`, `suspensionReason`, `blockerCode` và relation service gồm id/name/status,
iconUrl, minPriceAmount/maxPriceAmount/defaultDurationMinutes, category. Giá ở
đây là giá của đối tác. Thời lượng null dùng defaultDurationMinutes; currency
theo nghiệp vụ VND. Blocker null không đồng nghĩa profile/setup/online đều hợp lệ.

Request trả proposedPriceAmount/proposedDurationMinutes/proposedDescription,
proposedName, type/status, service/category, documents, reviewNote và các mốc
thời gian. `documents` chỉ chọn id/type/status/createdAt, không publicId/URL.
Access ảnh có Cache-Control no-store; mỗi lần xem cần xin URL lại, không gửi
Bearer Lambe khi tải URL Cloudinary. Upload chỉ chứng chỉ/portfolio và tối đa
10 tài liệu; private delivery vẫn được kiểm tra lại ở backend.

Tạm ngừng bị chặn khi có ASAP PENDING_PROVIDER còn hạn; đơn đã ACCEPTED không
bị hủy hay đổi snapshot. Tắt dịch vụ hợp lệ cuối cùng kết thúc phiên online;
bật dịch vụ lại không tự tạo phiên online. 400/403/404/409 cần hiển thị đúng,
không override bằng optimistic status. Timeout đối soát bằng GET.

POST tạo nháp và các action thay đổi/ảnh không có idempotency key công khai;
mobile không tự replay khi timeout. Có partial unique index cho cùng đích ở
DRAFT/PENDING_REVIEW/NEEDS_CHANGES. Recovery tạo nháp tìm theo đích trong ba
nhóm này; kết quả tìm thấy phải được người dùng kiểm tra trước submit.

Nghiệm thu PostgreSQL riêng đã kiểm tra hai flow HTTP: quyền sở hữu, price
band, cạnh tranh tạo draft, ảnh private/no-store, khóa sửa/upload sau submit,
bổ sung/gửi lại/rút và không đổi offering/đơn trước duyệt. NEEDS_CHANGES trong
test là fixture nội bộ, không phải một API tự đổi trạng thái của đối tác.
Media và email được giả lập trong test; chưa kiểm chứng Cloudinary/email thật
trên thiết bị. Không có migration/biến môi trường mới cho batch mobile.
