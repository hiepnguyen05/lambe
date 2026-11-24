import type { AdminRole } from '../types/admin-auth.types'

export type AdminFeature =
  | 'dashboard'
  | 'customers'
  | 'providers'
  | 'providerApplications'
  | 'catalog'
  | 'orders'
  | 'orderAlerts'
  | 'cancellations'
  | 'disputes'
  | 'safety'
  | 'memberOperations'
  | 'memberKyc'
  | 'serviceChanges'
  | 'feedModeration'
  | 'vouchers'
  | 'internalAdministration'

const ALL_ROLES: AdminRole[] = [
  'ADMIN',
  'MODERATOR',
  'SUPPORT',
  'KYC_REVIEWER',
  'SERVICE_REVIEWER',
]

export const ADMIN_FEATURE_ROLES: Record<AdminFeature, AdminRole[]> = {
  dashboard: ALL_ROLES,
  customers: ['ADMIN', 'SUPPORT'],
  providers: ['ADMIN', 'MODERATOR', 'SUPPORT'],
  providerApplications: ALL_ROLES,
  catalog: ['ADMIN'],
  orders: ['ADMIN', 'MODERATOR', 'SUPPORT'],
  orderAlerts: ['ADMIN', 'SUPPORT'],
  cancellations: ['ADMIN', 'MODERATOR', 'SUPPORT'],
  disputes: ['ADMIN', 'MODERATOR', 'SUPPORT'],
  safety: ['ADMIN', 'SUPPORT'],
  memberOperations: ['ADMIN', 'MODERATOR', 'SUPPORT'],
  memberKyc: ['ADMIN', 'MODERATOR', 'KYC_REVIEWER'],
  serviceChanges: ['ADMIN', 'MODERATOR', 'SERVICE_REVIEWER'],
  feedModeration: ['ADMIN', 'MODERATOR'],
  vouchers: ['ADMIN'],
  internalAdministration: ['ADMIN'],
}

export function canAccessFeature(
  roles: readonly AdminRole[] | undefined,
  feature: AdminFeature,
): boolean {
  return Boolean(roles?.some((role) => ADMIN_FEATURE_ROLES[feature].includes(role)))
}
