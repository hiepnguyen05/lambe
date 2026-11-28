import type {
  DashboardAnalyticsData,
  DashboardPeriod,
} from '../types/dashboard-analytics.types'

export const OPERATIONAL_ALERT_LABELS: Record<string, string> = {
  ACCEPTED_START_OVERDUE: 'Đã nhận nhưng chưa xuất phát',
  EN_ROUTE_OVERDUE: 'Đang di chuyển quá lâu',
  ARRIVAL_START_OVERDUE: 'Đã đến nhưng chưa bắt đầu',
  SERVICE_COMPLETION_OVERDUE: 'Đang thực hiện quá giờ',
  CANCELLATION_REVIEW_STALE: 'Yêu cầu hủy chờ quá lâu',
  SAFETY_HOLD_STALE: 'Sự cố an toàn chưa xử lý',
  PAYMENT_DISPUTE_STALE: 'Tranh chấp thanh toán chưa xử lý',
  DISPUTED_STALE: 'Tranh chấp kéo dài',
}

const URGENT_ALERT_TYPES = new Set([
  'ACCEPTED_START_OVERDUE',
  'EN_ROUTE_OVERDUE',
  'ARRIVAL_START_OVERDUE',
  'SAFETY_HOLD_STALE',
  'PAYMENT_DISPUTE_STALE',
  'DISPUTED_STALE',
])

const WARNING_ALERT_TYPES = new Set([
  'SERVICE_COMPLETION_OVERDUE',
  'CANCELLATION_REVIEW_STALE',
])

export function getAlertMeta(type: string): {
  title: string
  severity: 'urgent' | 'warning' | 'info'
} {
  const title = OPERATIONAL_ALERT_LABELS[type] ?? 'Cảnh báo vận hành đơn hàng'
  const severity = URGENT_ALERT_TYPES.has(type)
    ? 'urgent'
    : WARNING_ALERT_TYPES.has(type)
      ? 'warning'
      : 'info'
  return { title, severity }
}

export function formatRelativeTime(isoDate: string, nowMs: number): string {
  const diffMs = Math.max(0, nowMs - new Date(isoDate).getTime())
  const diffMins = Math.floor(diffMs / 60_000)
  if (diffMins < 1) return 'Vừa xong'
  if (diffMins < 60) return `${diffMins} phút trước`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours} giờ trước`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays} ngày trước`
}

export function emptyDashboardAnalytics(
  period: DashboardPeriod = '7d',
): DashboardAnalyticsData {
  return {
    period,
    kpis: {
      gmv: 0,
      gmvGrowth: 0,
      totalBookings: 0,
      bookingGrowth: 0,
      completionRate: 0,
      completionRateDelta: 0,
      activeProviders: 0,
      activeProvidersDelta: 0,
      urgentAlertsCount: 0,
    },
    revenueTrend: [],
    statusDistribution: [],
    categoryBreakdown: [],
    growthTrend: [],
    recentAlerts: [],
  }
}
