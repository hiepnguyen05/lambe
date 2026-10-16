# Lambe Frontend

Frontend React 19, TypeScript và Vite cho cổng quản trị nội bộ LAMBE.
Ứng dụng khách hàng được phát triển bằng Flutter trong thư mục `mobile/`.

## Cấu trúc mã nguồn

```text
src/
  app/                     Hằng số điều hướng ứng dụng
  components/
    ui/                    Thành phần giao diện dùng chung
  features/
    admin/
      components/          Giao diện quản trị
      hooks/               API, state và vòng đời phiên quản trị
      types/               Contract dữ liệu quản trị
  lib/                     Hạ tầng dùng chung như HTTP client
```

Mã chỉ dùng trong một nghiệp vụ nên nằm trong feature tương ứng. Chỉ chuyển mã
ra thư mục dùng chung khi có từ hai feature thực sự sử dụng.

## Điều hướng

- `/admin`: cổng quản trị nội bộ. Server production cần fallback các URL SPA về
  `index.html`.

## Phiên đăng nhập

- Access token quản trị chỉ được giữ trong bộ nhớ. Việc khôi phục phiên sử dụng
  refresh cookie `HttpOnly` do backend quản lý.

## Design system

Theme dùng Tailwind CSS và các thiết lập trong `tailwind.config.js`. Các thành
phần nên ưu tiên token màu và spacing đã có thay vì thêm giá trị tùy ý.

## Lệnh phát triển

```bash
npm run dev
npm run build
npm run lint
npm test
```
