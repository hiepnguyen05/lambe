import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, FileCheck, LoaderCircle, RefreshCw, Users, X } from 'lucide-react'
import { apiRequest } from '../../../../lib/api-client'
import { useDialog } from '../../../../components/ui/dialog-context'
import { canAccessFeature } from '../../auth/admin-permissions'
import { useAdminAuth } from '../../hooks/useAdminAuth'

interface ApiList<T> { data: T[] }

interface MemberRow {
  id: string
  providerId: string
  role: string
  status: string
  displayName: string
  joinedAt: string
  suspendedAt?: string | null
  suspensionSource?: string | null
  suspensionReason?: string | null
  provider?: { displayName: string; status: string }
}

interface VerificationRow {
  id: string
  memberId: string
  status: string
  revisionNumber: number
  submittedAt?: string | null
  reviewedAt?: string | null
  member: { providerId: string; displayName: string; status: string; membershipVersion: number }
}

interface VerificationDetail {
  id: string
  memberId: string
  status: string
  revisionNumber: number
  legalFullName: string
  birthDate: string
  gender: string
  experienceYears: number
  nationalIdMasked: string
  submittedAt?: string | null
  decisionReason?: string | null
  documents: Array<{
    id: string
    type: string
    status: string
    providerServiceId?: string | null
    expiresAt?: string | null
    reviewNote?: string | null
    createdAt: string
  }>
}

export function AdminProviderMembers() {
  const { account } = useAdminAuth()
  const canOperate = canAccessFeature(account?.roles, 'memberOperations')
  const canReviewKyc = canAccessFeature(account?.roles, 'memberKyc')
  const [tab, setTab] = useState(canOperate ? 'members' : 'kyc')

  return <div className="space-y-5">
    <div><h1 className="text-2xl font-bold text-slate-900">Thành viên tổ chức</h1><p className="mt-1 text-sm text-slate-500">Quản lý vòng đời worker và xét duyệt hồ sơ KYC theo quyền.</p></div>
    <div className="flex gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
      {canOperate && <Tab active={tab === 'members'} onClick={() => setTab('members')} icon={Users}>Thành viên</Tab>}
      {canReviewKyc && <Tab active={tab === 'kyc'} onClick={() => setTab('kyc')} icon={FileCheck}>Hàng chờ KYC</Tab>}
    </div>
    {tab === 'members' && canOperate && <MembersTab />}
    {tab === 'kyc' && canReviewKyc && <KycTab />}
  </div>
}

