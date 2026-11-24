import { useState } from 'react'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useDebounce } from '../../hooks/useDebounce'
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
  X,
  XCircle,
} from 'lucide-react'
import { apiRequest } from '../../../../lib/api-client'
import { useDialog } from '../../../../components/ui/dialog-context'
import { canAccessFeature, type AdminFeature } from '../../auth/admin-permissions'
import { useAdminAuth } from '../../hooks/useAdminAuth'

interface ApiList<T> {
  data: T[]
  meta?: { page: number; limit: number; total: number; totalPages: number }
}

interface OrderRow {
  id: string
  customerId: string
  providerId: string
  assignedMemberName?: string | null
  providerDisplayName?: string | null
  bookingType: string
  status: string
  serviceName: string
  totalAmount: number
  currencyCode: string
  expectedStartAt?: string | null
  expectedEndAt?: string | null
  createdAt: string
}

interface OrderDetail extends OrderRow {
  paymentMethod?: string
  durationMinutes?: number
  addressProvinceName?: string
  addressDistrictName?: string
  addressWardName?: string
  contactName?: string
  contactPhone?: string
  addressLine?: string
  customerNote?: string
  evidence?: Array<{ id: string; type: string; capturedAt: string }>
  timeline: Array<{ id: string; kind: string; at: string; value: string; reason?: string | null }>
}

interface OperationalAlert {
  id: string
  type: string
  status: 'OPEN' | 'ACKNOWLEDGED'
  detectedAt: string
  acknowledgedAt?: string | null
  acknowledgedById?: string | null
  order: {
    id: string
    status: string
    serviceName: string
    providerDisplayName?: string | null
    expectedStartAt?: string | null
    expectedEndAt?: string | null
  }
}

interface CancellationRequest {
  id: string
  orderId: string
  reason: string
  detail: string
  requestedAt: string
}

interface SafetyIncident {
  id: string
  orderId: string
  status: string
  createdAt: string
  reports: Array<{ reason: string; createdAt: string }>
}

interface CancellationDetail {
  id: string
  status: string
  serviceName: string
  totalAmount: number
  currencyCode: string
  provider?: { displayName?: string | null }
  customer?: { fullName?: string | null }
  cancellationRequest?: { reason: string; detail: string; status: string; requestedAt: string }
  evidence?: Array<{ id: string; type: string; capturedAt?: string; createdAt?: string }>
  statusHistory?: Array<{ id: string; fromStatus?: string | null; toStatus: string; reason?: string | null; createdAt: string }>
}

interface SafetyDetail {
  id: string
  orderId: string
  status: string
  createdAt: string
  reports: Array<{ id: string; reason: string; detail?: string | null; createdAt: string }>
  evidence: Array<{ id: string; createdAt: string }>
  order: { serviceName: string; status: string; addressLine?: string | null; contactName?: string | null; contactPhone?: string | null }
}

const ORDER_STATUSES = [
  'PENDING_PROVIDER', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS',
  'COMPLETED', 'CANCELLED', 'REJECTED', 'PAYMENT_DISPUTE', 'DISPUTED', 'SAFETY_HOLD',
]

const alertLabels: Record<string, string> = {
  ACCEPTED_START_OVERDUE: 'Đã nhận nhưng chưa xuất phát',
  EN_ROUTE_OVERDUE: 'Đang di chuyển quá lâu',
  ARRIVAL_START_OVERDUE: 'Đã đến nhưng chưa bắt đầu',
  SERVICE_COMPLETION_OVERDUE: 'Đang thực hiện quá giờ',
  CANCELLATION_REVIEW_STALE: 'Yêu cầu hủy chờ quá lâu',
  SAFETY_HOLD_STALE: 'Sự cố an toàn chưa xử lý',
  PAYMENT_DISPUTE_STALE: 'Tranh chấp thanh toán chưa xử lý',
  DISPUTED_STALE: 'Tranh chấp kéo dài',
}

const tabs: Array<{ id: string; label: string; feature: AdminFeature; icon: typeof ClipboardList }> = [
  { id: 'orders', label: 'Đơn hàng', feature: 'orders', icon: ClipboardList },
  { id: 'alerts', label: 'Cảnh báo đơn treo', feature: 'orderAlerts', icon: AlertTriangle },
  { id: 'cancellations', label: 'Yêu cầu hủy', feature: 'cancellations', icon: XCircle },
  { id: 'disputes', label: 'Tranh chấp', feature: 'disputes', icon: ShieldAlert },
  { id: 'safety', label: 'An toàn', feature: 'safety', icon: ShieldAlert },
]

