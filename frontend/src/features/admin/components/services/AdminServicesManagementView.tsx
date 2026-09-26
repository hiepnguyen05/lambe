import { useState } from 'react'
import { AdminCategoriesTab } from '../categories/AdminCategoriesTab'
import { AdminServicesTab } from './AdminServicesTab'

interface AdminServicesManagementViewProps {
  onShowToast: (title: string, message: string, icon?: string, isError?: boolean) => void
}

export function AdminServicesManagementView({ onShowToast }: AdminServicesManagementViewProps) {
  const [subTab, setSubTab] = useState<'services' | 'categories'>('services')

  return (
    <div className="admin-services-management">
      {/* Sub-tab Switcher Header */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 16,
          borderBottom: '1px solid var(--color-outline-variant, #e0e0e0)',
          paddingBottom: 8,
        }}
      >
        <button
          type="button"
          onClick={() => setSubTab('services')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 14,
            border: 'none',
            cursor: 'pointer',
            background: subTab === 'services' ? 'var(--color-primary, #6750a4)' : 'transparent',
            color: subTab === 'services' ? '#fff' : 'var(--color-on-surface-variant, #49454f)',
            transition: 'all 0.2s ease',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
            design_services
          </span>
          Dịch vụ Chuẩn & Khung giá
        </button>

        <button
          type="button"
          onClick={() => setSubTab('categories')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 14,
            border: 'none',
            cursor: 'pointer',
            background: subTab === 'categories' ? 'var(--color-primary, #6750a4)' : 'transparent',
            color: subTab === 'categories' ? '#fff' : 'var(--color-on-surface-variant, #49454f)',
            transition: 'all 0.2s ease',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
            category
          </span>
          Danh mục Dịch vụ
        </button>
      </div>

      {subTab === 'services' ? (
        <AdminServicesTab onShowToast={onShowToast} />
      ) : (
        <AdminCategoriesTab onShowToast={onShowToast} />
      )}
    </div>
  )
}
