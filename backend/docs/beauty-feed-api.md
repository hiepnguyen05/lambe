# Beauty Feed — hợp đồng tích hợp mobile

Cập nhật 16/11/2026. Nguồn: controllers, DTO và application của `social-feed`.
Đây là nội dung công khai phục vụ khám phá và tham khảo, không phải hồ sơ KYC
và không tự tạo lịch đặt. Quyền tổ chức hiện có xem thêm
[Feed theo thành viên](organization-member-feed-api.md); phát triển mới P5 vẫn tạm dừng.

## Đọc dữ liệu

Backend hỗ trợ object cache Redis tùy chọn cho list công khai và chi tiết (`FEED_CACHE_ENABLED`, mặc định false). Snapshot caption/media được tách khỏi provider, dịch vụ, counts và viewer flags đọc mới từ DB. Cổng hiển thị công khai vẫn được kiểm tra trong PostgreSQL trước mỗi lần đọc cache. Request cache quá `FEED_CACHE_TIMEOUT_MS` (mặc định 100 ms) được coi là cache miss. `FEED_CACHE_INDEX_ENABLED` bật timeline page index theo generation DB, bộ lọc, cursor và limit. Following/saved/mine và quản lý chưa sử dụng cache. GET Feed công khai có limiter cục bộ giới hạn chặt hơn khi Redis không sẵn sàng. Xem [kế hoạch](feed-cache-upgrade-plan.md) và [runbook](feed-cache-runbook.md).

Admin có `GET /internal/feed/cache/status` và `POST /internal/feed/cache/rebuild`. Gợi ý thử nghiệm nằm ở `GET /me/feed/recommended`, event ở `POST /me/feed/posts/:id/engagements`; cả hai phụ thuộc `FEED_RECOMMENDATIONS_ENABLED`, mặc định false. API gợi ý trả một danh sách tối đa 20 bài cùng `nextCursor=null`, không dùng cursor của Feed theo thời gian.

| Method/path sau `/api` | Xác thực | Dữ liệu |
| --- | --- | --- |
| GET `/feed/posts` | Không | Trang bài công khai, viewer luôn false |
| GET `/me/feed/posts` | User | Cùng cổng công khai, viewer cá nhân; private, no-store |
| GET `/me/feed/following` | User | Bài công khai từ đối tác đang theo dõi |
| GET `/me/feed/saved` | User | Bài đã lưu còn công khai |
| GET `/me/feed/mine` | User | Phạm vi quản lý hiện có, gồm hidden/pending/rejected, trừ deleted |
| GET `/feed/posts/:id` | Không | Chi tiết còn công khai |
| GET `/me/feed/posts/:id` | User | Chi tiết công khai có viewer cá nhân |
| GET `/me/feed/posts/:id/manage` | User | Bài thuộc phạm vi quản lý, có phản hồi tổ chức |
| GET `/me/feed/publishing-context` | User | Membership và offering người hiện tại được phép gắn khi đăng |
| GET `/feed/posts/:id/comments` | Không | Bình luận gốc và tối đa 20 reply đầu mỗi gốc |
| GET `/feed/posts/:id/comments/:commentId/replies` | Không | Trang reply của một bình luận gốc |

List bài nhận `providerId`, `serviceId` (catalog UUID), `cursor` (post UUID),
`limit` 1–50, mặc định 20. Mine còn có filter quản lý theo DTO hiện có.
Comments/replies nhận cursor/limit; không dùng cursor bài cho bình luận.

Envelope list: `{statusCode,success:true,data:{data:[...],nextCursor:null|string},timestamp}`.
Không nhầm `response.data.data` của HTTP envelope với mảng item bên trong trang.
Bài sắp xếp createdAt DESC, id DESC; bình luận/reply ASC. Client giữ thứ tự,
dedupe ID khi nối trang; không tự xếp hạng theo lượt thích hay onboarding.
Cursor phải thuộc đúng phạm vi và còn hợp lệ, nếu không trả 400; làm mới trang
đầu thay vì tự lặp cursor lỗi. `nextCursor=null` kết thúc phân trang.

