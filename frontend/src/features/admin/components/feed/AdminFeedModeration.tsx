import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { apiRequest } from '../../../../lib/api-client';
import { useDialog } from '../../../../components/ui/dialog-context';
import { FeedCachePanel } from './FeedCachePanel';
import { FeedReviewQueue } from './FeedReviewQueue';
import { FeedModerationOperations } from './FeedModerationOperations';
import { FeedStatsCards } from './components/FeedStatsCards';
import { FeedPostsTable } from './components/FeedPostsTable';
import { FeedReportsTable } from './components/FeedReportsTable';
import { FeedPostDetailModal } from './components/FeedPostDetailModal';
import type {
  AdminFeedPostItem,
  AdminFeedPostsResponse,
  AdminFeedReportItem,
  FeedStats,
} from './types';

export function AdminFeedModeration() {
  const [activeTab, setActiveTab] = useState<'posts' | 'reports' | 'cache'>('posts');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PUBLISHED' | 'HIDDEN'>('ALL');
  const [hasReportsFilter, setHasReportsFilter] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Bulk selection state
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);

  // Reports tab state
  const [reportReviewed, setReportReviewed] = useState(false);
  const [reportLimit, setReportLimit] = useState(30);

  // Selected post for modal
  const [selectedPost, setSelectedPost] = useState<AdminFeedPostItem | null>(null);

  const queryClient = useQueryClient();
  const { showDialog } = useDialog();

  // 1. Stats Query
  const statsQuery = useQuery({
    queryKey: ['admin-feed-stats'],
    queryFn: () => apiRequest<{ data: FeedStats }>('/internal/feed/stats'),
    staleTime: 20_000,
  });
  const stats = statsQuery.data?.data;

  // 2. Posts Query
  const postsQuery = useQuery({
    queryKey: ['admin-feed-posts', page, limit, statusFilter, hasReportsFilter, searchQuery],
    queryFn: () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (hasReportsFilter) params.append('hasReports', 'true');
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      return apiRequest<{ data: AdminFeedPostsResponse }>(`/internal/feed/posts?${params.toString()}`);
    },
    staleTime: 10_000,
  });
  const postsData = postsQuery.data?.data;
  const postsList = postsData?.data ?? [];

  // 3. Reports Query
  const reportsQuery = useQuery({
    queryKey: ['admin-feed-reports', reportLimit, reportReviewed],
    queryFn: () =>
      apiRequest<{ data: AdminFeedReportItem[] }>(
        `/internal/feed/reports?limit=${reportLimit}&reviewed=${reportReviewed}`,
      ),
    staleTime: 10_000,
  });
  const reportsList = reportsQuery.data?.data ?? [];

  const handleRefreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-feed-stats'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-feed-posts'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-feed-reports'] });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSelectedRowIds([]);
    setSearchQuery(searchInput);
  };

  const handleResetSearch = () => {
    setSearchInput('');
    setSearchQuery('');
    setStatusFilter('ALL');
    setHasReportsFilter(false);
    setSelectedRowIds([]);
    setPage(1);
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedRowIds(checked ? postsList.map((p) => p.id) : []);
  };

  const handleSelectRow = (id: string) => {
    setSelectedRowIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const togglePostStatus = (postId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'HIDDEN' ? 'PUBLISHED' : 'HIDDEN';
    const isHiding = nextStatus === 'HIDDEN';

    showDialog({
      title: isHiding ? 'Ẩn bài đăng khỏi Feed?' : 'Khôi phục hiển thị bài đăng?',
      message: isHiding
        ? 'Bài viết này sẽ lập tức bị gỡ khỏi Beauty Feed người dùng và chỉ quản trị viên mới thấy được.'
        : 'Bài viết sẽ được duyệt lại và xuất hiện bình thường trên Beauty Feed.',
      type: isHiding ? 'warning' : 'info',
      confirmText: isHiding ? 'Ẩn bài ngay' : 'Đăng lại',
      onConfirm: async () => {
        try {
          await apiRequest(`/internal/feed/posts/${postId}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status: nextStatus }),
          });
          if (selectedPost && selectedPost.id === postId) {
            setSelectedPost({ ...selectedPost, status: nextStatus });
          }
          handleRefreshAll();
        } catch (error) {
          showDialog({
            title: 'Không thể cập nhật bài đăng',
            message: error instanceof Error ? error.message : 'Có lỗi xảy ra khi thao tác.',
            type: 'error',
          });
        }
      },
    });
  };

  const handleBulkChangeStatus = (targetStatus: 'PUBLISHED' | 'HIDDEN') => {
    if (selectedRowIds.length === 0) return;
    const isHiding = targetStatus === 'HIDDEN';

    showDialog({
      title: isHiding ? 'Ẩn bài đăng hàng loạt' : 'Hiện lại bài đăng hàng loạt',
      message: `Bạn có chắc muốn ${isHiding ? 'ẩn' : 'hiển thị lại'} ${selectedRowIds.length} bài đăng đã chọn?`,
      type: isHiding ? 'warning' : 'info',
      confirmText: isHiding ? 'Ẩn hàng loạt' : 'Hiện hàng loạt',
      onConfirm: async () => {
        try {
          await Promise.all(
            selectedRowIds.map((id) =>
              apiRequest(`/internal/feed/posts/${id}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status: targetStatus }),
              }),
            ),
          );
          setSelectedRowIds([]);
          handleRefreshAll();
          showDialog({
            title: 'Thành công',
            message: `Đã cập nhật trạng thái cho ${selectedRowIds.length} bài đăng.`,
            type: 'success',
          });
        } catch (error) {
          showDialog({
            title: 'Lỗi cập nhật hàng loạt',
            message: error instanceof Error ? error.message : 'Có lỗi khi thao tác hàng loạt.',
            type: 'error',
          });
        }
      },
    });
  };

  const handleResolveReport = (
    report: AdminFeedReportItem,
    resolution: 'DISMISSED' | 'POST_HIDDEN',
  ) => {
    const isHiding = resolution === 'POST_HIDDEN';

    showDialog({
      title: isHiding ? 'Ẩn bài viết & Đóng báo cáo' : 'Bỏ qua báo cáo',
      message: isHiding
        ? 'Hệ thống sẽ tự động ẩn bài viết này khỏi Feed và đánh dấu báo cáo đã được giải quyết hợp lệ.'
        : 'Bài viết vẫn tiếp tục hiển thị bình thường. Báo cáo này sẽ được chuyển sang lịch sử đã xử lý.',
      type: isHiding ? 'warning' : 'info',
      confirmText: isHiding ? 'Xác nhận ẩn bài' : 'Bỏ qua báo cáo',
      onConfirm: async () => {
        try {
          await apiRequest(`/internal/feed/reports/${report.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ resolution }),
          });
          handleRefreshAll();
        } catch (error) {
          showDialog({
            title: 'Không thể xử lý báo cáo',
            message: error instanceof Error ? error.message : 'Có lỗi xảy ra khi xử lý.',
            type: 'error',
          });
        }
      },
    });
  };

  const isRefreshing =
    statsQuery.isFetching || postsQuery.isFetching || reportsQuery.isFetching;

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Quản trị Beauty Feed
              </h1>
              <p className="text-sm text-slate-500">
                Kiểm duyệt danh sách bài đăng, xử lý báo cáo vi phạm cộng đồng và tối ưu hoá bộ nhớ đệm Feed.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefreshAll}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 text-teal-700 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Overview Grid */}
      <FeedStatsCards
        stats={stats}
        onSelectReportsTab={() => {
          setActiveTab('reports');
          setReportReviewed(false);
        }}
      />

      {/* 3. Navigation Tabs */}
      <div className="border-b border-slate-200 bg-white px-2 rounded-xl shadow-sm">
        <nav className="flex space-x-2">
          <button
            type="button"
            onClick={() => setActiveTab('posts')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
              activeTab === 'posts'
                ? 'border-teal-700 text-teal-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <List className="h-4 w-4" />
            <span>Danh sách bài đăng</span>
            {stats && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                {stats.totalPosts}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
              activeTab === 'reports'
                ? 'border-teal-700 text-teal-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldAlert className="h-4 w-4" />
            <span>Danh sách báo cáo vi phạm</span>
            {stats && stats.pendingReports > 0 && (
              <span className="rounded-full bg-rose-600 px-2 py-0.5 text-xs font-bold text-white">
                {stats.pendingReports}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cache')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
              activeTab === 'cache'
                ? 'border-teal-700 text-teal-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            <span>Hiệu năng & Cache</span>
          </button>
        </nav>
      </div>

      {/* 4. Tab Contents */}

      {/* TAB 1: POSTS LIST MANAGEMENT */}
      {activeTab === 'posts' && <FeedReviewQueue />}
      {activeTab === 'reports' && <FeedModerationOperations postReports={reportsList.filter(report=>!report.resolution)} />}
      {activeTab === 'posts' && (
        <div className="space-y-4">
          {/* Filter & Search Bar */}
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
            <form onSubmit={handleSearchSubmit} className="flex flex-1 items-center gap-2">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm theo nội dung, tên đối tác, ID bài..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2 pl-9 pr-4 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-teal-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-600"
                />
              </div>
              <button
                type="submit"
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
              >
                Tìm kiếm
              </button>
              {(searchQuery || searchInput || statusFilter !== 'ALL' || hasReportsFilter) && (
                <button
                  type="button"
                  onClick={handleResetSearch}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Xoá lọc
                </button>
              )}
            </form>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as 'ALL' | 'PUBLISHED' | 'HIDDEN');
                  setSelectedRowIds([]);
                  setPage(1);
                }}
                className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="PUBLISHED">Đang hiển thị</option>
                <option value="HIDDEN">Đã ẩn</option>
              </select>

              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setSelectedRowIds([]);
                  setPage(1);
                }}
                className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none"
              >
                <option value={10}>10 dòng / trang</option>
                <option value={20}>20 dòng / trang</option>
                <option value={50}>50 dòng / trang</option>
                <option value={100}>100 dòng / trang</option>
              </select>

              <button
                type="button"
                onClick={() => {
                  setHasReportsFilter(!hasReportsFilter);
                  setSelectedRowIds([]);
                  setPage(1);
                }}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  hasReportsFilter
                    ? 'border-rose-300 bg-rose-50 text-rose-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Có báo cáo</span>
              </button>
            </div>
          </div>

          {/* Bulk Action Toolbar */}
          {selectedRowIds.length > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-teal-200 bg-teal-50 px-4 py-2.5 shadow-sm transition">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-teal-900">
                  Đã chọn {selectedRowIds.length} bài đăng:
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleBulkChangeStatus('HIDDEN')}
                  className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-bold text-rose-700 shadow-sm transition hover:bg-rose-50"
                >
                  Ẩn hàng loạt
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkChangeStatus('PUBLISHED')}
                  className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-emerald-700 shadow-sm transition hover:bg-emerald-50"
                >
                  Hiện lại hàng loạt
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRowIds([])}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800"
                >
                  Bỏ chọn
                </button>
              </div>
            </div>
          )}

          {/* Table List Content */}
          {postsQuery.isLoading ? (
            <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-200 bg-white">
              <LoaderCircle className="h-7 w-7 animate-spin text-teal-700" />
              <span className="ml-3 text-sm font-medium text-slate-500">Đang tải danh sách bài đăng...</span>
            </div>
          ) : !postsData || postsList.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <LayoutGrid className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-base font-bold text-slate-900">Không tìm thấy bài đăng nào</h3>
              <p className="mt-1 max-w-sm text-sm text-slate-500">
                {searchQuery || statusFilter !== 'ALL' || hasReportsFilter
                  ? 'Thử thay đổi điều kiện lọc hoặc từ khoá tìm kiếm.'
                  : 'Chưa có bài đăng nào trên Feed.'}
              </p>
            </div>
          ) : (
            <FeedPostsTable
              posts={postsList}
              selectedRowIds={selectedRowIds}
              onSelectAll={handleSelectAll}
              onSelectRow={handleSelectRow}
              onViewPost={setSelectedPost}
              onToggleStatus={togglePostStatus}
            />
          )}

          {/* Pagination Controls */}
          {postsData && postsData.totalPages > 1 && (
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="text-xs text-slate-500">
                Hiển thị trang <span className="font-bold text-slate-800">{postsData.page}</span> /{' '}
                <span className="font-bold text-slate-800">{postsData.totalPages}</span> (Tổng cộng{' '}
                <span className="font-bold text-slate-800">{postsData.total}</span> bài đăng)
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => {
                    setSelectedRowIds([]);
                    setPage((p) => Math.max(1, p - 1));
                  }}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>Trước</span>
                </button>

                <button
                  type="button"
                  disabled={page >= postsData.totalPages}
                  onClick={() => {
                    setSelectedRowIds([]);
                    setPage((p) => p + 1);
                  }}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  <span>Sau</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: REPORTS LIST */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setReportReviewed(false)}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                  !reportReviewed
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                Chờ xử lý ({stats?.pendingReports ?? 0})
              </button>
              <button
                type="button"
                onClick={() => setReportReviewed(true)}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                  reportReviewed
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                Lịch sử đã xử lý
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Giới hạn hiển thị:</span>
              <select
                value={reportLimit}
                onChange={(e) => setReportLimit(Number(e.target.value))}
                className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                <option value={20}>20 báo cáo</option>
                <option value={50}>50 báo cáo</option>
                <option value={100}>100 báo cáo</option>
              </select>
            </div>
          </div>

          {/* Reports Table */}
          {reportsQuery.isLoading ? (
            <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-200 bg-white">
              <LoaderCircle className="h-7 w-7 animate-spin text-teal-700" />
              <span className="ml-3 text-sm font-medium text-slate-500">Đang tải danh sách báo cáo...</span>
            </div>
          ) : reportsList.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 text-center">
              <ShieldCheck className="h-12 w-12 text-emerald-500" />
              <h3 className="mt-3 text-base font-bold text-slate-900">
                {reportReviewed ? 'Chưa có lịch sử xử lý báo cáo' : 'Hàng đợi sạch sẽ! Không có báo cáo vi phạm nào'}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {reportReviewed
                  ? 'Các báo cáo đã giải quyết sẽ hiển thị tại đây.'
                  : 'Tất cả bài đăng trên Feed đều tuân thủ tiêu chuẩn cộng đồng.'}
              </p>
            </div>
          ) : (
            <FeedReportsTable
              reports={reportsList}
              reportReviewed={reportReviewed}
              onResolveReport={handleResolveReport}
            />
          )}
        </div>
      )}

      {/* TAB 3: CACHE & PERFORMANCE */}
      {activeTab === 'cache' && (
        <div className="space-y-4">
          <FeedCachePanel />
        </div>
      )}

      {/* 5. Post Detail Drawer / Modal */}
      <FeedPostDetailModal
        post={selectedPost}
        onClose={() => setSelectedPost(null)}
        onToggleStatus={togglePostStatus}
      />
    </div>
  );
}