export function AdminOrderOperations() {
  const { account } = useAdminAuth()
  const visibleTabs = tabs.filter((tab) => canAccessFeature(account?.roles, tab.feature))
  const [activeTab, setActiveTab] = useState(visibleTabs[0]?.id ?? 'orders')

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Vận hành đơn hàng</h1>
        <p className="mt-1 text-sm text-slate-500">Theo dõi tiến trình và xử lý các tình huống cần can thiệp.</p>
      </div>
      <div className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        {visibleTabs.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => setActiveTab(id)} className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === id ? 'bg-teal-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>
      {activeTab === 'orders' && <OrdersTab />}
      {activeTab === 'alerts' && <AlertsTab />}
      {activeTab === 'cancellations' && <CancellationsTab />}
      {activeTab === 'disputes' && <DisputesTab />}
      {activeTab === 'safety' && <SafetyTab />}
    </div>
  )
}

function OrdersTab() {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [bookingType, setBookingType] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [providerId, setProviderId] = useState('')
  const debouncedCustomerId = useDebounce(customerId.trim(), 350)
  const debouncedProviderId = useDebounce(providerId.trim(), 350)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const query = useQuery<ApiList<OrderRow>>({
    queryKey: ['admin-orders', page, status, bookingType, debouncedCustomerId, debouncedProviderId, from, to],
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (status) params.set('status', status)
      if (bookingType) params.set('bookingType', bookingType)
      if (isUuid(debouncedCustomerId)) params.set('customerId', debouncedCustomerId)
      if (isUuid(debouncedProviderId)) params.set('providerId', debouncedProviderId)
      if (from) params.set('from', new Date(`${from}T00:00:00`).toISOString())
      if (to) params.set('to', new Date(`${to}T23:59:59.999`).toISOString())
      return apiRequest<ApiList<OrderRow>>(`/admin/orders?${params}`)
    },
  })
  const hasOrders = Boolean(query.data?.data?.length)
  return (
    <Panel title="Danh sách đơn" loading={query.isLoading && !query.data} onRefresh={() => query.refetch()}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
          <option value="">Tất cả trạng thái</option>
          {ORDER_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={bookingType} onChange={(event) => { setBookingType(event.target.value); setPage(1) }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">Mọi kiểu đặt</option><option value="SCHEDULED">Đặt lịch</option><option value="ASAP">Tức thì</option></select>
        <input value={customerId} onChange={(event) => { setCustomerId(event.target.value); setPage(1) }} placeholder="Customer ID" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        <input value={providerId} onChange={(event) => { setProviderId(event.target.value); setPage(1) }} placeholder="Provider ID" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        <input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1) }} title="Từ ngày" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        <input type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1) }} title="Đến ngày" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        <span className="text-sm text-slate-500">{query.data?.meta?.total ?? 0} đơn</span>
      </div>
      <div className={query.isFetching && hasOrders ? 'opacity-60 transition-opacity' : ''}>
        <Table headers={['Dịch vụ', 'Provider / chuyên viên', 'Trạng thái', 'Thời gian', 'Giá trị', '']}>
          {query.data?.data.map((order) => (
            <tr key={order.id} className="border-t border-slate-100">
              <td className="px-4 py-3"><p className="font-semibold text-slate-800">{order.serviceName}</p><p className="text-xs text-slate-400">{shortId(order.id)}</p></td>
              <td className="px-4 py-3 text-sm text-slate-600">{order.assignedMemberName || order.providerDisplayName || '—'}</td>
              <td className="px-4 py-3"><Status value={order.status} /></td>
              <td className="px-4 py-3 text-sm text-slate-600">{formatDate(order.expectedStartAt || order.createdAt)}</td>
              <td className="px-4 py-3 text-sm font-semibold text-slate-700">{formatMoney(order.totalAmount, order.currencyCode)}</td>
              <td className="px-4 py-3 text-right"><button type="button" onClick={() => setSelectedId(order.id)} className="rounded-lg p-2 text-teal-700 hover:bg-teal-50" title="Xem chi tiết"><Eye className="h-4 w-4" /></button></td>
            </tr>
          ))}
        </Table>
      </div>
      <Empty show={!query.isLoading && !query.data?.data.length} />
      <Pagination page={page} totalPages={query.data?.meta?.totalPages ?? 1} onChange={setPage} />
      {selectedId && <OrderDetailDrawer orderId={selectedId} onClose={() => setSelectedId(null)} />}
    </Panel>
  )
}

