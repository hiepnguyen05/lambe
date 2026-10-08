import { AdminLoginHeader } from './auth/AdminLoginHeader';
import { AdminLoginForm } from './auth/AdminLoginForm';
export function AdminLoginScreen() {
  return (
    <div className="min-h-screen w-full flex flex-col justify-between items-center p-6 bg-slate-50 relative overflow-hidden">
      {/* Subtle background ambient glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(15,118,110,0.06),transparent_60%)] pointer-events-none"></div>

      {/* Top spacer */}
      <div className="w-full h-4"></div>

      {/* Centered Minimalist Card */}
      <div className="relative w-full max-w-md bg-white rounded-2xl border border-slate-200/80 shadow-xl shadow-slate-200/50 p-8 sm:p-10 transition-all z-10">
        <AdminLoginHeader />
        
        <AdminLoginForm />
      </div>

      {/* Minimal Footer */}
      <div className="w-full text-center py-4 z-10">
        <p className="text-xs text-slate-400 font-normal">
          © 2025 Lambe Home Beauty Platform. Bảo mật SSL 256-bit
        </p>
      </div>
    </div>
  );
}
