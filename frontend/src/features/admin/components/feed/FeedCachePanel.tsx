import { useMutation, useQuery } from '@tanstack/react-query'
import { apiRequest } from '../../../../lib/api-client'
import { useDialog } from '../../../../components/ui/dialog-context'
import { useAdminAuth } from '../../hooks/useAdminAuth'

interface CacheStatus {
  enabled: boolean
  indexEnabled: boolean
  pending: number
  pendingIsLowerBound: boolean
  oldestAgeSeconds: number
  retries: number
  alerts: string[]
  objects: { list: { hits: number; misses: number }; detail: { hits: number; misses: number }; timeouts: number }
}
const alertLabels: Record<string, string> = { feed_cache_backlog_high: 'nhiều sự kiện đang chờ', feed_cache_backlog_old: 'hàng đợi xử lý chậm', feed_cache_redis_unavailable: 'Redis chưa sẵn sàng' }

export function FeedCachePanel() {
  const { account } = useAdminAuth()
  const admin = account?.roles.includes('ADMIN') === true
  const { showDialog } = useDialog()
  const query = useQuery({
    queryKey: ['feed-cache-status', account?.id],
    queryFn: () => apiRequest<{ data: CacheStatus }>('/internal/feed/cache/status'),
    enabled: admin,
    staleTime: 30_000,
  })
  const rebuild = useMutation({
    mutationFn: () => apiRequest('/internal/feed/cache/rebuild', { method: 'POST' }),
    onSuccess: () => { void query.refetch() },
    onError: (error) => showDialog({ title: 'Chưa dựng lại được Feed', message: error instanceof Error ? error.message : 'Vui lòng thử lại.', type: 'error' }),
  })
  if (!admin) return null
  const value = query.data?.data
  const hits = value ? value.objects.list.hits + value.objects.detail.hits : 0
  const reads = value ? hits + value.objects.list.misses + value.objects.detail.misses : 0
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-lg font-bold text-slate-900">Hiệu năng Beauty Feed</h2><p className="text-sm text-slate-500">Số liệu cache của máy chủ hiện tại; hàng đợi dùng chung.</p></div>
      <div className="flex gap-2">
        <button type="button" onClick={() => { void query.refetch() }} disabled={query.isFetching} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">Làm mới</button>
        <button type="button" disabled={rebuild.isPending || !value?.enabled} onClick={() => showDialog({ title: 'Dựng lại cache Feed?', message: 'Máy chủ sẽ chuyển sang phiên chỉ mục mới và nạp lại trang đầu. Dữ liệu bài đăng được giữ nguyên.', type: 'warning', confirmText: 'Dựng lại', onConfirm: async () => { await rebuild.mutateAsync() } })} className="rounded-lg border border-teal-300 px-3 py-2 text-sm text-teal-800 disabled:opacity-50">Dựng lại cache</button>
      </div>
    </div>
    {query.isError && <p className="mt-3 text-sm text-amber-800">Chưa đọc được trạng thái cache. Kiểm tra kết nối và migration backend.</p>}
    {value && <>
      <p className="mt-3 text-sm text-slate-600">Cache {value.enabled ? 'đã bật' : 'đang tắt'} · Chỉ mục {value.indexEnabled ? 'đã bật' : 'đang tắt'}</p>
      <dl className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div><dt className="text-sm text-slate-500">Sự kiện chờ xử lý</dt><dd className="text-xl font-bold">{value.pendingIsLowerBound ? '≥ ' : ''}{value.pending}</dd></div>
        <div><dt className="text-sm text-slate-500">Sự kiện cũ nhất</dt><dd className="text-xl font-bold">{Math.round(value.oldestAgeSeconds)} giây</dd></div>
        <div><dt className="text-sm text-slate-500">Tỷ lệ đọc trúng cache</dt><dd className="text-xl font-bold">{reads ? `${Math.round(hits / reads * 100)}%` : '—'}</dd></div>
        <div><dt className="text-sm text-slate-500">Lần cache quá hạn</dt><dd className="text-xl font-bold">{value.objects.timeouts}</dd></div>
      </dl>
      {value.alerts.length > 0 && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Feed cần kiểm tra: {value.alerts.map((alert) => alertLabels[alert] ?? alert).join(', ')}.</p>}
    </>}
  </section>
}