function OrderDetailDrawer({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const { account } = useAdminAuth()
  const { showDialog } = useDialog()
  const query = useQuery({ queryKey: ['admin-order-detail', orderId], queryFn: () => apiRequest<{ data: OrderDetail }>(`/admin/orders/${orderId}`) })
  const order = query.data?.data
  const viewEvidence = async (evidenceId: string) => {
    try {
      const result = await apiRequest<{ data: { url: string } }>(`/admin/orders/${orderId}/evidence/${evidenceId}`)
      window.open(result.data.url, '_blank', 'noopener,noreferrer')
    } catch (error) { showError(showDialog, error) }
  }
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/35" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between"><h2 className="text-xl font-bold text-slate-900">Chi tiết đơn hàng</h2><button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
        {query.isLoading && <Loading />}
        {order && <div className="mt-6 space-y-5">
          <div className="rounded-2xl bg-slate-50 p-4"><p className="text-lg font-bold text-slate-900">{order.serviceName}</p><div className="mt-2"><Status value={order.status} /></div><p className="mt-3 text-sm text-slate-600">{order.providerDisplayName || order.assignedMemberName || 'Chưa có người thực hiện'}</p><p className="text-sm text-slate-600">{formatMoney(order.totalAmount, order.currencyCode)} · {order.paymentMethod || '—'}</p></div>
          {(order.contactName || order.addressLine) && <section><h3 className="font-bold text-slate-800">Liên hệ và địa chỉ</h3><p className="mt-2 text-sm text-slate-600">{order.contactName} {order.contactPhone && `· ${order.contactPhone}`}</p><p className="text-sm text-slate-600">{order.addressLine || [order.addressWardName, order.addressDistrictName, order.addressProvinceName].filter(Boolean).join(', ')}</p>{order.customerNote && <p className="mt-1 text-sm text-slate-500">Ghi chú: {order.customerNote}</p>}</section>}
          {account?.roles.includes('ADMIN') && Boolean(order.evidence?.length) && <section><h3 className="font-bold text-slate-800">Bằng chứng</h3><div className="mt-2 flex flex-wrap gap-2">{order.evidence!.map((item) => <button key={item.id} type="button" onClick={() => viewEvidence(item.id)} className="rounded-xl border px-3 py-2 text-xs font-bold text-teal-700">{item.type} · {formatDate(item.capturedAt)}</button>)}</div></section>}
          <section><h3 className="font-bold text-slate-800">Dòng thời gian</h3><div className="mt-3 space-y-3">{order.timeline?.map((event) => <div key={`${event.kind}-${event.id}`} className="border-l-2 border-teal-200 pl-3"><p className="text-sm font-semibold text-slate-700">{event.kind}: {event.value}</p><p className="text-xs text-slate-400">{formatDate(event.at)}</p>{event.reason && <p className="text-xs text-slate-500">{event.reason}</p>}</div>)}</div></section>
        </div>}
      </div>
    </div>
  )
}

