import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckSquare,
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
  X,
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
import { buildResolveReportPayload, unwrapFeedReports } from './feed-helpers';
import {
  FEED_POLICY_OPTIONS,
  REASON_LABELS,
  type AdminFeedPostItem,
  type AdminFeedPostsResponse,
  type AdminFeedReportItem,
  type FeedPolicyCode,
  type FeedReportResolutionType,
  type FeedStats,
} from './types';

export function AdminFeedModeration() {
  const [activeTab, setActiveTab] = useState<'queue' | 'posts' | 'reports' | 'cache'>('queue');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PUBLISHED' | 'HIDDEN'>('ALL');
  const [moderationStatusFilter, setModerationStatusFilter] = useState<
    'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'
  >('ALL');
  const [hasReportsFilter, setHasReportsFilter] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);

  const [reportReviewed, setReportReviewed] = useState(false);
  const [reportLimit, setReportLimit] = useState(30);

  const [selectedPost, setSelectedPost] = useState<AdminFeedPostItem | null>(null);
  const [activeReport, setActiveReport] = useState<AdminFeedReportItem | null>(null);
  const [reportResolution, setReportResolution] =
    useState<FeedReportResolutionType>('CONTENT_REMOVED');
  const [reportPolicyCode, setReportPolicyCode] = useState<FeedPolicyCode>('OTHER');
  const [reportNote, setReportNote] = useState('');

  const queryClient = useQueryClient();
  const { showDialog } = useDialog();

  const statsQuery = useQuery({
    queryKey: ['admin-feed-stats'],
    queryFn: () => apiRequest<{ data: FeedStats }>('/internal/feed/stats'),
    staleTime: 20_000,
  });
  const stats = statsQuery.data?.data;

  const postsQuery = useQuery({
    queryKey: [
      'admin-feed-posts',
      page,
      limit,
      statusFilter,
      moderationStatusFilter,
      hasReportsFilter,
      searchQuery,
    ],
    queryFn: () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (moderationStatusFilter !== 'ALL') {
        params.append('moderationStatus', moderationStatusFilter);
      }
      if (hasReportsFilter) params.append('hasReports', 'true');
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      return apiRequest<{ data: AdminFeedPostsResponse }>(
        `/internal/feed/posts?${params.toString()}`,
      );
    },
    staleTime: 10_000,
  });
  const postsData = postsQuery.data?.data;
  const postsList = postsData?.data ?? [];

  const reportsQuery = useQuery({
    queryKey: ['admin-feed-reports', reportLimit, reportReviewed],
    queryFn: () =>
      apiRequest<unknown>(
        `/internal/feed/reports?limit=${reportLimit}&reviewed=${reportReviewed}`,
      ),
    staleTime: 10_000,
  });
  const reportsList = unwrapFeedReports(reportsQuery.data);

  const handleRefreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-feed-stats'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-feed-posts'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-feed-reports'] });
    void queryClient.invalidateQueries({ queryKey: ['feed-review-queue'] });
    void queryClient.invalidateQueries({ queryKey: ['feed-review-appeals'] });
    void queryClient.invalidateQueries({ queryKey: ['feed-operations'] });
    void queryClient.invalidateQueries({ queryKey: ['feed-comment-reports'] });
  };

  const resolveReportMutation = useMutation({
    mutationFn: () => {
      if (!activeReport) throw new Error('Thiếu thông tin báo cáo.');
      return apiRequest(`/internal/feed/reports/${activeReport.id}`, {
        method: 'PATCH',
        body: JSON.stringify(
          buildResolveReportPayload({
            resolution: reportResolution,
            policyCode: reportPolicyCode,
            note: reportNote,
          }),
        ),
      });
    },
    onSuccess: () => {
      setActiveReport(null);
      setReportNote('');
      handleRefreshAll();
      showDialog({
        title: 'Đã xử lý báo cáo',
        message: 'Quyết định xử lý vi phạm đã được cập nhật thành công.',
        type: 'success',
      });
    },
    onError: (error) => {
      showDialog({
        title: 'Không thể xử lý báo cáo',
        message: error instanceof Error ? error.message : 'Có lỗi xảy ra khi xử lý.',
        type: 'error',
      });
    },
  });

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
    setModerationStatusFilter('ALL');
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
        : 'Bài viết đã duyệt sẽ xuất hiện trở lại bình thường trên Beauty Feed.',
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

  const openReportModal = (report: AdminFeedReportItem) => {
    setActiveReport(report);
    setReportResolution(
      report.resolution && report.resolution !== 'DISMISSED' && report.resolution !== 'POST_HIDDEN'
        ? report.resolution
        : 'CONTENT_REMOVED',
    );
    setReportPolicyCode('OTHER');
    setReportNote(report.note ?? '');
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
                Kiểm duyệt bài viết chờ duyệt, xử lý báo cáo vi phạm, khiếu nại và bộ nhớ đệm Feed.
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
      <div className="border-b border-slate-200 bg-white px-2 rounded-xl shadow-sm overflow-x-auto">
        <nav className="flex space-x-2 min-w-max">
          <button
            type="button"
            onClick={() => setActiveTab('queue')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
              activeTab === 'queue'
                ? 'border-teal-700 text-teal-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CheckSquare className="h-4 w-4" />
            <span>Duyệt bài & Khiếu nại</span>
            {stats && (stats.pendingModeration ?? 0) > 0 && (
              <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">
                {stats.pendingModeration}
              </span>
            )}
          </button>

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
            <span>Xử lý vi phạm & Vận hành</span>
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

      {/* TAB 1: REVIEW QUEUE & APPEALS */}
      {activeTab === 'queue' && <FeedReviewQueue />}

      {/* TAB 2: POSTS LIST MANAGEMENT */}
      {activeTab === 'posts' && (
        <div className="space-y-4">
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
              {(searchQuery ||
                searchInput ||
                statusFilter !== 'ALL' ||
                moderationStatusFilter !== 'ALL' ||
                hasReportsFilter) && (
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
                value={moderationStatusFilter}
                onChange={(e) => {
                  setModerationStatusFilter(
                    e.target.value as 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED',
                  );
                  setSelectedRowIds([]);
                  setPage(1);
                }}
                className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none"
              >
                <option value="ALL">Mọi trạng thái duyệt</option>
                <option value="PENDING">Chờ kiểm duyệt</option>
                <option value="APPROVED">Đã duyệt</option>
                <option value="REJECTED">Bị từ chối</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as 'ALL' | 'PUBLISHED' | 'HIDDEN');
                  setSelectedRowIds([]);
                  setPage(1);
                }}
                className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none"
              >
                <option value="ALL">Mọi hiển thị</option>
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

          {selectedRowIds.length > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-teal-200 bg-teal-50 px-4 py-2.5 shadow-sm transition">
              <span className="text-xs font-bold text-teal-900">
                Đã chọn {selectedRowIds.length} bài đăng:
              </span>
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
                {searchQuery ||
                statusFilter !== 'ALL' ||
                moderationStatusFilter !== 'ALL' ||
                hasReportsFilter
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

      {/* TAB 3: REPORTS & OPERATIONS */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
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
                <option value={30}>30 báo cáo</option>
                <option value={50}>50 báo cáo</option>
                <option value={100}>100 báo cáo</option>
              </select>
            </div>
          </div>

          {reportsQuery.isLoading ? (
            <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-200 bg-white">
              <LoaderCircle className="h-7 w-7 animate-spin text-teal-700" />
              <span className="ml-3 text-sm font-medium text-slate-500">Đang tải danh sách báo cáo...</span>
            </div>
          ) : reportsQuery.isError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-xs font-semibold text-rose-700">
              Không tải được danh sách báo cáo vi phạm.{' '}
              <button
                type="button"
                onClick={() => void reportsQuery.refetch()}
                className="underline font-bold"
              >
                Thử lại
              </button>
            </div>
          ) : reportsList.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 text-center">
              <ShieldCheck className="h-12 w-12 text-emerald-500" />
              <h3 className="mt-3 text-base font-bold text-slate-900">
                {reportReviewed
                  ? 'Chưa có lịch sử xử lý báo cáo'
                  : 'Hàng đợi sạch sẽ! Không có báo cáo vi phạm nào'}
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
              onResolveReportModal={openReportModal}
            />
          )}

          <FeedModerationOperations />
        </div>
      )}

      {/* TAB 4: CACHE & PERFORMANCE */}
      {activeTab === 'cache' && (
        <div className="space-y-4">
          <FeedCachePanel />
        </div>
      )}

      {/* Post Detail & Review Modal */}
      {selectedPost && (
        <FeedPostDetailModal
          key={selectedPost.id}
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          onToggleStatus={togglePostStatus}
          onActionCompleted={() => setSelectedPost(null)}
        />
      )}

      {/* Report Violation Resolution Modal */}
      {activeReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="h-5 w-5 text-rose-600" />
                <h3 className="text-base font-bold text-slate-900">Xử lý báo cáo vi phạm</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveReport(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">
                    Lý do: {(REASON_LABELS[activeReport.reason] || { label: activeReport.reason }).label}
                  </span>
                  <span className="font-mono text-slate-400">#{activeReport.post.id.slice(0, 8)}</span>
                </div>
                {activeReport.detail && (
                  <p className="italic text-slate-600">"{activeReport.detail}"</p>
                )}
                <p className="text-slate-800 font-medium">
                  Nội dung bài: {activeReport.post.caption || 'Không có chú thích'}
                </p>
                {activeReport.post.media.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pt-1">
                    {activeReport.post.media.map((m) =>
                      m.kind === 'VIDEO' ? (
                        <video
                          key={m.id}
                          src={m.secureUrl}
                          controls
                          className="h-24 w-24 rounded-lg border border-slate-200 object-cover"
                        />
                      ) : (
                        <img
                          key={m.id}
                          src={m.secureUrl}
                          alt=""
                          className="h-24 w-24 rounded-lg border border-slate-200 object-cover"
                        />
                      ),
                    )}
                  </div>
                )}
              </div>

              {!activeReport.resolution ? (
                <>
                  <label className="block font-semibold text-slate-700">
                    Hình thức xử lý
                    <select
                      value={reportResolution}
                      onChange={(e) =>
                        setReportResolution(e.target.value as FeedReportResolutionType)
                      }
                      className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
                    >
                      <option value="CONTENT_REMOVED">Gỡ khỏi Feed & Ẩn bài viết</option>
                      <option value="CONTENT_RESTRICTED">Hạn chế gợi ý trên Feed</option>
                      <option value="NO_VIOLATION">Không vi phạm (Đóng báo cáo)</option>
                    </select>
                  </label>

                  <label className="block font-semibold text-slate-700">
                    Chính sách vi phạm
                    <select
                      value={reportPolicyCode}
                      onChange={(e) => setReportPolicyCode(e.target.value as FeedPolicyCode)}
                      className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800"
                    >
                      {FEED_POLICY_OPTIONS.map((opt) => (
                        <option key={opt.code} value={opt.code}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block font-semibold text-slate-700">
                    Ghi chú xử lý (tùy chọn, nếu nhập cần 5–500 ký tự)
                    <textarea
                      rows={3}
                      maxLength={500}
                      value={reportNote}
                      onChange={(e) => setReportNote(e.target.value)}
                      placeholder="Ghi nhận lý do cho tác giả và nhật ký kiểm duyệt..."
                      className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-800"
                    />
                  </label>
                </>
              ) : (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-800 font-medium">
                  Báo cáo này đã được giải quyết ({activeReport.resolution}).
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
              <button
                type="button"
                onClick={() => setActiveReport(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Đóng
              </button>
              {!activeReport.resolution && (
                <button
                  type="button"
                  disabled={
                    resolveReportMutation.isPending ||
                    (reportNote.trim().length > 0 && reportNote.trim().length < 5)
                  }
                  onClick={() => resolveReportMutation.mutate()}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {resolveReportMutation.isPending ? 'Đang xử lý...' : 'Xác nhận xử lý'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
