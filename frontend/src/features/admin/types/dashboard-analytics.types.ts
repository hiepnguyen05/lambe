export type DashboardPeriod = 'today' | '7d' | '30d' | 'month';

export interface DashboardKpis {
  gmv: number;
  gmvGrowth: number;
  totalBookings: number;
  bookingGrowth: number;
  completionRate: number;
  completionRateDelta: number;
  activeProviders: number;
  activeProvidersDelta: number;
  urgentAlertsCount: number;
}

export interface RevenueTrendPoint {
  date: string;
  rawDate: string;
  revenue: number;
  orders: number;
}

export interface OrderStatusSlice {
  status: string;
  label: string;
  count: number;
  percentage: number;
  color: string;
}

export interface CategoryBreakdown {
  name: string;
  revenue: number;
  orders: number;
  percentage: number;
}

export interface GrowthTrendPoint {
  period: string;
  newCustomers: number;
  newProviders: number;
}

export interface OperationalAlertItem {
  id: string;
  type: string;
  title: string;
  orderId?: string;
  serviceName?: string;
  providerDisplayName?: string;
  severity: 'urgent' | 'warning' | 'info';
  detectedAt: string;
  timeAgo: string;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
}

export interface DashboardAnalyticsData {
  period: DashboardPeriod;
  kpis: DashboardKpis;
  revenueTrend: RevenueTrendPoint[];
  statusDistribution: OrderStatusSlice[];
  categoryBreakdown: CategoryBreakdown[];
  growthTrend: GrowthTrendPoint[];
  recentAlerts: OperationalAlertItem[];
}

