import { useState, useCallback, useEffect, useRef } from 'react';
import { apiRequest } from '../../../lib/api-client';
import { useAdminAuth } from './useAdminAuth';
import { useDebounce } from './useDebounce';
import { useQueryClient } from '@tanstack/react-query';

export interface AdminCustomer {
  id: string;
  phone: string;
  fullName: string | null;
  avatarUrl: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  roles: string[];
  customerProfile: {
    gender: 'MALE' | 'FEMALE' | 'OTHER' | null;
    onboardingStatus: string | null;
  } | null;
  createdAt: string;
}

export function useCustomers() {
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery.trim(), 350);
  const [statusFilter, setStatusFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");
  const [onboardingFilter, setOnboardingFilter] = useState("all");
  const [providerStatusFilter, setProviderStatusFilter] = useState("all");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeRequestIdRef = useRef(0);

  const { token } = useAdminAuth();
  const queryClient = useQueryClient();

  const changeSearch = useCallback((val: string) => {
    setSearchQuery(val);
  }, []);

  useEffect(() => {
    setPagination(prev => prev.page === 1 ? prev : { ...prev, page: 1 });
  }, [debouncedSearch]);

  const changeStatus = useCallback((val: string) => {
    setStatusFilter(val);
    setPagination(prev => prev.page === 1 ? prev : { ...prev, page: 1 });
  }, []);

  const fetchCustomers = useCallback(async () => {
    if (!token) return;
    const currentRequestId = ++activeRequestIdRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (genderFilter !== 'all') params.append('gender', genderFilter);
      if (onboardingFilter !== 'all') params.append('onboardingStatus', onboardingFilter);
      if (providerStatusFilter !== 'all') params.append('providerStatus', providerStatusFilter);
      if (createdFrom) params.append('createdFrom', new Date(`${createdFrom}T00:00:00`).toISOString());
      if (createdTo) params.append('createdTo', new Date(`${createdTo}T23:59:59.999`).toISOString());

      const res = await apiRequest<{ data: AdminCustomer[], meta: { total: number } }>(`/admin/customers?${params.toString()}`);
      if (currentRequestId === activeRequestIdRef.current) {
        setCustomers(res.data || []);
        setTotalCount(res.meta?.total || 0);
      }
    } catch (err: unknown) {
      if (currentRequestId === activeRequestIdRef.current) {
        setError(err instanceof Error ? err.message : 'Lỗi khi tải danh sách khách hàng');
      }
    } finally {
      if (currentRequestId === activeRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [token, pagination.page, pagination.limit, debouncedSearch, statusFilter, genderFilter, onboardingFilter, providerStatusFilter, createdFrom, createdTo]);

  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect
    void fetchCustomers();
  }, [fetchCustomers]);

  const updateCustomerStatus = async (id: string, status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED', reason?: string) => {
    try {
      const payload: { status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED'; reason?: string } = { status };
      if (status === 'BLOCKED' || status === 'INACTIVE') {
        payload.reason = reason || 'Quản trị viên đã khóa tài khoản này do vi phạm chính sách';
      }
      if (status === 'ACTIVE') {
        payload.reason = 'Quản trị viên mở khóa tài khoản';
      }

      await apiRequest(`/admin/customers/${id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      setCustomers(prev => prev.map(c => c.id === id ? { ...c, status } : c));
      await queryClient.invalidateQueries({ queryKey: ['admin-customer-summary'] });
      return true;
    } catch (err: unknown) {
      throw new Error(err instanceof Error ? err.message : 'Lỗi khi cập nhật trạng thái');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRowIds(customers.map(c => c.id));
    } else {
      setSelectedRowIds([]);
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedRowIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  return {
    customers,
    totalCount,
    searchQuery, setSearchQuery: changeSearch,
    statusFilter, setStatusFilter: changeStatus,
    genderFilter, setGenderFilter,
    onboardingFilter, setOnboardingFilter,
    providerStatusFilter, setProviderStatusFilter,
    createdFrom, setCreatedFrom,
    createdTo, setCreatedTo,
    selectedRowIds, setSelectedRowIds,
    pagination, setPagination,
    isLoading,
    error,
    refetch: fetchCustomers,
    handleSelectAll,
    handleSelectRow,
    updateCustomerStatus
  };
}
