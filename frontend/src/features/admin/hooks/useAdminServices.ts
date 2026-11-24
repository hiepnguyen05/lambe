import { useState, useCallback, useEffect, useRef } from 'react';
import { apiRequest } from '../../../lib/api-client';
import { useAdminAuth } from './useAdminAuth';
import { useDebounce } from './useDebounce';

export interface AdminService {
  id: string;
  code: string;
  name: string;
  slug: string;
  description: string | null;
  iconUrl: string | null;
  coverImageUrl: string | null;
  minPriceAmount: number;
  maxPriceAmount: number;
  currencyCode: string;
  defaultDurationMinutes: number | null;
  targetAudience: 'ALL' | 'MEN' | 'WOMEN';
  sortOrder: number;
  categoryId: string;
  category: {
    id: string;
    code: string;
    name: string;
    slug: string;
  };
  requiresCertificate: boolean;
  minPortfolioImages: number;
  minExperienceYears: number;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
}

export function useAdminServices() {
  const [services, setServices] = useState<AdminService[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery.trim(), 350);
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [targetAudienceFilter, setTargetAudienceFilter] = useState("all");
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeRequestIdRef = useRef(0);

  const { token } = useAdminAuth();

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

  const changeCategory = useCallback((val: string) => {
    setCategoryFilter(val);
    setPagination(prev => prev.page === 1 ? prev : { ...prev, page: 1 });
  }, []);

  const changeTargetAudience = useCallback((val: string) => {
    setTargetAudienceFilter(val);
    setPagination(prev => prev.page === 1 ? prev : { ...prev, page: 1 });
  }, []);

  const fetchServices = useCallback(async () => {
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
      if (categoryFilter !== 'all') params.append('categoryId', categoryFilter);
      if (targetAudienceFilter !== 'all') params.append('targetAudience', targetAudienceFilter);

      const res = await apiRequest<{ data: AdminService[], meta: { total: number } }>(`/admin/services?${params.toString()}`);
      if (currentRequestId === activeRequestIdRef.current) {
        setServices(res.data || []);
        setTotalCount(res.meta?.total || 0);
      }
    } catch (err: unknown) {
      if (currentRequestId === activeRequestIdRef.current) {
        setError(err instanceof Error ? err.message : 'Lỗi khi tải danh sách dịch vụ');
      }
    } finally {
      if (currentRequestId === activeRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [token, pagination.page, pagination.limit, debouncedSearch, statusFilter, categoryFilter, targetAudienceFilter]);

  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect
    void fetchServices();
  }, [fetchServices]);

  const getService = async (id: string) => {
    const res = await apiRequest<{ data: AdminService }>(`/admin/services/${id}`);
    return res.data;
  };

  const createService = async (data: Partial<AdminService>) => {
    const res = await apiRequest<{ data: AdminService }>('/admin/services', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    await fetchServices();
    return res.data;
  };

  const updateService = async (id: string, data: Partial<AdminService>) => {
    const res = await apiRequest<{ data: AdminService }>(`/admin/services/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
    await fetchServices();
    return res.data;
  };

  const updateStatus = async (id: string, status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED') => {
    const res = await apiRequest<{ data: AdminService }>(`/admin/services/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
    await fetchServices();
    return res.data;
  };

  const uploadCoverImage = async (id: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const res = await apiRequest<{ data: AdminService }>(`/admin/services/${id}/cover-image`, {
      method: 'POST',
      body: formData
    });
    await fetchServices();
    return res.data;
  };

  const removeCoverImage = async (id: string) => {
    const res = await apiRequest<{ data: AdminService }>(`/admin/services/${id}/cover-image`, {
      method: 'DELETE',
    });
    await fetchServices();
    return res.data;
  };

  const reorderServices = async (categoryId: string, items: Array<{ id: string; sortOrder: number }>) => {
    await apiRequest(`/admin/categories/${categoryId}/services/reorder`, {
      method: 'PATCH',
      body: JSON.stringify({ items }),
    });
    await fetchServices();
  };

  return {
    services,
    totalCount,
    searchQuery, setSearchQuery: changeSearch,
    statusFilter, setStatusFilter: changeStatus,
    categoryFilter, setCategoryFilter: changeCategory,
    targetAudienceFilter, setTargetAudienceFilter: changeTargetAudience,
    pagination, setPagination,
    isLoading,
    error,
    refetch: fetchServices,
    createService,
    getService,
    updateService,
    updateStatus,
    uploadCoverImage,
    removeCoverImage,
    reorderServices
  };
}
