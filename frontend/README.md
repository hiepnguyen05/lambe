# Lambe Frontend

Frontend React 19, TypeScript và Vite cho ứng dụng đặt dịch vụ LAMBE và cổng
quản trị nội bộ.

## Cấu trúc mã nguồn

```text
src/
  app/                     Composition của ứng dụng khách hàng
  assets/                  Hình ảnh và tài nguyên được import
  components/
    layout/                Điều hướng và layout dùng chung
  features/
    admin/
      api/                 API và vòng đời phiên quản trị
      components/          Giao diện quản trị
      types/               Contract dữ liệu quản trị
    auth/
      api/                 API xác thực khách hàng
      components/          Các bước đăng nhập và đăng ký
      services/            Quản lý phiên phía trình duyệt
      types/               Contract dữ liệu xác thực
    home/
      components/          Trang chủ và các khối nội dung
  lib/                     Hạ tầng dùng chung như HTTP client
  styles/                  Design token toàn cục
  types/                   Type dùng chung giữa nhiều feature
```

Mã chỉ dùng trong một nghiệp vụ nên nằm trong feature tương ứng. Chỉ chuyển mã
ra thư mục dùng chung khi có từ hai feature thực sự sử dụng.

## Điều hướng

- `/`: ứng dụng dành cho khách hàng.
- `/admin`: cổng quản trị nội bộ. Server production cần fallback các URL SPA về
  `index.html`.

## Phiên đăng nhập

- Phiên khách hàng dùng `sessionStorage` theo contract access token hiện tại.
- Access token quản trị chỉ được giữ trong bộ nhớ. Việc khôi phục phiên sử dụng
  refresh cookie `HttpOnly` do backend quản lý.

## Design system

Color, typography, spacing, grid, radius và elevation token nằm tại
`src/styles/tokens.css`, được nạp bởi `src/index.css`. Dùng semantic CSS variable
thay vì thêm màu tùy ý trong component.

## Lệnh phát triển

```bash
npm run dev
npm run build
npm run lint
npm test
```
