import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Ban,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileCheck2,
  FileClock,
  FileText,
  ListFilter,
  RefreshCw,
  RotateCcw,
  Search,
  User,
} from "lucide-react";
import type { ProviderApplicationStatus } from "../../hooks/useProviderApplications";
import { useProviderApplications } from "../../hooks/useProviderApplications";
import {
  ApplicationStatusBadge,
  InlineError,
} from "./components/ProviderApplicationUi";
import { formatDate } from "./components/providerApplicationFormatters";

const statusTabs: Array<{
  value: ProviderApplicationStatus | "all";
  label: string;
  icon: typeof ListFilter;
}> = [
  { value: "all", label: "Tất cả", icon: ListFilter },
  { value: "PENDING_REVIEW", label: "Chờ duyệt", icon: Clock3 },
  { value: "NEEDS_CHANGES", label: "Cần bổ sung", icon: RotateCcw },
  { value: "APPROVED", label: "Đã duyệt", icon: CheckCircle2 },
  { value: "REJECTED", label: "Đã từ chối", icon: Ban },
  { value: "WITHDRAWN", label: "Đã rút", icon: Ban },
  { value: "DRAFT", label: "Bản nháp", icon: FileClock },
];

export function AdminProviderApplicationList() {
  const navigate = useNavigate();
  const {
    applications,
    totalCount,
    totalPages,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    pagination,
    setPagination,
    isLoading,
    error,
    refetch,
  } = useProviderApplications();
  const [searchInput, setSearchInput] = useState(searchQuery);

  const applySearch = () => {
    setPagination((current) => ({ ...current, page: 1 }));
    setSearchQuery(searchInput.trim());
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2.5">
            <FileCheck2 className="h-6 w-6 text-teal-700" />
            <h1 className="text-2xl font-bold text-slate-950">
              Duyệt hồ sơ đối tác
            </h1>
          </div>
          <p className="mt-1.5 text-sm text-slate-500">
            Kiểm tra thông tin, tài liệu KYC, dịch vụ và quyết định đăng ký.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-600">
            {totalCount.toLocaleString("vi-VN")} hồ sơ
          </span>
          <button
            type="button"
            title="Làm mới danh sách"
            onClick={() => void refetch()}
            disabled={isLoading}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </header>

      {error && <InlineError message={error} />}

      <section className="rounded-lg border border-slate-200 bg-white">
        <nav
          aria-label="Lọc hồ sơ theo trạng thái"
          className="overflow-x-auto border-b border-slate-200"
        >
          <div className="flex min-w-max px-2 sm:px-4">
            {statusTabs.map((tab) => {
              const active = statusFilter === tab.value;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.value}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => {
                    setStatusFilter(tab.value);
                    setPagination((current) => ({ ...current, page: 1 }));
                  }}
                  className={`relative inline-flex h-12 items-center gap-2 whitespace-nowrap px-3 text-sm font-semibold transition-colors sm:px-4 ${
                    active
                      ? "text-teal-800"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                  {active && (
                    <span className="absolute inset-x-3 bottom-0 h-0.5 bg-teal-700 sm:inset-x-4" />
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1">
            <div className="relative min-w-0 flex-1 lg:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") applySearch();
                }}
                placeholder="Tên đối tác, tổ chức hoặc số điện thoại"
                className="h-10 w-full rounded-l-md border-slate-300 bg-slate-50 pl-9 pr-3 text-sm focus:border-teal-700 focus:bg-white focus:ring-teal-700"
              />
            </div>
            <button
              type="button"
              onClick={applySearch}
              className="h-10 rounded-r-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800"
            >
              Tìm kiếm
            </button>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <select
              aria-label="Lọc theo loại đối tác"
              value={typeFilter}
              onChange={(event) => {
                setTypeFilter(event.target.value);
                setPagination((current) => ({ ...current, page: 1 }));
              }}
              className="h-10 rounded-md border-slate-300 bg-white py-0 text-sm focus:border-teal-700 focus:ring-teal-700"
            >
              <option value="all">Mọi loại hình</option>
              <option value="INDIVIDUAL">Cá nhân</option>
              <option value="ORGANIZATION">Tổ chức</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <ColumnHeader>Người đăng ký</ColumnHeader>
                <ColumnHeader>Loại hình</ColumnHeader>
                <ColumnHeader>Hồ sơ đính kèm</ColumnHeader>
                <ColumnHeader>Ngày nộp</ColumnHeader>
                <ColumnHeader>Trạng thái</ColumnHeader>
                <th className="w-16 px-4 py-3" aria-label="Thao tác" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="h-48 text-center">
                    <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin text-teal-700" />
                    <span className="text-sm text-slate-500">
                      Đang tải hàng chờ...
                    </span>
                  </td>
                </tr>
              ) : applications.length === 0 ? (
                <tr>
                  <td colSpan={6} className="h-56 text-center">
                    <FileText className="mx-auto mb-3 h-8 w-8 text-slate-300" />
                    <p className="font-semibold text-slate-700">
                      Không có hồ sơ phù hợp
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Thử thay đổi từ khóa hoặc bộ lọc.
                    </p>
                  </td>
                </tr>
              ) : (
                applications.map((application) => {
                  const displayName =
                    application.providerType === "ORGANIZATION"
                      ? application.organizationName ||
                        application.legalFullName
                      : application.legalFullName;
                  return (
                    <tr
                      key={application.id}
                      onClick={() =>
                        navigate(
                          `/admin/provider-applications/${application.id}`,
                        )
                      }
                      className="cursor-pointer hover:bg-slate-50"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-50 text-sm font-bold text-teal-800">
                            {(displayName || "?").charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="max-w-xs truncate text-sm font-semibold text-slate-900">
                              {displayName || "Chưa cập nhật tên"}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {application.user.phone ||
                                "Chưa có số điện thoại"}{" "}
                              · Lần sửa #{application.revisionNumber}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-sm text-slate-700">
                        <span className="inline-flex items-center gap-1.5">
                          {application.providerType === "INDIVIDUAL" ? (
                            <User className="h-4 w-4 text-slate-400" />
                          ) : (
                            <Building2 className="h-4 w-4 text-slate-400" />
                          )}
                          {application.providerType === "INDIVIDUAL"
                            ? "Cá nhân"
                            : "Tổ chức"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-sm text-slate-600">
                        {application._count.documents} tài liệu ·{" "}
                        {application._count.services +
                          application._count.serviceSuggestions}{" "}
                        dịch vụ
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-sm text-slate-600">
                        {formatDate(application.submittedAt, true)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <ApplicationStatusBadge status={application.status} />
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          type="button"
                          title="Mở hồ sơ"
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(
                              `/admin/provider-applications/${application.id}`,
                            );
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-teal-50 hover:text-teal-800"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!isLoading && totalCount > 0 && (
          <footer className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row">
            <p className="text-sm text-slate-600">
              Hiển thị{" "}
              <strong>{(pagination.page - 1) * pagination.limit + 1}</strong>–
              <strong>
                {Math.min(pagination.page * pagination.limit, totalCount)}
              </strong>{" "}
              trong {totalCount.toLocaleString("vi-VN")} hồ sơ
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                title="Trang trước"
                disabled={pagination.page <= 1}
                onClick={() =>
                  setPagination((current) => ({
                    ...current,
                    page: current.page - 1,
                  }))
                }
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-24 text-center text-sm font-semibold text-slate-700">
                Trang {pagination.page}/{Math.max(totalPages, 1)}
              </span>
              <button
                type="button"
                title="Trang sau"
                disabled={pagination.page >= totalPages}
                onClick={() =>
                  setPagination((current) => ({
                    ...current,
                    page: current.page + 1,
                  }))
                }
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </footer>
        )}
      </section>
    </div>
  );
}

function ColumnHeader({ children }: { children: React.ReactNode }) {
  return (
    <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">
      {children}
    </th>
  );
}
