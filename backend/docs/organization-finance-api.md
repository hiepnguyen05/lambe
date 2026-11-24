# Tài chính tổ chức và tiền thu hộ — P5D

Cập nhật 29/10/2026. Base `/api`, Bearer **User Access Token** Lambe. Không
dùng Internal Token để gọi thay owner/worker. Có 5 API GET mới; MoMo/SePay giữ
sandbox, không mở rút tiền hoặc chuyển tiền/lương cho nhân viên.

## 1. Nguồn tiền và cách hiểu báo cáo

- Mỗi organization có một ProviderWallet. Giá, voucher, tiền giữ và hoa hồng
  thuộc organization; không tạo ví/giá/nạp tiền riêng cho worker.
- Báo cáo kỳ chỉ lấy đơn **COMPLETED** theo `completedAt >= from AND < to`.
  Không dùng createdAt, ngày đặt lịch hoặc ngày hiện tại của điện thoại để
  thay. Không tính chờ nhận, đang làm, hủy, hết hạn hoặc đang tranh chấp vào
  doanh thu đơn hoàn tất. Đơn được support xác nhận đã trả xuất hiện ở kỳ
  completedAt lúc support kết thúc tranh chấp, không hồi tố tự ý về ngày đặt.
- Hoa hồng/bù voucher lấy ledger COMMISSION/VOUCHER_REIMBURSEMENT của đúng ví
  và các đơn trong kỳ hoàn tất. Không cộng TOP_UP/HOLD/RELEASE như doanh thu.
  Ledger có thể ghi ngày khác: đây là báo cáo **cohort đơn hoàn tất**, không
  phải sao kê ví theo thời điểm giao dịch. Sao kê ví vẫn là API wallet cũ.
- Giá đơn cuối đã bao gồm add-on ACCEPTED. `servicePriceAmount` là giá gốc;
  `serviceTotalAmount = totalAmount + discountAmount - travelFeeAmount`;
  `addOnPriceAmount = serviceTotalAmount - servicePriceAmount`. Dùng snapshot
  cuối đơn, không lấy giá dịch vụ hiện hành hoặc cộng mọi đề xuất add-on.
- `customerPayableAmount` là tổng khách phải trả; **không đồng nghĩa đã thu**.
  `cashRecordedAmount` chỉ cộng cashCollectedAmount có bản ghi rõ ràng.
  `cashUnverifiedOrderCount/cashUnverifiedPayableAmount` chỉ ra phần chưa có
  bản ghi xác định người/thời điểm thu, kể cả support đã xác nhận thanh toán.
- `platformFundedAmount/providerFundedAmount` là phần giảm giá trong đơn;
  `platformReimbursedAmount` là bù từ nền tảng đã thực ghi vào ví. Không cộng
  phần platformFunded thêm lần nữa khi đã dùng reimbursement.
- `netOrderProceedsAmount = customerPayableAmount + platformReimbursedAmount
  - commissionChargedAmount`. Đây là chỉ tiêu tiền theo đơn, có thể bao gồm
  tiền chưa ghi nhận thu; **không phải số dư ví, tiền đã bàn giao hay lương**.
- `commissionDifferenceAmount = expectedCommissionAmount - commissionChargedAmount`:
  khác 0 cần đối soát, không tự trừ/bù tiền từ API GET.

Tất cả số tiền VND là integer; SUM PostgreSQL được kiểm tra phạm vi số nguyên
JSON an toàn, không làm tròn mất tiền khi vượt giới hạn. Nếu có tiền tệ khác
VND trong cohort báo 409 thay vì cộng lẫn. Đơn miễn phí có receipt amount=0
vẫn là RECORDED, không dùng kiểm tra truthy để coi là chưa thu.

## 2. Endpoint và quyền