Bài public chỉ được trả khi PUBLISHED, organizationReviewStatus null/APPROVED,
provider ACTIVE và user chủ hồ sơ ACTIVE. Pending/rejected/hidden/deleted hoặc
provider không đủ điều kiện không có mặt trong public/following/saved/detail.
GET authenticated discovery chỉ thêm viewer, không mở rộng quyền xem.
Viewer được truy vấn theo lô likes/saves/follows, không N+1 theo từng bài.

## Entity và liên kết đặt lịch

Post có id, caption, status, revisionNumber, provider `{id,displayName,avatarUrl}`,
authorMember `{id,displayName,avatarUrl}` hoặc null, media, services, counts,
viewer, createdAt/updatedAt và sharePath. Author là snapshot, không tự suy luận
nhân viên đó đang có lịch rảnh hay là người nhận đơn tiếp theo.

Media: `{id,kind:IMAGE|VIDEO,url,width,height,durationSeconds,position}`.
Services: `{id:ProviderService.id,priceAmount,durationMinutes,status,
service:{id:Service.id,name,categoryId}}`; chỉ offering/catalog/category ACTIVE
được chiếu ra. Mảng có thể rỗng. Counts `{likes,comments,saves}` là số server;
comments có cả reply và tombstone, không tự trừ count khi xóa mềm bình luận.
Viewer `{liked,saved,followed}`; detail manage trả false, không dùng ghi đè
trạng thái cá nhân từ các public list/detail.

Manage có thêm `organizationReview:{status,reviewedAt,note}`. Không có nội dung
này trong public hoặc authenticated discovery. Bài có status PUBLISHED nhưng
PENDING/REJECTED vẫn chưa công khai; status local không thay được cổng backend.

CTA đọc lại hồ sơ public của provider và catalog theo slug. Ghép chính xác
offering ID + catalog ID, sau đó mở `/booking/config` với ProviderBookingEntry.
Giá là tham khảo từ offering mới đọc; bước quote kiểm tra lại lịch, khoảng
cách, phí di chuyển, voucher, ví/điều kiện nhận đơn. Không POST tạo đơn từ Feed,
không lấy giá trên bài làm tổng tiền và không gán tác giả snapshot làm thợ.

## Tương tác

PUT/DELETE `/me/feed/posts/:id/like` trả `{liked:boolean}`; save tương tự với
`/save` và `{saved:boolean}`. PUT/DELETE `/me/feed/providers/:id/follow` trả
`{following:boolean}`. Đều dùng User token; follow chính mình bị chặn backend.

POST `/me/feed/posts/:id/comments`: JSON `{text,parentId?}`; trim 1–1000 ký tự,
parentId là gốc cùng bài. Trả comment đã lưu. Không reply lồng sâu vào reply.
DELETE `/me/feed/posts/:id/comments/:commentId`: chỉ tác giả bình luận, trả
`{deleted:true}`. Xóa giữ tombstone `{text:null,deleted:true}` và các reply.
Root list có replyCount/replies; nếu count lớn hơn số reply kèm theo, lấy tiếp
với cursor ID reply cuối. Khi gốc thay đổi, bỏ response reply cũ đang chờ.

POST `/me/feed/posts/:id/reports`: `{reason,detail?}`, reason SPAM, INAPPROPRIATE,
PRIVACY, MISLEADING hoặc OTHER; detail tối đa 500. Không báo cáo bài của mình;
không gửi lặp báo cáo cho cùng bài. Thành công không đồng nghĩa bài bị ẩn ngay.

Mobile cập nhật like/save/follow ngay, khóa riêng từng thao tác; lỗi rollback
đúng trường rồi GET đối soát. Read cũ không ghi đè mutation mới. Sau timeout
chưa rõ kết quả phải đọc lại trước thao tác tiếp, không tự retry mutation mù.
Bình luận giữ draft đến ACK; POST lỗi chưa rõ cần refresh/kiểm tra, không tự gửi lại.

## Kiểm duyệt nội bộ

Bản nâng cấp kiểm duyệt nền tảng yêu cầu migration `20261120120000_feed_platform_moderation`. Mọi bài tạo/sửa bắt đầu `moderationStatus=PENDING`, không lên Feed cho đến khi nền tảng duyệt; worker vẫn cần tổ chức duyệt độc lập. Managed response thêm `moderation:{status,recommendationStatus,policyCode,note,reviewedAt}`; public response không thêm dữ liệu kiểm duyệt.

