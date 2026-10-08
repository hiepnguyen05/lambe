import { useState, useCallback, useEffect } from 'react';
import { apiRequest } from '../../../lib/api-client';
import { useAdminAuth } from './useAdminAuth';

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
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [targetAudienceFilter, setTargetAudienceFilter] = useState("all");
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { token } = useAdminAuth();

  const fetchServices = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (categoryFilter !== 'all') params.append('categoryId', categoryFilter);
      if (targetAudienceFilter !== 'all') params.append('targetAudience', targetAudienceFilter);

      const res = await apiRequest<{ data: AdminService[], meta: { total: number } }>(`/admin/services?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setServices(res.data || []);
      setTotalCount(res.meta?.total || 0);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải danh sách dịch vụ');
    } finally {
      setIsLoading(false);
    }
  }, [token, pagination.page, pagination.limit, searchQuery, statusFilter, categoryFilter, targetAudienceFilter]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const createService = async (data: any) => {
    const res = await apiRequest<{ data: AdminService }>('/admin/services', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    await fetchServices();
    return res.data;
  };

  const updateService = async (id: string, data: any) => {
    const res = await apiRequest<{ data: AdminService }>(`/admin/services/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    await fetchServices();
    return res.data;
  };

  const updateStatus = async (id: string, status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED') => {
    const res = await apiRequest<{ data: AdminService }>(`/admin/services/${id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
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
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    await fetchServices();
    return res.data;
  };

  const removeCoverImage = async (id: string) => {
    const res = await apiRequest<{ data: AdminService }>(`/admin/services/${id}/cover-image`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    await fetchServices();
    return res.data;
  };

  return {
    services,
    totalCount,
    searchQuery, setSearchQuery,
    statusFilter, setStatusFilter,
    categoryFilter, setCategoryFilter,
    targetAudienceFilter, setTargetAudienceFilter,
    pagination, setPagination,
    isLoading,
    error,
    refetch: fetchServices,
    createService,
    updateService,
    updateStatus,
    uploadCoverImage,
    removeCoverImage
  };
}
