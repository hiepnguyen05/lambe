import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { apiRequest } from '../../../lib/api-client';
import type {
  DashboardAnalyticsData,
  DashboardPeriod,
  OperationalAlertItem,
} from '../types/dashboard-analytics.types';
import {
  emptyDashboardAnalytics,
  formatRelativeTime,
  getAlertMeta,
} from '../utils/operational-alerts';

interface AnalyticsAlertPayload {
  id: string;
  type: string;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  orderId?: string;
  serviceName?: string;
  providerDisplayName?: string;
  detectedAt: string;
}

interface AnalyticsApiResponse {
  success: boolean;
  data: Omit<DashboardAnalyticsData, 'recentAlerts'> & {
    recentAlerts: AnalyticsAlertPayload[];
  };
}

export function useDashboardAnalytics(
  period: DashboardPeriod = '7d',
  canReadOrders = true,
) {
  const analyticsQuery = useQuery({
    queryKey: ['admin-dashboard-analytics', period],
    queryFn: () =>
      apiRequest<AnalyticsApiResponse>(
        `/admin/orders/analytics?period=${encodeURIComponent(period)}`,
      ),
    enabled: canReadOrders,
    staleTime: 30_000,
  });

  const data: DashboardAnalyticsData = useMemo(() => {
    const raw = analyticsQuery.data?.data;
    if (!raw) {
      return emptyDashboardAnalytics(period);
    }

    const referenceNow = analyticsQuery.dataUpdatedAt || 0;
    const recentAlerts: OperationalAlertItem[] = raw.recentAlerts.map((alert) => {
      const mapped = getAlertMeta(alert.type);
      const anchorMs = referenceNow || new Date(alert.detectedAt).getTime();
      return {
        id: alert.id,
        type: alert.type,
        title: mapped.title,
        severity: mapped.severity,
        orderId: alert.orderId,
        serviceName: alert.serviceName,
        providerDisplayName: alert.providerDisplayName,
        detectedAt: alert.detectedAt,
        timeAgo: formatRelativeTime(alert.detectedAt, anchorMs),
        status: alert.status,
      };
    });

    return {
      ...raw,
      recentAlerts,
    };
  }, [analyticsQuery.data, analyticsQuery.dataUpdatedAt, period]);

  return {
    data,
    isLoading: canReadOrders && analyticsQuery.isLoading,
    isError: canReadOrders && analyticsQuery.isError,
    refetch: () => {
      if (canReadOrders) {
        void analyticsQuery.refetch();
      }
    },
  };
}