function MembersTab() {
  const [page, setPage] = useState(1); const [status, setStatus] = useState(''); const { showDialog } = useDialog(); const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['admin-provider-members', page, status], queryFn: () => apiRequest<ApiList<MemberRow>>(`/admin/provider-members?page=${page}&limit=20${status ? `&status=${status}` : ''}`) })
  const changeStatus = (member: MemberRow) => {
    const reactivate = member.status === 'SUSPENDED'
    showDialog({ title: reactivate ? 'Khôi phục thành viên' : 'Đình chỉ thành viên', message: 'Nhập lý do xử lý (ít nhất 5 ký tự):', type: reactivate ? 'warning' : 'error', withInput: true, inputRequired: true, inputMinLength: 5, inputMaxLength: 1000, confirmText: reactivate ? 'Khôi phục' : 'Đình chỉ', onConfirm: async (reason) => {
      try { await apiRequest(`/admin/provider-members/${member.id}/${reactivate ? 'reactivate' : 'suspend'}`, { method: 'POST', body: JSON.stringify({ reason }) }); await queryClient.invalidateQueries({ queryKey: ['admin-provider-members'] }) }
      catch (error) { showFailure(showDialog, error) }
    } })
  }
  return <Panel title="Danh sách worker" loading={query.isLoading} onRefresh={() => query.refetch()}>
    <div className="mb-4"><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">Tất cả trạng thái</option><option value="PENDING_VERIFICATION">Chờ KYC</option><option value="ACTIVE">Hoạt động</option><option value="SUSPENDED">Đình chỉ</option><option value="LEFT">Đã rời</option></select></div>
    <div className="overflow-x-auto"><table className="w-full min-w-[780px]"><thead><tr>{['Thành viên', 'Tổ chức', 'Vai trò', 'Trạng thái', 'Đình chỉ', ''].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-400">{h}</th>)}</tr></thead><tbody>{query.data?.data.map((member) => <tr key={member.id} className="border-t border-slate-100"><td className="px-4 py-3"><p className="font-semibold text-slate-800">{member.displayName}</p><p className="text-xs text-slate-400">{shortId(member.id)}</p></td><td className="px-4 py-3 text-sm text-slate-600">{member.provider?.displayName || shortId(member.providerId)}</td><td className="px-4 py-3 text-sm">{member.role}</td><td className="px-4 py-3"><Badge value={member.status} /></td><td className="max-w-xs px-4 py-3 text-xs text-slate-500">{member.suspensionReason || '—'}</td><td className="px-4 py-3 text-right">{member.role !== 'OWNER' && member.status !== 'LEFT' && <button type="button" onClick={() => changeStatus(member)} className={`rounded-xl border px-3 py-2 text-xs font-bold ${member.status === 'SUSPENDED' ? 'border-emerald-200 text-emerald-700' : 'border-rose-200 text-rose-700'}`}>{member.status === 'SUSPENDED' ? 'Khôi phục' : 'Đình chỉ'}</button>}</td></tr>)}</tbody></table></div>
    {!query.isLoading && !query.data?.data.length && <Empty />}
    <SimplePagination page={page} hasNext={(query.data?.data.length ?? 0) === 20} onChange={setPage} />
  </Panel>
}

