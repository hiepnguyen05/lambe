export function AdminLoginHeader() {
  return (
    <div className="flex flex-col items-center text-center mb-8">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4">
        <img
          src="/lambe-logo.svg"
          alt="Lambe Logo"
          className="w-12 h-12 object-contain"
        />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">
        Đăng nhập Quản trị
      </h1>
      <p className="text-sm text-slate-500 mt-1.5 font-normal">
        Hệ thống quản trị & vận hành Lambe
      </p>
    </div>
  );
}
