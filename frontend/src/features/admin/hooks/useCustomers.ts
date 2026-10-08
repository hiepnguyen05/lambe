import { useState, useCallback, useEffect } from 'react';
import { apiRequest } from '../../../lib/api-client';
import { useAdminAuth } from './useAdminAuth';

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
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { token } = useAdminAuth();

  const fetchCustomers = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      // Xây dựng query string
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const res = await apiRequest<{ data: AdminCustomer[], meta: { total: number } }>(`/admin/customers?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCustomers(res.data || []);
      setTotalCount(res.meta?.total || 0);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải danh sách khách hàng');
    } finally {
      setIsLoading(false);
    }
  }, [token, pagination.page, pagination.limit, searchQuery, statusFilter]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const updateCustomerStatus = async (id: string, status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED', reason?: string) => {
    try {
      const payload: any = { status };
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
      return true;
    } catch (err: any) {
      throw new Error(err.message || 'Lỗi khi cập nhật trạng thái');
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
    searchQuery, setSearchQuery,
    statusFilter, setStatusFilter,
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