function AlertsTab() {
  const queryClient = useQueryClient()
  const { showDialog } = useDialog()
  const query = useQuery({ queryKey: ['admin-order-alerts'], queryFn: () => apiRequest<ApiList<OperationalAlert>>('/admin/orders/operational-alerts'), refetchInterval: 60_000 })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-order-alerts'] })
  const simpleAction = async (id: string, action: string, body?: object) => {
    await apiRequest(`/admin/orders/operational-alerts/${id}/${action}`, { method: 'POST', body: body ? JSON.stringify(body) : undefined })
    await refresh()
  }
  const askNote = (alert: OperationalAlert, action: 'resolve' | 'cancel-order' | 'escalate-dispute', title: string) => showDialog({
    title, message: 'Nhập ghi chú xử lý (ít nhất 5 ký tự):', type: 'warning', withInput: true, inputRequired: true, inputMinLength: 5, inputMaxLength: 1000,
    confirmText: 'Xác nhận', onConfirm: async (note) => { try { await simpleAction(alert.id, action, { resolutionNote: note }) } catch (error) { showError(showDialog, error) } },
  })
  return <Panel title={`Cảnh báo đang mở (${query.data?.data.length ?? 0})`} loading={query.isLoading} onRefresh={() => query.refetch()}>
    <div className="space-y-3">{query.data?.data.map((alert) => <div key={alert.id} className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
      <div className="flex flex-col justify-between gap-3 lg:flex-row"><div><div className="flex flex-wrap items-center gap-2"><p className="font-bold text-slate-900">{alertLabels[alert.type] || alert.type}</p><Status value={alert.status} /></div><p className="mt-1 text-sm text-slate-600">{alert.order.serviceName} · {alert.order.providerDisplayName || 'Chưa rõ provider'}</p><p className="mt-1 text-xs text-slate-400">Phát hiện {formatDate(alert.detectedAt)} ({formatAge(alert.detectedAt)}) · Đơn {shortId(alert.order.id)} · {alert.order.status}</p>{alert.acknowledgedById && <p className="mt-1 text-xs text-slate-500">Đang xử lý: {shortId(alert.acknowledgedById)} từ {formatDate(alert.acknowledgedAt)}</p>}</div>
        <div className="flex flex-wrap items-center gap-2">{alert.status === 'OPEN' && <ActionButton onClick={async () => { try { await simpleAction(alert.id, 'acknowledge') } catch (error) { showError(showDialog, error) } }}>Nhận xử lý</ActionButton>}
          {['ACCEPTED_START_OVERDUE', 'EN_ROUTE_OVERDUE', 'ARRIVAL_START_OVERDUE'].includes(alert.type) && <ActionButton danger onClick={() => askNote(alert, 'cancel-order', 'Hủy đơn bị treo')}>Hủy đơn</ActionButton>}
          {alert.type === 'SERVICE_COMPLETION_OVERDUE' && <ActionButton danger onClick={() => askNote(alert, 'escalate-dispute', 'Chuyển sang tranh chấp')}>Chuyển tranh chấp</ActionButton>}
          <ActionButton onClick={() => askNote(alert, 'resolve', 'Đóng cảnh báo')}>Đóng cảnh báo</ActionButton>
        </div></div></div>)}</div><Empty show={!query.isLoading && !query.data?.data.length} text="Không có cảnh báo đơn treo." />
  </Panel>
}

