import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, LoaderCircle, RefreshCw, X } from 'lucide-react'
import { apiRequest } from '../../../../lib/api-client'
import { useDialog } from '../../../../components/ui/dialog-context'
import { useAdminAuth } from '../../hooks/useAdminAuth'
import { ServiceFormModal, type ServiceFormPayload } from '../services/ServiceFormModal'

interface ChangeRequest {
  id: string
  providerId: string
  type: 'ADD_EXISTING_SERVICE' | 'PROPOSE_NEW_SERVICE' | 'UPDATE_OFFERING'
  status: string
  categoryId?: string | null
  proposedName?: string | null
  proposedPriceAmount: number
  proposedDurationMinutes?: number | null
  proposedDescription?: string | null
  reviewNote?: string | null
  createdAt: string
  reviewedAt?: string | null
  service?: { id: string; name: string; status: string; category?: { id: string; name: string } } | null
  providerService?: { id: string; priceAmount: number; durationMinutes?: number | null; status: string } | null
  category?: { id: string; name: string; status: string } | null
  provider?: { id: string; displayName: string; status: string } | null
  documents: Array<{ id: string; type: string; status: string; createdAt: string }>
}

interface ListResponse { data: ChangeRequest[]; meta: { page: number; limit: number; total: number; totalPages: number } }