function KycTab() {
  const [page, setPage] = useState(1); const [status, setStatus] = useState('PENDING_REVIEW'); const [selected, setSelected] = useState<VerificationRow | null>(null)
  const query = useQuery({ queryKey: ['admin-member-verifications', page, status], queryFn: () => apiRequest<ApiList<VerificationRow>>(`/admin/provider-members/verifications?page=${page}&limit=20${status ? `&status=${status}` : ''}`) })
  return <Panel title="Hàng chờ xác minh" loading={query.isLoading} onRefresh={() => query.refetch()}>
    <div className="mb-4"><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">Tất cả trạng thái</option><option value="PENDING_REVIEW">Chờ xét duyệt</option><option value="NEEDS_CHANGES">Cần bổ sung</option><option value="APPROVED">Đã duyệt</option><option value="REJECTED">Từ chối</option></select></div>
    <div className="space-y-3">{query.data?.data.map((item) => <div key={item.id} className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center"><div><div className="flex items-center gap-2"><p className="font-bold text-slate-900">{item.member.displayName}</p><Badge value={item.status} /></div><p className="mt-1 text-sm text-slate-500">Member {shortId(item.memberId)} · revision {item.revisionNumber}</p><p className="text-xs text-slate-400">Gửi {formatDate(item.submittedAt)}</p></div><button type="button" onClick={() => setSelected(item)} className="flex items-center gap-2 rounded-xl border border-teal-200 px-3 py-2 text-xs font-bold text-teal-700"><Eye className="h-4 w-4" />Xem hồ sơ</button></div>)}</div>
    {!query.isLoading && !query.data?.data.length && <Empty />}
    <SimplePagination page={page} hasNext={(query.data?.data.length ?? 0) === 20} onChange={setPage} />
    {selected && <KycDrawer item={selected} onClose={() => setSelected(null)} />}
  </Panel>
}

function KycDrawer({ item, onClose }: { item: VerificationRow; onClose: () => void }) {
  const { showDialog } = useDialog(); const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['admin-member-verification-detail', item.memberId], queryFn: () => apiRequest<{ data: VerificationDetail }>(`/admin/provider-members/${item.memberId}/verification`), staleTime: 0, gcTime: 0 })
  const detail = query.data?.data
  const refresh = async () => { await queryClient.invalidateQueries({ queryKey: ['admin-member-verifications'] }); await query.refetch() }
  const decide = (action: 'approve' | 'request-changes' | 'reject') => {
    const needReason = action !== 'approve'
    showDialog({ title: action === 'approve' ? 'Duyệt KYC' : action === 'reject' ? 'Từ chối KYC' : 'Yêu cầu bổ sung', message: needReason ? 'Nhập lý do (ít nhất 5 ký tự):' : 'Xác nhận duyệt hồ sơ KYC này?', type: action === 'approve' ? 'success' : 'warning', withInput: needReason, inputRequired: needReason, inputMinLength: needReason ? 5 : undefined, inputMaxLength: 1000, confirmText: 'Xác nhận', onConfirm: async (reason) => {
      if (!detail) return
      try { await apiRequest(`/admin/provider-members/${item.memberId}/verification/${action}`, { method: 'POST', body: JSON.stringify({ verificationId: detail.id, revisionNumber: detail.revisionNumber, reason: reason || undefined }) }); await refresh(); onClose() }
      catch (error) { showFailure(showDialog, error) }
    } })
  }
  const reviewDocument = (documentId: string, status: 'VERIFIED' | 'NEEDS_CHANGES' | 'REJECTED') => {
    const needNote = status !== 'VERIFIED'
    showDialog({ title: 'Xét duyệt tài liệu', message: needNote ? 'Nhập ghi chú (ít nhất 5 ký tự):' : 'Xác nhận tài liệu hợp lệ?', type: status === 'VERIFIED' ? 'success' : 'warning', withInput: needNote, inputRequired: needNote, inputMinLength: needNote ? 5 : undefined, inputMaxLength: 1000, confirmText: 'Xác nhận', onConfirm: async (reviewNote) => {
      if (!detail) return
      try { await apiRequest(`/admin/provider-members/${item.memberId}/verification/documents/${documentId}`, { method: 'PATCH', body: JSON.stringify({ verificationId: detail.id, revisionNumber: detail.revisionNumber, status, reviewNote: reviewNote || undefined }) }); await query.refetch() }
      catch (error) { showFailure(showDialog, error) }
    } })
  }
  const viewDocument = async (documentId: string) => { try { const result = await apiRequest<{ data: { url: string } }>(`/admin/provider-members/${item.memberId}/verification/documents/${documentId}/access`); window.open(result.data.url, '_blank', 'noopener,noreferrer') } catch (error) { showFailure(showDialog, error) } }
  const revealIdentity = () => showDialog({ title: 'Xem số định danh', message: 'Nhập lý do truy cập (ít nhất 5 ký tự). Thao tác sẽ được ghi audit:', type: 'warning', withInput: true, inputRequired: true, inputMinLength: 5, inputMaxLength: 1000, confirmText: 'Truy cập', onConfirm: async (reason) => { if (!detail) return; try { const result = await apiRequest<{ data: { nationalIdNumber: string } }>(`/admin/provider-members/${item.memberId}/verification/identity/access`, { method: 'POST', body: JSON.stringify({ verificationId: detail.id, reason }) }); showDialog({ title: 'Số định danh', message: result.data.nationalIdNumber, type: 'info' }) } catch (error) { showFailure(showDialog, error) } } })
  return <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/35" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><div className="h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><h2 className="text-xl font-bold">Hồ sơ KYC</h2><button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>{query.isLoading && <Loading />}{detail && <div className="mt-6 space-y-6"><section className="rounded-2xl bg-slate-50 p-4"><div className="flex items-center justify-between"><div><p className="font-bold text-slate-900">{detail.legalFullName}</p><p className="text-sm text-slate-500">{detail.birthDate} · {detail.gender} · {detail.experienceYears} năm kinh nghiệm</p><p className="text-sm text-slate-500">CCCD: {detail.nationalIdMasked}</p></div><button type="button" onClick={revealIdentity} className="rounded-lg border px-3 py-2 text-xs font-bold text-slate-700">Xem đầy đủ</button></div></section>
      <section><h3 className="font-bold text-slate-800">Tài liệu</h3><div className="mt-3 space-y-3">{detail.documents.map((doc) => <div key={doc.id} className="rounded-xl border border-slate-200 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold">{doc.type}</p><Badge value={doc.status} /></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => viewDocument(doc.id)} className="rounded-lg border px-2.5 py-1.5 text-xs font-bold">Xem</button><button type="button" onClick={() => reviewDocument(doc.id, 'VERIFIED')} className="rounded-lg border border-emerald-200 px-2.5 py-1.5 text-xs font-bold text-emerald-700">Hợp lệ</button><button type="button" onClick={() => reviewDocument(doc.id, 'NEEDS_CHANGES')} className="rounded-lg border border-amber-200 px-2.5 py-1.5 text-xs font-bold text-amber-700">Bổ sung</button><button type="button" onClick={() => reviewDocument(doc.id, 'REJECTED')} className="rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-bold text-rose-700">Từ chối</button></div></div>{doc.reviewNote && <p className="mt-2 text-xs text-slate-500">{doc.reviewNote}</p>}</div>)}</div></section>
      {detail.status === 'PENDING_REVIEW' && <div className="flex flex-wrap justify-end gap-2 border-t pt-4"><button type="button" onClick={() => decide('reject')} className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-bold text-rose-700">Từ chối</button><button type="button" onClick={() => decide('request-changes')} className="rounded-xl border border-amber-200 px-4 py-2 text-sm font-bold text-amber-700">Yêu cầu bổ sung</button><button type="button" onClick={() => decide('approve')} className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-bold text-white">Duyệt KYC</button></div>}
    </div>}</div></div>
}

