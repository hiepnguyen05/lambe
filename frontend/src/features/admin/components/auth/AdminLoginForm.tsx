import { Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAdminLogin } from '../../hooks/useAdminLogin';

export function AdminLoginForm() {
  const {
    username, setUsername,
    password, setPassword,
    showPassword, setShowPassword,
    rememberMe, setRememberMe,
    isLoading, handleSubmit
  } = useAdminLogin();

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Email / Username field */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
          Email / Tên đăng nhập
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Mail className="w-4 h-4" />
          </div>
          <input
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Tên đăng nhập (vd: admin)"
            className="block w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0f766e]/30 focus:border-[#0f766e] transition shadow-xs"
          />
        </div>
      </div>

      {/* Password field */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Mật khẩu
          </label>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              alert("Vui lòng liên hệ quản trị viên để khôi phục mật khẩu.");
            }}
            className="text-xs font-medium text-[#0f766e] hover:underline transition"
          >
            Quên mật khẩu?
          </a>
        </div>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Lock className="w-4 h-4" />
          </div>
          <input
            type={showPassword ? "text" : "password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nhập mật khẩu..."
            className="block w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0f766e]/30 focus:border-[#0f766e] transition shadow-xs"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition cursor-pointer"
            title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Remember Me */}
      <div className="flex items-center justify-between pt-0.5">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-[#0f766e] focus:ring-[#0f766e] focus:ring-offset-0 transition cursor-pointer"
          />
          <span className="text-xs text-slate-600">Ghi nhớ đăng nhập</span>
        </label>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-3 px-4 rounded-xl font-medium text-sm text-white bg-[#0f766e] hover:bg-[#0d635c] active:bg-[#0b534d] shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-70 cursor-pointer"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Đang đăng nhập...</span>
          </>
        ) : (
          <span>Đăng nhập</span>
        )}
      </button>
    </form>
  );
}