| Method | Path | Quyền |
| --- | --- | --- |
| GET | `/me/provider/finance/summary` | Owner hợp lệ của organization mình |
| GET | `/me/provider/finance/members` | Owner xem nhóm member/version và legacy |
| GET | `/me/provider/finance/orders` | Owner xem tài chính đơn hoàn tất |
| GET | `/me/provider/memberships/:id/collections/summary` | Chỉ user của membership đó |
| GET | `/me/provider/memberships/:id/collections/orders` | Chỉ lịch sử thu hộ của bản thân |

Owner phải có membership OWNER ACTIVE, provider.userId đúng mình và tài khoản
ACTIVE. Tạm dừng/đình chỉ organization không làm mất quyền đọc lịch sử tài
chính của owner hợp lệ; nó không mở quyền nhận đơn mới. Worker thường không
gọi được API owner, ví/nạp/rút/đổi giá của tổ chức. Worker LEFT/SUSPENDED vẫn
được đọc lịch sử của chính mình qua snapshot assignedMemberUserId; không
được cập nhật đơn hoặc xem đồng nghiệp. Owner không dùng API self-collections
thay worker; dùng finance/orders với memberId.

Không trả địa chỉ/điện thoại/ID khách, CCCD, ảnh riêng, signed URL, user ID của
người thu hoặc toàn bộ ledger/số dư cho worker. MembershipVersion phân tách
lần gia nhập; không gộp nhầm ca cũ vào version mới. Tên/ảnh lấy snapshot đơn.
Legacy chưa phân công có nhóm LEGACY, không tự coi owner là assigned worker.

## 3. Query chung

`from` và `to` bắt buộc, ISO 8601 có `Z` hoặc offset; from < to, tối đa 93 ngày.
Ví dụ muốn cả tháng 10 Việt Nam:

```text
?from=2026-10-01T00:00:00%2B07:00&to=2026-11-01T00:00:00%2B07:00
```

Dùng URLSearchParams/Dio queryParameters để encode `+`, không nối query thô
khiến +07:00 biến thành khoảng trắng. Không gửi ngày YYYY-MM-DD đơn lẻ.

Summary/orders của owner nhận thêm `memberId` UUID4 tùy chọn, phải thuộc đúng
tổ chức, gồm member đã rời. Member summary chỉ nhận from/to, không nhận
memberId/providerId giả trong query. Orders nhận `limit` 1–50, mặc định 20,
`cursor` là UUID nextCursor trang trước. Cursor phải thuộc cùng phạm vi/kỳ;
đổi bộ lọc thì bỏ cursor. Thứ tự completedAt DESC, id DESC.

Members nhận limit 1–50 và cursor `memberId:membershipVersion` hoặc `LEGACY`
từ data.nextCursor; thứ tự nhóm theo server. Chỉ trả nhóm có đơn hoàn tất,
không phải danh sách nhân sự đầy đủ hoặc tổng số người đủ điều kiện làm việc.

## 4. Owner summary

Response data:

| Field | Ý nghĩa |
| --- | --- |
| completedOrderCount | Số đơn hoàn tất trong cohort |
| servicePriceAmount | Tổng giá dịch vụ gốc |
| serviceTotalAmount / addOnPriceAmount | Dịch vụ gồm phần phát sinh / riêng phần phát sinh |
| travelFeeAmount | Phí di chuyển theo snapshot cuối đơn |
| discountAmount | Tổng giảm cho khách |
| platformFundedAmount / providerFundedAmount | Phân chia nguồn giảm giá |
| customerPayableAmount | Tổng khách phải thanh toán |
| cashRecordedAmount / cashRecordedOrderCount | Số tiền/số đơn có bản ghi người thu rõ ràng |
| cashUnverifiedOrderCount / cashUnverifiedPayableAmount | Đơn/số phải trả chưa có bản ghi thu rõ |
| expectedCommissionAmount | Hoa hồng snapshot cuối đơn |
| commissionChargedAmount | Hoa hồng ledger thực ghi |
| commissionDifferenceAmount | Chênh giữa dự kiến và thực ghi |
| platformReimbursedAmount | Bù voucher nền tảng đã thực ghi |
| netOrderProceedsAmount | Khách phải trả + bù thực ghi − hoa hồng thực ghi |
| organizationWalletNow | Số dư/giữ/khả dụng của **toàn tổ chức hiện tại** |
| outstandingNow | Tiền giữ và tranh chấp chưa kết thúc trong phạm vi hiện tại |

