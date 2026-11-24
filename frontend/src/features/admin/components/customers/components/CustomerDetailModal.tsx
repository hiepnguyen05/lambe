import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, X } from 'lucide-react'
import { apiRequest } from '../../../../../lib/api-client'
import type { AdminCustomer } from '../../../hooks/useCustomers'

interface CustomerAddress {
  id: string
  label: string | null
  addressLine: string
  isDefault: boolean
  contactName: string | null
  contactPhone: string | null
}

interface CustomerDetail extends AdminCustomer {
  customerAddresses: CustomerAddress[]
  providerProfile: {
    id: string
    providerType: string
    displayName: string
    status: string
    serviceAreaName: string | null
  } | null
}

interface ActivityItem {
  id: string
  action: string
  result: string
  createdAt: string
}

interface ApplicationItem {
  id: string
  providerType: string
  status: string
  legalFullName: string | null
  organizationName: string | null
  submittedAt: string | null
}

type Tab = 'profile' | 'activity' | 'applications'

export function CustomerDetailModal({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('profile')
  const detail = useQuery({
    queryKey: ['admin-customer-detail', customerId],
    queryFn: () => apiRequest<{ data: CustomerDetail }>(`/admin/customers/${customerId}`),
  })
  const activity = useQuery({
    queryKey: ['admin-customer-activity', customerId],
    queryFn: () => apiRequest<{ data: ActivityItem[] }>(`/admin/customers/${customerId}/activity?page=1&limit=50`),
    enabled: tab === 'activity',
  })
  const applications = useQuery({
    queryKey: ['admin-customer-applications', customerId],
    queryFn: () => apiRequest<{ data: ApplicationItem[] }>(`/admin/customers/${customerId}/provider-applications`),
    enabled: tab === 'applications',
  })

  const customer = detail.data?.data
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Đóng" className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b bg-slate-50 p-4">
          <h2 className="text-lg font-bold text-slate-800">Chi tiết khách hàng</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-200"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex gap-2 border-b px-5 pt-4">
          <TabButton active={tab === 'profile'} onClick={() => setTab('profile')}>Hồ sơ</TabButton>
          <TabButton active={tab === 'activity'} onClick={() => setTab('activity')}>Hoạt động</TabButton>
          <TabButton active={tab === 'applications'} onClick={() => setTab('applications')}>Hồ sơ đối tác</TabButton>
        </div>
        <div className="overflow-y-auto p-6">
          {detail.isLoading ? <Loading /> : detail.error || !customer ? (
            <ErrorText error={detail.error} />
          ) : tab === 'profile' ? (
            <Profile customer={customer} />
          ) : tab === 'activity' ? (
            <Activity data={activity.data?.data} loading={activity.isLoading} error={activity.error} />
          ) : (
            <Applications data={applications.data?.data} loading={applications.isLoading} error={applications.error} />
          )}
        </div>
      </div>
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`border-b-2 px-3 py-2 text-sm font-semibold ${active ? 'border-teal-700 text-teal-700' : 'border-transparent text-slate-500'}`}>{children}</button>
}

function Loading() {
  return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-teal-700" /></div>
}

function ErrorText({ error }: { error: unknown }) {
  return <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error instanceof Error ? error.message : 'Không thể tải dữ liệu.'}</div>
}

function Profile({ customer }: { customer: CustomerDetail }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        {customer.avatarUrl ? <img src={customer.avatarUrl} alt="" className="h-20 w-20 rounded-full object-cover" /> : <div className="flex h-20 w-20 items-center justify-center rounded-full bg-teal-50 text-2xl font-bold text-teal-700">{(customer.fullName || customer.phone).charAt(0)}</div>}
        <div><h3 className="text-xl font-bold text-slate-900">{customer.fullName || 'Chưa cập nhật tên'}</h3><p className="text-sm text-slate-500">{customer.phone}</p><p className="mt-1 text-xs font-semibold text-teal-700">{customer.status}</p></div>
      </div>
      <section className="rounded-xl border border-slate-200 p-4">
        <h4 className="mb-3 font-bold text-slate-900">Địa chỉ</h4>
        {customer.customerAddresses.length === 0 ? <p className="text-sm text-slate-500">Chưa có địa chỉ.</p> : customer.customerAddresses.map((address) => <div key={address.id} className="border-b py-2 last:border-0"><p className="font-semibold text-slate-800">{address.label || 'Địa chỉ'} {address.isDefault && '· Mặc định'}</p><p className="text-sm text-slate-500">{address.addressLine}</p><p className="text-xs text-slate-400">{address.contactName} {address.contactPhone}</p></div>)}
      </section>
      <section className="rounded-xl border border-slate-200 p-4">
        <h4 className="mb-2 font-bold text-slate-900">Trạng thái đối tác</h4>
        {customer.providerProfile ? <p className="text-sm text-slate-600">{customer.providerProfile.displayName} · {customer.providerProfile.providerType} · {customer.providerProfile.status}</p> : <p className="text-sm text-slate-500">Chưa có hồ sơ provider.</p>}
      </section>
    </div>
  )
}

function Activity({ data, loading, error }: { data?: ActivityItem[]; loading: boolean; error: unknown }) {
  if (loading) return <Loading />
  if (error) return <ErrorText error={error} />
  if (!data?.length) return <p className="text-sm text-slate-500">Chưa có hoạt động.</p>
  return <div className="space-y-2">{data.map((item) => <div key={item.id} className="rounded-xl border p-3"><p className="font-semibold text-slate-800">{item.action}</p><p className="text-xs text-slate-500">{item.result} · {new Date(item.createdAt).toLocaleString('vi-VN')}</p></div>)}</div>
}

function Applications({ data, loading, error }: { data?: ApplicationItem[]; loading: boolean; error: unknown }) {
  if (loading) return <Loading />
  if (error) return <ErrorText error={error} />
  if (!data?.length) return <p className="text-sm text-slate-500">Khách hàng chưa có hồ sơ đăng ký đối tác.</p>
  return <div className="space-y-2">{data.map((item) => <div key={item.id} className="rounded-xl border p-3"><p className="font-semibold text-slate-800">{item.organizationName || item.legalFullName || item.id}</p><p className="text-xs text-slate-500">{item.providerType} · {item.status}</p></div>)}</div>
}