function Panel({ title, loading, onRefresh, children }: { title: string; loading: boolean; onRefresh: () => void; children: React.ReactNode }) { return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-bold">{title}</h2><button type="button" onClick={onRefresh} disabled={loading} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button></div>{loading ? <Loading /> : children}</section> }
function Tab({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: typeof Users; children: React.ReactNode }) { return <button type="button" onClick={onClick} className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold ${active ? 'bg-teal-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}><Icon className="h-4 w-4" />{children}</button> }
function Loading() { return <div className="flex h-32 items-center justify-center text-sm text-slate-500"><LoaderCircle className="mr-2 h-5 w-5 animate-spin text-teal-700" />Đang tải...</div> }
function Empty() { return <div className="py-10 text-center text-sm text-slate-500">Không có dữ liệu.</div> }
function Badge({ value }: { value: string }) { const bad = ['SUSPENDED', 'REJECTED', 'NEEDS_CHANGES'].includes(value); const good = ['ACTIVE', 'APPROVED', 'VERIFIED'].includes(value); return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${bad ? 'bg-rose-100 text-rose-700' : good ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'}`}>{value}</span> }
function SimplePagination({ page, hasNext, onChange }: { page: number; hasNext: boolean; onChange: (page: number) => void }) { return <div className="mt-5 flex items-center justify-end gap-2"><button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-40">Trước</button><span className="text-sm text-slate-500">Trang {page}</span><button type="button" disabled={!hasNext} onClick={() => onChange(page + 1)} className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-40">Sau</button></div> }
function shortId(value: string) { return `#${value.slice(0, 8)}` }
function formatDate(value?: string | null) { return value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—' }
function showFailure(showDialog: ReturnType<typeof useDialog>['showDialog'], error: unknown) { showDialog({ title: 'Không thể xử lý', message: error instanceof Error ? error.message : 'Có lỗi xảy ra.', type: 'error' }) }