Admin/Moderator có `GET /internal/feed/review-queue?limit=20&cursor=...` (ưu tiên rủi ro/report/tương tác, rồi tuổi bài), `PATCH /internal/feed/posts/:id/review` với `{revisionNumber,decision:APPROVED|REJECTED,eligible:boolean,policyCode?,note?,blockMedia?}` và `GET /internal/feed/posts/:id/review-history`. Từ chối hoặc hạn chế gợi ý bắt buộc mã chính sách và note 5–500 ký tự. `blockMedia=true` chỉ dùng khi chính media vi phạm. Quyết định trùng/phiên bản cũ trả 409.

Người có quyền quản lý bài gửi `POST /me/feed/posts/:id/appeal` với `{revisionNumber,reason}` (5–1000 ký tự), tối đa một lần/revision trong 30 ngày từ quyết định từ chối/ẩn gần nhất. Moderator dùng `GET /internal/feed/appeals` và `PATCH /internal/feed/appeals/:id` với `{decision:UPHELD|REVERSED,note}`. Người quyết định ban đầu không được xét khiếu nại. Sửa/xóa hoặc quyết định mới đóng khiếu nại cũ; bài bị xóa/đổi revision không được khôi phục bằng khiếu nại cũ. Đảo quyết định gỡ bài có thể mở lại `HIDDEN` nhưng không thay quyết định tổ chức; bài khôi phục chưa được gợi ý.

Triển khai cần tạm dừng ghi Feed trong lúc migrate và thay toàn bộ process cũ. Process cũ chưa biết điều kiện `moderationStatus`; không vận hành lẫn process cũ/mới sau khi migration. Kiểm tra pending bị chặn ở cả list/detail/cache trước khi mở ghi lại.

Thông báo bền vững ở `GET /me/feed/notices`; đọc bằng `PATCH /me/feed/notices/:id/read`. Push `FEED_NOTICE` và email chung được đưa vào outbox cùng quyết định; sender kiểm tra lại quyền người nhận. Bản nâng cấp tiếp theo cần cả migration 20261121000000 và 20261121001000. Report chống trùng theo tài khoản/bài/revision; kết quả mới `NO_VIOLATION`, `CONTENT_RESTRICTED`, `CONTENT_REMOVED` đóng mọi report mở của revision trong cùng transaction.

`POST /me/feed/comments/:id/reports` nhận `{reason,detail?}`. Admin/Moderator có `GET /internal/feed/comment-reports` và `PATCH /internal/feed/comment-reports/:id` với `{hide,note}`; bình luận ẩn là tombstone, giữ replies. Admin có `PATCH /internal/feed/providers/:id/posting-restriction` với `{blocked,note}`; chỉ chặn đăng/sửa Feed. `GET /internal/feed/operations` trả backlog, tuổi chờ, thời gian duyệt đầu và tỷ lệ đảo quyết định.

Media mới authenticated và trả URL ký 300 giây; danh sách quản trị, chatbot và hồ sơ thợ cũng dùng URL có hạn. Snapshot Redis TTL tối đa 240 giây để không phục vụ URL đã hết hạn. URL đã cấp có thể dùng đến hết hạn; offline cache cần refresh khi hết hạn. Media legacy `deliveryType=upload` cần chuyển bằng script vận hành riêng, không tự coi kho cũ đã private. Xem [runbook](feed-moderation-runbook.md).

`GET /internal/feed/reports?limit=30&reviewed=false` trả hàng chờ; đặt
`reviewed=true` để xem lịch sử đã xử lý kèm `resolution`, `reviewedAt` và tài
khoản `reviewedBy`. Chỉ ADMIN hoặc MODERATOR được truy cập. Thao tác xử lý vẫn
dùng `PATCH /internal/feed/reports/:id`; lịch sử không cho xử lý lại.

## Đăng, sửa và xóa