WalletNow gồm balanceAmount,heldAmount,availableAmount,currencyCode, không
chịu bộ lọc kỳ hoặc member. OutstandingNow gồm activeHoldCount,
activeCommissionHoldAmount,paymentDisputeCount,disputedCustomerPayableAmount;
chịu bộ lọc member nếu có, **không chịu from/to**, vì nghĩa vụ còn mở có thể
bắt đầu từ kỳ trước. Không cộng các mục này vào netOrderProceedsAmount.

Ví dụ một đơn: dịch vụ 150.000 + di chuyển 10.000, voucher nền tảng 30.000,
khách trả 130.000, commission 15.000, ví nhận bù 30.000. Proceeds đơn là
145.000; cashRecorded nếu worker xác nhận thu là 130.000; không phải 175.000.

Meta chung: providerId, memberId hoặc null, from/to đã chuẩn UTC,
toExclusive=true, timezone=Asia/Ho_Chi_Minh, currencyCode=VND,
basis=COMPLETED_AT, asOf, payrollIncluded=false. Tổng/chi tiết đọc cùng
RepeatableRead snapshot trong mỗi request; các request riêng có thể khác
nếu đơn mới hoàn tất giữa hai lần tải.

## 5. Nhóm nhân viên và chi tiết đơn

`/finance/members` data `{items,nextCursor}`. Mỗi item có groupKey,
memberId/membershipVersion, displayName/avatarUrl (snapshot mới nhất trong
nhóm của kỳ), attribution ASSIGNED_MEMBER hoặc LEGACY_UNASSIGNED và các tổng
tiền như cohort. Không có organizationWalletNow lặp cho mỗi dòng.

`/finance/orders` data `{items,nextCursor}`. Item có orderId, serviceName,
completedAt,currencyCode,assignedMember hoặc null,customerPayableAmount,
cashCollection cùng giá gốc/phát sinh/di chuyển/giảm giá, nguồn funding,
expectedCommissionAmount, commissionChargedAmount, platformReimbursedAmount,
netOrderProceedsAmount. assignedMember gồm id,membershipVersion,displayName,
avatarUrl theo snapshot. Không tải chi tiết đơn chứa PII để dựng báo cáo tiền.

`cashCollection` có status RECORDED/UNVERIFIED, amount, collectedAt và
collectorMemberId. Chỉ nhận memberId khi có receipt và người thu trùng serving
user snapshot; legacy/unknown có thể null. UNVERIFIED không có nghĩa khách
chưa trả: nó nghĩa chưa có bản ghi thu có thể gán chính xác.

## 6. Worker thu hộ

Self summary chỉ có completedOrderCount,customerPayableAmount,
cashRecordedAmount,cashRecordedOrderCount,cashUnverifiedOrderCount,
cashUnverifiedPayableAmount,collectionPurpose=ON_BEHALF_OF_ORGANIZATION.
Không có hoa hồng, reimbursement, proceeds của tổ chức hoặc ví.

Self orders chỉ có orderId,serviceName,completedAt,currencyCode,assignedMember,
customerPayableAmount,cashCollection và nextCursor. UI gọi màn **Tiền thu hộ**,
không “Thu nhập”, không nút rút/nạp hoặc số dư cá nhân. Không suy luận amount
này là nhân viên còn nợ tổ chức: Lambe chưa ghi nhận bàn giao/chi tiêu nội bộ.

## 7. Completion và tranh chấp

POST `/me/provider/orders/:id/complete` vẫn dùng `{cashReceived:true}`.
Thợ chỉ xác nhận khi nhận đủ tiền. Cùng transaction capture commission,
reimburse voucher, đổi trạng thái và ghi cashCollectedByUserId,
cashCollectedAt,cashCollectedAmount=totalAmount. PostgreSQL chặn sửa receipt
đã ghi, số tiền lệch tổng đơn và collector khác người thực hiện.
assignedMemberId/version đã bất biến từ P5C; không cần cột memberId thứ hai
để mô tả cùng một người thu. Presenter đơn bổ sung cashCollectedAmount nullable.

