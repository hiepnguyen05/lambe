# Giá đặt dịch vụ và voucher

Mọi route có prefix `/api`. Báo giá và tạo đơn chỉ nhận `providerServiceId`,
địa chỉ, loại/thời gian đặt và tùy chọn `voucherCode`. **Không nhận giá từ client.**

## Biểu phí di chuyển

- Đến 2 km: 0 VND.
- Phần trên 2 đến 5 km: 4.000 VND/km.
- Phần trên 5 đến 10 km: 6.000 VND/km.
- Phần trên 10 km: 8.000 VND/km.
- Làm tròn khoảng cách lên 0,1 km, sau đó làm tròn phí lên 1.000 VND.

Nguồn gốc: ASAP dùng vị trí GPS còn hạn của thợ, SCHEDULED dùng tâm khu vực
phục vụ đã cấu hình. Hiện `travelDistanceKm` là khoảng cách đường chim bay
nhân hệ số bảo thủ 1,5 và làm tròn lên 0,1 km; `distanceSource` trả
`CONSERVATIVE_DISTANCE`. Đây **không phải** quãng đường đường bộ hay phí được
Google Maps xác nhận. Cần tích hợp nhà cung cấp định tuyến trước khi dùng
biểu phí này như giá đường bộ chính thức. `distanceKm` trong báo giá vẫn là
khoảng cách đường chim bay phục vụ kiểm tra bán kính thợ.

Ví dụ: `travelDistanceKm=6.3` thì phí = `3*4000 + 1.3*6000`, làm tròn
thành 20.000 VND.

## Công thức giá

`subtotalAmount = servicePriceAmount + travelFeeAmount`.
`totalAmount = subtotalAmount - discountAmount`. Mỗi đơn tối đa một voucher.
Giảm giá chỉ áp dụng cho **giá dịch vụ**, không giảm phí di chuyển. Voucher
`PROVIDER` tối đa 30% giá dịch vụ và không được làm giá sau giảm dưới giá sàn
catalog. Hoa hồng hiện 10% giá dịch vụ sau voucher của thợ; voucher
`PLATFORM` không giảm cơ sở hoa hồng và được hoàn trả vào ví thợ khi hoàn tất.
Khách thanh toán tiền mặt theo `totalAmount` snapshot của đơn.

## API khách hàng

- `GET /me/vouchers?providerServiceId=<uuid>`: voucher đang hiệu lực và có thể
  dùng với dịch vụ của thợ, kèm `estimatedDiscountAmount`. Danh sách mang tính
  tham khảo, chưa giữ lượt sử dụng.
- `POST /orders/quote`: body như tài liệu đặt lịch, thêm tùy chọn
  `"voucherCode":"LAMBE20"`. Trả `subtotalAmount`, `discountAmount`,
  `travelFeeAmount`, `travelDistanceKm`, `distanceSource`, `voucherCode`,
  `voucherIssuer`, `totalAmount`. Báo giá chưa khóa lịch hay voucher.
- `POST /orders`: body giống báo giá, thêm thông tin liên hệ/ghi chú và header
  `Idempotency-Key`. Server tính lại, khóa thợ và voucher trong giao dịch, kiểm
  tra giới hạn dùng rồi tạo đơn và giữ một lượt. Gửi lại cùng key/body trả đơn
  cũ; thay voucher mà dùng key cũ trả 409.

Voucher không hợp lệ hoặc không đúng phạm vi trả 400; hết hiệu lực, hết lượt
hoặc lịch thay đổi trả 409. Sau khi tạo, giá nằm trong đơn và không tính lại
khi thợ nhận. Nếu từ chối, hủy hoặc hết hạn, lượt giữ được trả; khi hoàn tất
chuyển thành đã sử dụng, trừ hoa hồng và hoàn voucher nền tảng trong cùng
giao dịch ví.

## API quản trị và thợ

Bearer token khách/thợ cho `me/provider`, internal-token role `ADMIN` cho
`admin`. Body tạo voucher:

```json
{
  "code": "LAMBE20",
  "discountType": "PERCENTAGE",
  "value": 20,
  "maxDiscountAmount": 30000,
  "minOrderAmount": 100000,
  "startsAt": "2026-10-19T00:00:00+07:00",
  "endsAt": "2026-11-19T00:00:00+07:00",
  "usageLimit": 100,
  "perCustomerLimit": 1,
  "serviceId": "catalog-service-uuid"
}
```

`discountType` là `FIXED_AMOUNT` (value VND) hoặc `PERCENTAGE` (value phần
trăm, bắt buộc `maxDiscountAmount`). `serviceId` có thể bỏ để áp dụng mọi
dịch vụ phù hợp. Admin có thể thêm `providerId` để giới hạn voucher nền tảng
cho một thợ. Thợ chỉ tạo voucher thuộc hồ sơ mình.

- `POST /me/provider/vouchers`, `GET /me/provider/vouchers`,
  `POST /me/provider/vouchers/:id/disable`.
- `POST /admin/vouchers`, `GET /admin/vouchers`,
  `POST /admin/vouchers/:id/disable`.

Endpoint `disable` ngăn dùng voucher cho đơn **mới**; đơn đã tạo vẫn giữ giá
snapshot. Danh sách quản lý chỉ trả voucher đúng bên phát hành, phân trang bằng
`page` và `limit` (tối đa 100), đồng thời hỗ trợ `search` theo mã, `status` và
`activeAt` (ISO 8601) để lấy voucher có hiệu lực tại một thời điểm.