POST `/me/feed/posts`, multipart ảnh: caption 1–2000 ký tự, providerServiceIds là
chuỗi JSON mảng 1–5 UUID offering hợp lệ, includesCustomer/hasCustomerConsent
là chuỗi true/false, và field files lặp lại. Có khách nhận diện được phải có consent.
Chọn 1–6 JPEG/PNG/WEBP, tối đa 5 MB/ảnh và 30 MB tổng. Video dùng riêng
POST `/me/feed/posts/video` với field `file`: đúng 1 MP4 ≤30 MB, ≤60 giây.
Cloudinary kiểm tra duration phía server. Không nhận SVG/GIF và không trộn media.
Không cần bật online/đủ ví để đăng; backend kiểm tra quyền và offering lại sau upload.
Không dùng media private/KYC để đăng Feed. Bài mới trả managed entity, HTTP 201;
không giả định luôn public. Worker pending, owner/cá nhân theo chính sách hiện có.
Mobile phải lấy publishing-context thay vì API quản lý dịch vụ của owner; khi là
worker phải gửi `memberId` trả về trong multipart.

PATCH `/me/feed/posts/:id`: JSON `{revisionNumber,caption?,providerServiceIds?}`.
Mobile GET manage trước sửa; backend transaction/revision vẫn là chốt cuối.
409 yêu cầu mở bản mới; không tự merge nội dung hoặc replay PATCH.
Không thay media/consent qua PATCH; sửa tác phẩm worker quay lại PENDING.
DELETE cùng path sau xác nhận, xóa mềm và trả `{deleted:true}`. Media được đưa vào
hàng đợi xóa CDN có retry; không có restore.

Hai POST tạo bài yêu cầu `Idempotency-Key` 8–128 ký tự chữ, số, `_` hoặc `-`.
Gửi lại cùng khóa và cùng nội dung trả bài đã tạo; dùng khóa đó với nội dung khác
trả 409. Mobile giữ khóa khi kết quả chưa rõ để người dùng gửi lại an toàn.
Multipart upload stream từ XFile, không đọc toàn bộ video thành bytes; auth refresh
401 clone FormData trước replay theo cơ chế sẵn có. Không tự retry timeout PATCH.

## Mobile và giới hạn kiểm chứng

Tab Khám phá `/explore` dùng Feed; `/services` vẫn là catalog. Các mode `/feed`
giữ cache/cursor riêng theo filter và tài khoản, giữ rows trong refresh. Cache
list không còn listener được giải phóng sau 30 giây. Logout/đổi tài khoản hủy
controller/request; chi tiết bị 403/404 bỏ body cũ. Không thêm polling nền.
Mẫu ảnh AI dùng chung FeedPostScreen, không duy trì parser/widget chi tiết thứ hai.

Ảnh decode giới hạn chiều rộng 1200px, list dựng lazy. Video không autoplay
trong Feed; màn video chỉ tạo một decoder sau nhấn phát và GET lại visibility,
dispose khi inactive/nền/rời màn. Chọn ảnh resize tối đa 1920, quality 85;
gallery trả về sau đổi phiên không được upload tiếp. Backend vẫn kiểm tra file.

Chia sẻ dùng sheet hệ điều hành với `lambe://app/feed/posts/:id` và thông báo
cần cài app; Android/iOS đăng ký scheme. Chưa có domain universal/app link hay
trang web fallback. Router mobile hiện yêu cầu đăng nhập/onboarding trước;
nếu deep link bị chuyển về đăng nhập cần mở lại link sau khi vào tài khoản.
Chưa nghiệm thu cold/warm start và share sheet trên iOS/thiết bị thật.

Kiểm thử tự động dùng fixture và media gateway giả lập, không xác nhận upload
Cloudinary hay phát MP4 thật trên thiết bị. Đo RAM/pin/size, mạng yếu, mất quyền
gallery, share, background và iOS native vẫn thuộc checklist QA/P1–P4.
Package lock hiện dùng video_player 2.14.1 và share_plus 12.0.2; giữ tương thích
secure_storage hiện có thay vì nâng auth storage chỉ để chọn share_plus mới hơn.
Xem [video_player](https://pub.dev/packages/video_player) và
[share_plus 12.0.2](https://pub.dev/packages/share_plus/versions/12.0.2).