Không đủ tiền → payment dispute hiện có; không complete. CONFIRM_UNPAID giữ
HOLD chờ thu hồi/hỗ trợ, không đưa đơn vào doanh thu hoàn tất. CONFIRM_PAID
capture một lần và hoàn tất nhưng **không tự xác nhận ai đã cầm tiền mặt**;
cash receipt vẫn null, báo UNVERIFIED. Không dùng người support làm collector.
Hủy hợp lệ giải phóng hold; báo cáo GET không làm thay đổi ví/giao dịch/đơn.

## 8. Hiệu năng và vận hành

Chỉ dùng SQL tham số hóa qua Prisma.sql, không ghép query input thành SQL thô.
Giới hạn 93 ngày, 50 dòng/trang, rate limit 2/s và 30/phút, statement timeout
5 giây, transaction timeout 10 giây. Không Redis/Cloudinary/network bên trong
read transaction; không cache báo cáo để suy ra quyền hoặc số dư.

Danh sách giới hạn trang trong CTE trước khi tổng hợp ledger nên không cộng
toàn bộ sao kê mỗi lần mở 20 dòng. Tổng/nhóm tổng hợp theo tập SQL, không gọi
N API/query theo từng member. Có index providerId/completedAt/id và
assignedMemberId/completedAt/id; kiểm tra EXPLAIN mẫu dùng index provider
backward scan. Kết quả trên fixture nhỏ không thay load test p95/p99 production.

Migration `20261029090000_member_finance`: thêm cashCollectedAmount nullable,
backfill chỉ receipt COMPLETED đã có người/thời điểm rõ, không tự xác nhận
thu cho đơn legacy/support thiếu dữ kiện. Không sửa số dư hay tạo giao dịch.
Rehearsal schema tạm kiểm tra cả dữ liệu cũ, unknown và trigger bất biến.
Rollback image phải theo runbook P5C, giữ schema; image cũ không ghi amount
mới nên không coi receipt trống sau rollback là thu đã xác nhận.

Kiểm thử batch: 18 HTTP/PostgreSQL qua AppModule, gồm BOLA/role-negative,
range/cursor, khoản thu 0, voucher, add-on, ledger, lịch sử LEFT/SUSPENDED,
complete đồng thời, hủy và support paid/unpaid. Có kiểm thử số nguyên an toàn;
741/741 unit toàn backend đạt, cùng typecheck/typecheck:test/lint; hồi quy
đặt lịch cá nhân 34/34, tổ chức 20/20, membership/KYC/năng lực 75/75 và đăng ký
đối tác 8/8 đạt. Tài chính 18/18 và ba bộ cá nhân/member/đăng ký đã đối chiếu
trên Node 22 Linux Docker; lần runner Windows booking dừng sớm không được
dùng làm bằng chứng đạt. Không có thay đổi dependency.

Docker local đã build và áp migration, backend healthy, health/Swagger 200.
Swagger có **303 HTTP operation** với đủ 5 report route; thiếu JWT trả 401.
Đối soát giữ nguyên 8 user, 1 provider, 1 wallet, 1 member, 19 order; tổng
balance 165.000đ và held 5.000đ không đổi sau migration. Không seed dữ liệu
test vào lambe_db; kiểm thử dùng lambe_booking_test_* và Redis DB 15.

## 9. Ngoài phạm vi

Chưa có payroll, lương, thưởng, phát lương, thu hồi tiền mặt, xác nhận bàn giao
hoặc payout worker. Không gọi netOrderProceeds là lương hay tiền cần chuyển.
Không tự đưa MoMo/SePay lên production. Báo cáo đây là dữ liệu vận hành theo
đơn, không thay chứng từ kế toán/thuế. Chat/review/feed/handoff thuộc P5E.
