import { useCallback, useDeferredValue, useEffect, useState } from 'react';
import { apiRequest } from '../../../lib/api-client';
import { useAdminAuth } from './useAdminAuth';

export type ProviderType = 'INDIVIDUAL' | 'ORGANIZATION';
export type ProviderProfileStatus = 'SETUP_REQUIRED' | 'ACTIVE' | 'SUSPENDED';
export type ProviderStatusAction = 'ACTIVE' | 'SUSPENDED';

export interface AdminProvider {
  id: string;
  providerType: ProviderType;
  displayName: string;
  avatarUrl: string | null;
  experienceYears: number | null;
  status: ProviderProfileStatus;
  serviceAreaName: string | null;
  serviceRadiusKm: number | null;
  setupCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    fullName: string | null;
    phone: string;
    status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  };
  serviceCounts: {
    total: number;
    active: number;
    suspended: number;
  };
  isOnline: boolean;
  lastHeartbeatAt: string | null;
}

export interface AdminProviderDetail extends Omit<AdminProvider, 'serviceCounts'> {
  biography: string | null;
  serviceAreaLatitude: number | null;
  serviceAreaLongitude: number | null;
  sourceApplicationId: string;
  wallet: {
    balanceAmount: number;
    heldAmount: number;
    currencyCode: string;
    updatedAt: string;
  } | null;
  workingHours: Array<{
    dayOfWeek: number;
    startMinute: number;
    endMinute: number;
  }>;
  services: Array<{
    id: string;
    priceAmount: number;
    durationMinutes: number | null;
    description: string | null;
    status: 'INACTIVE' | 'ACTIVE' | 'SUSPENDED';
    service: {
      id: string;
      code: string;
      name: string;
      category: { id: string; name: string };
    };
  }>;
}

export interface ProviderSummary {
  total: number;
  setupRequired: number;
  active: number;
  suspended: number;
  individuals: number;
  organizations: number;
}

interface ProviderListResponse {
  data: AdminProvider[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    summary: ProviderSummary;
  };
}

const emptySummary: ProviderSummary = {
  total: 0,
  setupRequired: 0,
  active: 0,
  suspended: 0,
  individuals: 0,
  organizations: 0,
};

export function useAdminProviders() {
  const { token } = useAdminAuth();
  const [providers, setProviders] = useState<AdminProvider[]>([]);
  const [summary, setSummary] = useState<ProviderSummary>(emptySummary);
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearch = useDeferredValue(searchQuery.trim());
  const [providerType, setProviderType] = useState<'ALL' | ProviderType>('ALL');
  const [status, setStatus] = useState<'ALL' | ProviderProfileStatus>('ALL');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchProviders = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      if (deferredSearch) params.set('search', deferredSearch);
      if (providerType !== 'ALL') params.set('providerType', providerType);
      if (status !== 'ALL') params.set('status', status);

      const response = await apiRequest<ProviderListResponse>(
        `/admin/providers?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!Array.isArray(response.data)) {
        throw new Error('Máy chủ trả về danh sách nhà cung cấp không hợp lệ.');
      }
      setProviders(response.data);
      setSummary(response.meta?.summary ?? emptySummary);
      setPagination((current) => ({
        ...current,
        totalPages: Math.max(response.meta?.totalPages ?? 1, 1),
      }));
    } catch (requestError) {
      setError(toMessage(requestError, 'Không thể tải danh sách chuyên viên và đối tác.'));
    } finally {
      setIsLoading(false);
    }
  }, [deferredSearch, pagination.limit, pagination.page, providerType, status, token]);

  useEffect(() => {
    // The effect synchronizes the current filters with the remote provider list.
    // eslint-disable-next-line react/set-state-in-effect
    void fetchProviders();
  }, [fetchProviders]);

  const selectProviderType = (value: 'ALL' | ProviderType) => {
    setProviderType(value);
    setPagination((current) => ({ ...current, page: 1 }));
  };

  const selectStatus = (value: 'ALL' | ProviderProfileStatus) => {
    setStatus(value);
    setPagination((current) => ({ ...current, page: 1 }));
  };

  const changeSearch = (value: string) => {
    setSearchQuery(value);
    setPagination((current) => ({ ...current, page: 1 }));
  };

  const fetchProviderDetail = async (providerId: string) => {
    if (!token) throw new Error('Phiên đăng nhập không hợp lệ.');
    const response = await apiRequest<{ data: AdminProviderDetail }>(
      `/admin/providers/${providerId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return response.data;
  };

  const updateProviderStatus = async (
    providerId: string,
    nextStatus: ProviderStatusAction,
    reason: string,
  ) => {
    if (!token) throw new Error('Phiên đăng nhập không hợp lệ.');
    setActiveAction(`${nextStatus}:${providerId}`);
    try {
      const response = await apiRequest<{ data: AdminProviderDetail }>(
        `/admin/providers/${providerId}/status`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({ status: nextStatus, reason }),
        },
      );
      await fetchProviders();
      return response.data;
    } finally {
      setActiveAction(null);
    }
  };

  return {
    providers,
    summary,
    searchQuery,
    changeSearch,
    providerType,
    selectProviderType,
    status,
    selectStatus,
    pagination,
    setPagination,
    isLoading,
    activeAction,
    error,
    refetch: fetchProviders,
    fetchProviderDetail,
    updateProviderStatus,
  };
}

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
