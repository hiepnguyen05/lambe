# Nghiệm thu kiểm duyệt Feed cục bộ — 20/11/2026

Phạm vi được người dùng chốt: hoàn tất mã nguồn và kiểm thử cục bộ, chưa có staging. Không triển khai server đang chạy và không sửa database nghiệp vụ.

## Bằng chứng đã chạy

| Phạm vi | Kết quả |
|---|---|
| Unit Feed, push, mail, Cloudinary, chatbot và hồ sơ thợ | 84 test thuộc 16 suite |
| PostgreSQL/Redis thật | 14 test; gồm gate cache, race hai moderator, khiếu nại độc lập, gộp report, tombstone và rollback notice/audit |
| API AppModule đầy đủ, cache bật | 28 test; gồm owner/worker, revision, phân quyền, report bình luận, notice giữa hai tài khoản, khóa đăng Feed và hạn khiếu nại |
| Kiểm tra bổ sung sau thay đổi cuối | Hai test API tập trung xác nhận đóng khiếu nại pending khi sửa bài và số liệu vận hành; không cộng hai test này vào tổng 28 |
| Flutter Feed | 67 test, có test thông báo mới; analyze không có lỗi |
| Frontend | Build và 11 test hiện có đạt; quy tắc code phần Feed đạt |
| Backend | Build, typecheck nguồn/test và lint các tệp trong phạm vi đạt |
| Migration sạch | Toàn bộ 68 migration chạy từ DB rỗng |
| Migration nâng cấp | Chạy trên DB thử có dữ liệu từ các đợt trước |
| Cloudinary ảnh thật | PNG giả: URL không ký bị chặn, URL ký hoạt động, URL hết hạn bị chặn; asset thử đã xóa |
| Cloudinary video thật | MP4 đen giả 1 giây: ba kiểm tra trên đạt; asset thử đã xóa |
| Công cụ legacy media | Chế độ dry-run trên DB thử, không đổi Cloudinary; đếm 56 fixture tại thời điểm chạy, không phải số liệu production |

DB thử: `lambe_booking_test_feed_cache_verify_20261120` và `lambe_booking_test_moderation_clean_20261120`. Redis DB 15; namespace test tách riêng, không flush Redis. Dữ liệu tổng hợp được giữ lại để kiểm tra, không có media khách hàng trong probe Cloudinary. Firebase gửi thật tắt trong API test; mail được giả lập.

## Giới hạn nghiệm thu

- Chưa kiểm tra email đến hộp thư hoặc FCM đến máy thật. Đã kiểm thử outbox, retry và từ chối người nhận không còn quyền.
- Media mới dùng authenticated; URL đã cấp có hạn 300 giây. Không thể thu hồi file đã tải. Media legacy phải chuyển khi triển khai; script mặc định dry-run và cần xác nhận tên DB/dừng ghi để chạy thật.
- Chưa tích hợp nhà cung cấp AI quét ảnh/video, chưa tự duyệt theo confidence hoặc huấn luyện ML. `rules-v1` chỉ hỗ trợ sắp hàng chờ và tín hiệu caption; mọi bài vẫn duyệt thủ công.
- Chưa nghiệm thu staging, canary hoặc production; không đánh dấu các bước đó hoàn tất.
- Frontend build có cảnh báo chunk dashboard lớn trong worktree hiện tại; build vẫn thành công. Không dùng bộ kiểm thử này để tuyên bố toàn bộ repository đã được kiểm định.

Hướng dẫn và chính sách: [runbook](../feed-moderation-runbook.md), [chính sách nội dung](../feed-content-policy.md), [checklist](../feed-moderation-upgrade-plan.md).