export function AdminServiceChanges() {
  const [status, setStatus] = useState('PENDING_REVIEW'); const [page, setPage] = useState(1); const [selectedId, setSelectedId] = useState<string | null>(null)
  const query = useQuery({ queryKey: ['admin-service-changes', status, page], queryFn: () => apiRequest<ListResponse>(`/admin/provider-service-change-requests?page=${page}&limit=20${status ? `&status=${status}` : ''}`) })
  return <div className="space-y-5"><div><h1 className="text-2xl font-bold text-slate-900">Thay đổi dịch vụ provider</h1><p className="mt-1 text-sm text-slate-500">Xét duyệt dịch vụ mới, thêm dịch vụ và cập nhật giá của đối tác.</p></div>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">Tất cả trạng thái</option><option value="PENDING_REVIEW">Chờ xét duyệt</option><option value="NEEDS_CHANGES">Cần bổ sung</option><option value="APPROVED">Đã duyệt</option><option value="REJECTED">Từ chối</option><option value="WITHDRAWN">Đã rút</option></select><span className="text-sm text-slate-500">{query.data?.meta.total ?? 0} yêu cầu</span></div><button type="button" onClick={() => query.refetch()} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><RefreshCw className={`h-4 w-4 ${query.isLoading ? 'animate-spin' : ''}`} /></button></div>
      {query.isLoading ? <Loading /> : <div className="space-y-3">{query.data?.data.map((item) => <div key={item.id} className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center"><div><div className="flex flex-wrap items-center gap-2"><p className="font-bold text-slate-900">{item.proposedName || item.service?.name || 'Thay đổi dịch vụ'}</p><Badge value={item.type} /><Badge value={item.status} /></div><p className="mt-1 text-sm text-slate-600">{item.provider?.displayName || `Provider #${item.providerId.slice(0, 8)}`} · {formatMoney(item.proposedPriceAmount)}</p><p className="text-xs text-slate-400">Tạo {formatDate(item.createdAt)}</p></div><button type="button" onClick={() => setSelectedId(item.id)} className="flex items-center gap-2 rounded-xl border border-teal-200 px-3 py-2 text-xs font-bold text-teal-700"><Eye className="h-4 w-4" />Xem và xử lý</button></div>)}</div>}
      {!query.isLoading && !query.data?.data.length && <div className="py-10 text-center text-sm text-slate-500">Không có yêu cầu.</div>}
      {(query.data?.meta.totalPages ?? 1) > 1 && <div className="mt-5 flex justify-end gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-40">Trước</button><span className="px-2 py-2 text-sm text-slate-500">{page}/{query.data?.meta.totalPages}</span><button type="button" disabled={page >= (query.data?.meta.totalPages ?? 1)} onClick={() => setPage(page + 1)} className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-40">Sau</button></div>}
    </section>{selectedId && <ChangeDrawer requestId={selectedId} onClose={() => setSelectedId(null)} />}</div>
}

function ChangeDrawer({ requestId, onClose }: { requestId: string; onClose: () => void }) {
  const { account } = useAdminAuth(); const { showDialog } = useDialog(); const queryClient = useQueryClient(); const [showCreateService, setShowCreateService] = useState(false)
  const query = useQuery({ queryKey: ['admin-service-change-detail', requestId], queryFn: () => apiRequest<{ data: ChangeRequest }>(`/admin/provider-service-change-requests/${requestId}`) })
  const item = query.data?.data; const canCreateCatalog = account?.roles.includes('ADMIN') ?? false
  const complete = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-service-changes'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-providers'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-services'] }),
    ])
    onClose()
  }
  const decideWithReason = (action: 'request-changes' | 'reject') => showDialog({ title: action === 'reject' ? 'Từ chối yêu cầu' : 'Yêu cầu bổ sung', message: 'Nhập lý do (ít nhất 5 ký tự):', type: 'warning', withInput: true, inputRequired: true, inputMinLength: 5, inputMaxLength: 1000, confirmText: 'Xác nhận', onConfirm: async (reason) => { try { await apiRequest(`/admin/provider-service-change-requests/${requestId}/${action}`, { method: 'POST', body: JSON.stringify({ reason }) }); await complete() } catch (error) { showFailure(showDialog, error) } } })
  const approve = async (body: object = {}) => { try { await apiRequest(`/admin/provider-service-change-requests/${requestId}/approve`, { method: 'POST', body: JSON.stringify(body) }); await complete() } catch (error) { showFailure(showDialog, error); throw error } }
  const approveNormally = () => showDialog({ title: 'Duyệt thay đổi dịch vụ', message: 'Xác nhận áp dụng thay đổi này cho provider?', type: 'success', confirmText: 'Duyệt', onConfirm: async () => { try { await approve() } catch { return false } } })
  const mapExisting = () => showDialog({ title: 'Ghép dịch vụ có sẵn', message: 'Nhập ID dịch vụ chuẩn đang hoạt động:', type: 'info', withInput: true, inputRequired: true, inputMinLength: 36, inputMaxLength: 36, confirmText: 'Ghép và duyệt', onConfirm: async (mapToServiceId) => { try { await approve({ mapToServiceId }) } catch { return false } } })
  const createCatalogAndApprove = async (payload: ServiceFormPayload) => { const result = await apiRequest<{ data: ChangeRequest }>(`/admin/provider-service-change-requests/${requestId}/approve`, { method: 'POST', body: JSON.stringify({ createService: payload }) }); await Promise.all([queryClient.invalidateQueries({ queryKey: ['admin-service-changes'] }), queryClient.invalidateQueries({ queryKey: ['admin-providers'] }), queryClient.invalidateQueries({ queryKey: ['admin-services'] })]); return { id: result.data.service?.id || requestId } }
  const openDocument = async (documentId: string) => { try { const result = await apiRequest<{ data: { url: string } }>(`/admin/provider-service-change-requests/${requestId}/documents/${documentId}/access`); window.open(result.data.url, '_blank', 'noopener,noreferrer') } catch (error) { showFailure(showDialog, error) } }
  return <><div className="fixed inset-0 z-50 flex justify-end bg-slate-900/35" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><div className="h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><h2 className="text-xl font-bold">Chi tiết thay đổi dịch vụ</h2><button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>{query.isLoading && <Loading />}{item && <div className="mt-6 space-y-5"><section className="rounded-2xl bg-slate-50 p-4"><div className="flex flex-wrap gap-2"><Badge value={item.type} /><Badge value={item.status} /></div><p className="mt-3 text-lg font-bold">{item.proposedName || item.service?.name}</p><p className="text-sm text-slate-600">Provider: {item.provider?.displayName || item.providerId}</p><p className="text-sm text-slate-600">Giá đề xuất: {formatMoney(item.proposedPriceAmount)} · {item.proposedDurationMinutes || '—'} phút</p>{item.proposedDescription && <p className="mt-2 text-sm text-slate-500">{item.proposedDescription}</p>}</section>
        <section><h3 className="font-bold text-slate-800">So sánh hiện tại</h3><div className="mt-2 grid gap-3 sm:grid-cols-2"><div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase text-slate-400">Dịch vụ chuẩn</p><p className="mt-1 text-sm">{item.service?.name || 'Chưa có trong hệ thống'}</p></div><div className="rounded-xl border p-3"><p className="text-xs font-bold uppercase text-slate-400">Giá hiện tại</p><p className="mt-1 text-sm">{item.providerService ? formatMoney(item.providerService.priceAmount) : 'Chưa cung cấp'}</p></div></div></section>
        <section><h3 className="font-bold text-slate-800">Tài liệu ({item.documents.length})</h3><div className="mt-2 space-y-2">{item.documents.map((doc) => <button key={doc.id} type="button" onClick={() => openDocument(doc.id)} className="flex w-full items-center justify-between rounded-xl border p-3 text-left text-sm hover:bg-slate-50"><span>{doc.type}</span><Badge value={doc.status} /></button>)}</div></section>
        {item.reviewNote && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{item.reviewNote}</p>}
        {item.status === 'PENDING_REVIEW' && <div className="flex flex-wrap justify-end gap-2 border-t pt-4"><button type="button" onClick={() => decideWithReason('reject')} className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-bold text-rose-700">Từ chối</button><button type="button" onClick={() => decideWithReason('request-changes')} className="rounded-xl border border-amber-200 px-4 py-2 text-sm font-bold text-amber-700">Yêu cầu bổ sung</button>{item.type !== 'PROPOSE_NEW_SERVICE' && <button type="button" onClick={approveNormally} className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-bold text-white">Duyệt</button>}{item.type === 'PROPOSE_NEW_SERVICE' && canCreateCatalog && <><button type="button" onClick={mapExisting} className="rounded-xl border border-teal-200 px-4 py-2 text-sm font-bold text-teal-700">Ghép dịch vụ có sẵn</button><button type="button" onClick={() => setShowCreateService(true)} className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-bold text-white">Tạo dịch vụ mới & duyệt</button></>}</div>}
      </div>}</div></div>
    {item && <ServiceFormModal isOpen={showCreateService} onClose={() => setShowCreateService(false)} onSuccess={() => { setShowCreateService(false); complete() }} title="Tạo dịch vụ chuẩn và duyệt" submitLabel="Tạo & duyệt" contextNote="Dịch vụ chuẩn sẽ được tạo từ đề xuất và gán cho provider." initialValues={{ categoryId: item.categoryId || item.category?.id || '', name: item.proposedName || '', minPriceAmount: item.proposedPriceAmount, maxPriceAmount: item.proposedPriceAmount, defaultDurationMinutes: item.proposedDurationMinutes || 45, description: item.proposedDescription || '' }} createService={createCatalogAndApprove} />}
  </>
}

function Loading() { return <div className="flex h-32 items-center justify-center text-sm text-slate-500"><LoaderCircle className="mr-2 h-5 w-5 animate-spin text-teal-700" />Đang tải...</div> }
function Badge({ value }: { value: string }) { const bad = ['REJECTED', 'NEEDS_CHANGES'].includes(value); const good = ['APPROVED', 'VERIFIED'].includes(value); return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${bad ? 'bg-rose-100 text-rose-700' : good ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'}`}>{value}</span> }
function formatDate(value: string) { return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) }
function formatMoney(value: number) { return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value) }
function showFailure(showDialog: ReturnType<typeof useDialog>['showDialog'], error: unknown) { showDialog({ title: 'Không thể xử lý', message: error instanceof Error ? error.message : 'Có lỗi xảy ra.', type: 'error' }) }