function CancellationsTab() {
  const queryClient = useQueryClient(); const { showDialog } = useDialog()
  const [selected, setSelected] = useState<CancellationRequest | null>(null)
  const query = useQuery({ queryKey: ['admin-cancellation-requests'], queryFn: () => apiRequest<ApiList<CancellationRequest>>('/admin/orders/cancellation-requests') })
  const decide = (request: CancellationRequest, approve: boolean) => showDialog({
    title: approve ? 'Duyệt yêu cầu hủy' : 'Từ chối yêu cầu hủy', message: `${approve ? 'Duyệt' : 'Từ chối'} yêu cầu của đơn ${shortId(request.orderId)}?${approve ? '' : ' Nhập lý do:'}`, type: approve ? 'warning' : 'error', withInput: !approve, inputRequired: !approve, inputMaxLength: 500, confirmText: approve ? 'Duyệt hủy' : 'Từ chối',
    onConfirm: async (note) => { try { await apiRequest(`/admin/orders/cancellation-requests/${request.orderId}/decision`, { method: 'POST', body: JSON.stringify({ approve, note: note || undefined }) }); await queryClient.invalidateQueries({ queryKey: ['admin-cancellation-requests'] }) } catch (error) { showError(showDialog, error) } },
  })
  return <Panel title={`Yêu cầu hủy chờ xử lý (${query.data?.data.length ?? 0})`} loading={query.isLoading} onRefresh={() => query.refetch()}><div className="space-y-3">{query.data?.data.map((request) => <div key={request.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-col justify-between gap-3 lg:flex-row"><div><p className="font-bold text-slate-900">Đơn {shortId(request.orderId)}</p><p className="mt-1 text-sm font-semibold text-slate-600">{request.reason}</p><p className="text-sm text-slate-500">{request.detail}</p><p className="mt-1 text-xs text-slate-400">{formatDate(request.requestedAt)}</p></div><div className="flex items-center gap-2"><ActionButton onClick={() => setSelected(request)}>Chi tiết</ActionButton><ActionButton onClick={() => decide(request, false)}>Từ chối</ActionButton><ActionButton danger onClick={() => decide(request, true)}>Duyệt hủy</ActionButton></div></div></div>)}</div><Empty show={!query.isLoading && !query.data?.data.length} text="Không có yêu cầu hủy chờ xử lý." />{selected && <CancellationDrawer request={selected} onClose={() => setSelected(null)} />}</Panel>
}

function CancellationDrawer({ request, onClose }: { request: CancellationRequest; onClose: () => void }) {
  const { showDialog } = useDialog()
  const query = useQuery({ queryKey: ['admin-cancellation-detail', request.orderId], queryFn: () => apiRequest<{ data: CancellationDetail }>(`/admin/orders/cancellation-requests/${request.orderId}`), gcTime: 0 })
  const detail = query.data?.data
  const viewEvidence = async (evidenceId: string) => { try { const result = await apiRequest<{ data: { url: string } }>(`/admin/orders/cancellation-requests/${request.orderId}/evidence/${evidenceId}`); window.open(result.data.url, '_blank', 'noopener,noreferrer') } catch (error) { showError(showDialog, error) } }
  return <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/35" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><div className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><h2 className="text-xl font-bold">Chi tiết yêu cầu hủy</h2><button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>{query.isLoading && <Loading />}{detail && <div className="mt-6 space-y-5"><section className="rounded-2xl bg-slate-50 p-4"><p className="font-bold text-slate-900">{detail.serviceName}</p><div className="mt-2"><Status value={detail.status} /></div><p className="mt-2 text-sm text-slate-600">{detail.customer?.fullName || 'Khách hàng'} · {detail.provider?.displayName || 'Provider'}</p><p className="text-sm font-semibold">{formatMoney(detail.totalAmount, detail.currencyCode)}</p></section><section><h3 className="font-bold">Lý do hủy</h3><p className="mt-2 text-sm font-semibold text-slate-700">{detail.cancellationRequest?.reason}</p><p className="text-sm text-slate-500">{detail.cancellationRequest?.detail}</p></section>{Boolean(detail.evidence?.length) && <section><h3 className="font-bold">Bằng chứng</h3><div className="mt-2 flex flex-wrap gap-2">{detail.evidence!.map((item) => <button key={item.id} type="button" onClick={() => viewEvidence(item.id)} className="rounded-xl border px-3 py-2 text-xs font-bold text-teal-700">{item.type} · {formatDate(item.capturedAt || item.createdAt)}</button>)}</div></section>}<section><h3 className="font-bold">Lịch sử trạng thái</h3><div className="mt-2 space-y-2">{detail.statusHistory?.map((item) => <div key={item.id} className="border-l-2 border-teal-200 pl-3 text-sm"><p>{item.fromStatus || 'Bắt đầu'} → {item.toStatus}</p><p className="text-xs text-slate-400">{formatDate(item.createdAt)}</p></div>)}</div></section></div>}</div></div>
}

function DisputesTab() {
  const [status, setStatus] = useState('PAYMENT_DISPUTE'); const [page, setPage] = useState(1); const queryClient = useQueryClient(); const { showDialog } = useDialog()
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const query = useQuery({ queryKey: ['admin-payment-disputes', status, page], queryFn: () => apiRequest<ApiList<OrderRow>>(`/admin/orders/payment-disputes?status=${status}&page=${page}&limit=20`) })
  const decide = (order: OrderRow, decision: 'CONFIRM_PAID' | 'CONFIRM_UNPAID') => showDialog({ title: decision === 'CONFIRM_PAID' ? 'Xác nhận đã thanh toán' : 'Xác nhận chưa thanh toán', message: 'Nhập kết quả đối chiếu (ít nhất 10 ký tự):', type: 'warning', withInput: true, inputRequired: true, inputMinLength: 10, inputMaxLength: 500, confirmText: 'Xác nhận', onConfirm: async (note) => { try { await apiRequest(`/admin/orders/payment-disputes/${order.id}/decision`, { method: 'POST', body: JSON.stringify({ decision, note }) }); await queryClient.invalidateQueries({ queryKey: ['admin-payment-disputes'] }) } catch (error) { showError(showDialog, error) } } })
  return <Panel title="Tranh chấp thanh toán" loading={query.isLoading} onRefresh={() => query.refetch()}><div className="mb-4"><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="PAYMENT_DISPUTE">Chờ quyết định</option><option value="DISPUTED">Đã chuyển tranh chấp</option></select></div><Table headers={['Đơn', 'Dịch vụ', 'Provider', 'Giá trị', '']}>
    {query.data?.data.map((order) => <tr key={order.id} className="border-t border-slate-100"><td className="px-4 py-3 text-sm font-semibold">{shortId(order.id)}</td><td className="px-4 py-3 text-sm">{order.serviceName}</td><td className="px-4 py-3 text-sm text-slate-600">{order.providerDisplayName || '—'}</td><td className="px-4 py-3 text-sm">{formatMoney(order.totalAmount, order.currencyCode)}</td><td className="px-4 py-3"><div className="flex justify-end gap-2"><ActionButton onClick={() => setSelectedOrderId(order.id)}>Chi tiết</ActionButton>{status === 'PAYMENT_DISPUTE' && <><ActionButton onClick={() => decide(order, 'CONFIRM_UNPAID')}>Chưa thanh toán</ActionButton><ActionButton onClick={() => decide(order, 'CONFIRM_PAID')}>Đã thanh toán</ActionButton></>}</div></td></tr>)}
  </Table><Empty show={!query.isLoading && !query.data?.data.length} text="Không có tranh chấp trong bộ lọc này." /><Pagination page={page} totalPages={query.data?.meta?.totalPages ?? 1} onChange={setPage} />{selectedOrderId && <OrderDetailDrawer orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />}</Panel>
}

function SafetyTab() {
  const queryClient = useQueryClient(); const { showDialog } = useDialog()
  const [selected, setSelected] = useState<SafetyIncident | null>(null)
  const query = useQuery({ queryKey: ['admin-safety-incidents'], queryFn: () => apiRequest<ApiList<SafetyIncident>>('/admin/safety/incidents') })
  const close = (incident: SafetyIncident) => showDialog({ title: 'Đóng sự cố an toàn', message: 'Hành động này sẽ đóng sự cố, hủy đơn và giải phóng khoản giữ. Nhập kết quả xử lý (ít nhất 10 ký tự):', type: 'error', withInput: true, inputRequired: true, inputMinLength: 10, inputMaxLength: 1000, confirmText: 'Đóng sự cố', onConfirm: async (resolutionNote) => { try { await apiRequest(`/admin/safety/incidents/${incident.id}/close`, { method: 'POST', body: JSON.stringify({ resolutionNote }) }); await queryClient.invalidateQueries({ queryKey: ['admin-safety-incidents'] }) } catch (error) { showError(showDialog, error) } } })
  return <Panel title={`Sự cố an toàn đang mở (${query.data?.data.length ?? 0})`} loading={query.isLoading} onRefresh={() => query.refetch()}><div className="space-y-3">{query.data?.data.map((incident) => <div key={incident.id} className="rounded-2xl border border-rose-200 bg-rose-50/40 p-4"><div className="flex flex-col justify-between gap-3 lg:flex-row"><div><p className="font-bold text-slate-900">Đơn {shortId(incident.orderId)}</p><p className="mt-1 text-sm text-slate-600">{incident.reports.map((report) => report.reason).join(', ') || 'Chưa có phân loại'}</p><p className="mt-1 text-xs text-slate-400">Mở lúc {formatDate(incident.createdAt)}</p></div><div className="flex items-center gap-2"><ActionButton onClick={() => setSelected(incident)}>Chi tiết</ActionButton><ActionButton danger onClick={() => close(incident)}>Đóng sự cố</ActionButton></div></div></div>)}</div><Empty show={!query.isLoading && !query.data?.data.length} text="Không có sự cố an toàn đang mở." />{selected && <SafetyDrawer incident={selected} onClose={() => setSelected(null)} />}</Panel>
}

function SafetyDrawer({ incident, onClose }: { incident: SafetyIncident; onClose: () => void }) {
  const { showDialog } = useDialog()
  const query = useQuery({ queryKey: ['admin-safety-incident-detail', incident.id], queryFn: () => apiRequest<{ data: SafetyDetail }>(`/admin/safety/incidents/${incident.id}`), gcTime: 0 })
  const detail = query.data?.data
  const viewEvidence = async (evidenceId: string) => { try { const result = await apiRequest<{ data: { url: string } }>(`/admin/safety/incidents/${incident.id}/evidence/${evidenceId}`); window.open(result.data.url, '_blank', 'noopener,noreferrer') } catch (error) { showError(showDialog, error) } }
  return <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/35" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><div className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><h2 className="text-xl font-bold">Chi tiết sự cố an toàn</h2><button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>{query.isLoading && <Loading />}{detail && <div className="mt-6 space-y-5"><section className="rounded-2xl bg-rose-50 p-4"><p className="font-bold text-slate-900">{detail.order.serviceName}</p><div className="mt-2"><Status value={detail.order.status} /></div><p className="mt-2 text-sm text-slate-600">{detail.order.contactName} {detail.order.contactPhone && `· ${detail.order.contactPhone}`}</p><p className="text-sm text-slate-600">{detail.order.addressLine}</p></section><section><h3 className="font-bold">Báo cáo</h3><div className="mt-2 space-y-2">{detail.reports.map((report) => <div key={report.id} className="rounded-xl border p-3"><p className="text-sm font-semibold">{report.reason}</p>{report.detail && <p className="text-sm text-slate-500">{report.detail}</p>}<p className="mt-1 text-xs text-slate-400">{formatDate(report.createdAt)}</p></div>)}</div></section>{Boolean(detail.evidence.length) && <section><h3 className="font-bold">Bằng chứng riêng tư</h3><div className="mt-2 flex flex-wrap gap-2">{detail.evidence.map((item) => <button key={item.id} type="button" onClick={() => viewEvidence(item.id)} className="rounded-xl border px-3 py-2 text-xs font-bold text-teal-700">Xem ảnh · {formatDate(item.createdAt)}</button>)}</div></section>}</div>}</div></div>
}

function Panel({ title, loading, onRefresh, children }: { title: string; loading: boolean; onRefresh: () => void; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-bold text-slate-900">{title}</h2><button type="button" onClick={onRefresh} disabled={loading} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50" title="Làm mới"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button></div>{loading ? <Loading /> : children}</section>
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) { return <div className="overflow-x-auto"><table className="w-full min-w-[760px]"><thead><tr>{headers.map((header, index) => <th key={`${header}-${index}`} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400">{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div> }
function Loading() { return <div className="flex h-32 items-center justify-center text-sm text-slate-500"><LoaderCircle className="mr-2 h-5 w-5 animate-spin text-teal-700" />Đang tải...</div> }
function Empty({ show, text = 'Không có dữ liệu.' }: { show: boolean; text?: string }) { return show ? <div className="py-10 text-center text-sm text-slate-500">{text}</div> : null }
function Status({ value }: { value: string }) { const danger = ['CANCELLED', 'REJECTED', 'PAYMENT_DISPUTE', 'DISPUTED', 'SAFETY_HOLD', 'OPEN'].includes(value); const good = ['COMPLETED', 'RESOLVED'].includes(value); return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${danger ? 'bg-rose-100 text-rose-700' : good ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'}`}>{value}</span> }
function ActionButton({ children, danger = false, onClick }: { children: React.ReactNode; danger?: boolean; onClick: () => void | Promise<void> }) { return <button type="button" onClick={onClick} className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${danger ? 'border-rose-200 bg-white text-rose-700 hover:bg-rose-50' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>{children}</button> }
function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) { if (totalPages <= 1) return null; return <div className="mt-5 flex items-center justify-end gap-2"><button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} className="rounded-lg border p-2 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button><span className="text-sm text-slate-500">Trang {page}/{totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => onChange(page + 1)} className="rounded-lg border p-2 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button></div> }
function formatDate(value?: string | null) { return value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—' }
function formatMoney(value: number, currency: string) { return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: currency || 'VND' }).format(value) }
function shortId(value: string) { return `#${value.slice(0, 8)}` }
function isUuid(value: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) }
function formatAge(value: string) { const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000)); return minutes < 60 ? `${minutes} phút trước` : minutes < 1440 ? `${Math.floor(minutes / 60)} giờ trước` : `${Math.floor(minutes / 1440)} ngày trước` }
function showError(showDialog: ReturnType<typeof useDialog>['showDialog'], error: unknown) { showDialog({ title: 'Không thể xử lý', message: error instanceof Error ? error.message : 'Có lỗi xảy ra.', type: 'error' }) }

