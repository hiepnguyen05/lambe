import { AlertTriangle, CheckCircle, ChevronRight, Clock, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../../../../app/routes';
import type { OperationalAlertItem } from '../../../types/dashboard-analytics.types';

interface OperationalAlertsTableProps {
  alerts: OperationalAlertItem[];
  isLoading?: boolean;
}

export function OperationalAlertsTable({ alerts, isLoading }: OperationalAlertsTableProps) {
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900">Cảnh báo SLA & Vận hành</h2>
          <p className="mt-0.5 text-xs text-slate-500">Các sự vụ cần can thiệp xử lý ngay</p>
        </div>
        <Link
          to={ROUTES.ADMIN.ORDERS}
          className="flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800 transition-colors"
        >
          Xem tất cả đơn
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mt-4 flex-1">
        {isLoading ? (
          <div className="space-y-3 py-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle className="h-6 w-6" />
            </div>
            <p className="mt-3 text-sm font-bold text-slate-800">Vận hành bình thường</p>
            <p className="mt-1 text-xs text-slate-500">
              Không có sự cố SLA hay tranh chấp nào chưa được tiếp nhận.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {alerts.map((alert) => (
              <div key={alert.id} className="flex items-center justify-between py-3 transition-colors hover:bg-slate-50/80 rounded-xl px-2">
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                      alert.severity === 'urgent'
                        ? 'bg-rose-50 text-rose-600'
                        : 'bg-amber-50 text-amber-600'
                    }`}
                  >
                    {alert.severity === 'urgent' ? (
                      <ShieldAlert className="h-4 w-4" />
                    ) : (
                      <AlertTriangle className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">{alert.title}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          alert.severity === 'urgent'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {alert.severity === 'urgent' ? 'Khẩn cấp' : 'Chú ý'}
                      </span>
                    </div>

                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {alert.serviceName ? `Dịch vụ: ${alert.serviceName}` : 'Đơn dịch vụ'}{' '}
                      {alert.providerDisplayName ? `• Đối tác: ${alert.providerDisplayName}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-1 text-[11px] text-slate-400">
                    <Clock className="h-3 w-3" />
                    <span>{alert.timeAgo}</span>
                  </div>
                  <Link
                    to={ROUTES.ADMIN.ORDERS}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-teal-700 transition-colors shadow-2xs"
                  >
                    Xử lý
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

