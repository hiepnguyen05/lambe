import { Search, X, FilterX } from 'lucide-react';
import { useAdminCategories } from '../../../hooks/useAdminCategories';

interface ServiceFiltersProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  statusFilter: string;
  setStatusFilter: (val: string) => void;
  categoryFilter: string;
  setCategoryFilter: (val: string) => void;
  targetAudienceFilter: string;
  setTargetAudienceFilter: (val: string) => void;
  limit: number;
  setLimit: (val: number) => void;
  setPage: (val: number) => void;
}

export function ServiceFilters(props: ServiceFiltersProps) {
  const { 
    searchQuery, setSearchQuery, 
    statusFilter, setStatusFilter, 
    categoryFilter, setCategoryFilter,
    targetAudienceFilter, setTargetAudienceFilter,
    limit, setLimit, setPage 
  } = props;

  // Lấy danh sách category để filter
  const { categories } = useAdminCategories();

  const handleClearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setCategoryFilter("all");
    setTargetAudienceFilter("all");
    setPage(1);
  };

  const hasFilters = searchQuery || statusFilter !== "all" || categoryFilter !== "all" || targetAudienceFilter !== "all";

  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-card space-y-3">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Multi-attribute Search Box */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Tìm kiếm mã, tên dịch vụ..."
            className="block w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0f766e] focus:bg-white transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Selects & Actions */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Category Filter */}
          <div className="flex items-center gap-1.5">
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="py-2 px-3 border border-slate-200 bg-slate-50/70 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0f766e] cursor-pointer outline-none max-w-[150px] truncate"
            >
              <option value="all">Tất cả Danh mục</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Target Audience Filter */}
          <div className="flex items-center gap-1.5">
            <select
              value={targetAudienceFilter}
              onChange={(e) => {
                setTargetAudienceFilter(e.target.value);
                setPage(1);
              }}
              className="py-2 px-3 border border-slate-200 bg-slate-50/70 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0f766e] cursor-pointer outline-none"
            >
              <option value="all">Mọi đối tượng</option>
              <option value="MEN">Nam</option>
              <option value="WOMEN">Nữ</option>
              <option value="ALL">Cả Nam và Nữ</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="py-2 px-3 border border-slate-200 bg-slate-50/70 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0f766e] cursor-pointer outline-none"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="ACTIVE">Kích hoạt</option>
              <option value="INACTIVE">Tạm khóa</option>
              <option value="ARCHIVED">Lưu trữ</option>
            </select>
          </div>

          {/* Page Limit */}
          <select
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setPage(1);
            }}
            className="py-2 px-2.5 border border-slate-200 bg-slate-50/70 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0f766e] cursor-pointer outline-none"
          >
            <option value={10}>10 dòng/trang</option>
            <option value={20}>20 dòng/trang</option>
            <option value={50}>50 dòng/trang</option>
          </select>

          {/* Clear Filters */}
          {hasFilters && (
            <button
              onClick={handleClearFilters}
              className="p-2 text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-dashed border-slate-200 transition cursor-pointer"
              title="Xóa tất cả bộ lọc"
            >
              <FilterX className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
