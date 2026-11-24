import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { apiRequest } from '../../../lib/api-client';
import { useAdminAuth } from './useAdminAuth';

export interface AdminCategory {
  id: string;
  code: string;
  name: string;
  slug: string;
  description: string;
  iconUrl: string;
  coverImageUrl: string;
  sortOrder: number;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
}

export const ADMIN_CATEGORIES_QUERY_KEY = ['admin-categories'];

interface CategoryQuery {
  search?: string;
  status?: AdminCategory['status'];
  page: number;
  limit: number;
}

interface CategoryListResponse {
  data: AdminCategory[];
  meta?: { total?: number; totalPages?: number };
}

const errorText = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

export function useAdminCategories(query: CategoryQuery = { page: 1, limit: 100 }) {
  const { token } = useAdminAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: [...ADMIN_CATEGORIES_QUERY_KEY, query],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(query.page), limit: String(query.limit) });
      if (query.search) params.set('search', query.search);
      if (query.status) params.set('status', query.status);
      return apiRequest<CategoryListResponse>(`/admin/categories?${params.toString()}`);
    },
    enabled: !!token,
    staleTime: 60000,
    placeholderData: keepPreviousData,
  });

  const categories = data?.data ?? [];
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ADMIN_CATEGORIES_QUERY_KEY });

  const updateStatus = async (id: string, status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED') => {
    try {
      await apiRequest(`/admin/categories/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      await invalidate();
      return true;
    } catch (err: unknown) {
      throw new Error(errorText(err, 'Lỗi khi cập nhật trạng thái'));
    }
  };

  const createCategory = async (data: Partial<AdminCategory>) => {
    try {
      const res = await apiRequest<{ data: AdminCategory }>('/admin/categories', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      await invalidate();
      return res.data;
    } catch (err: unknown) {
      throw new Error(errorText(err, 'Lỗi khi tạo danh mục'));
    }
  };

  const updateCategory = async (id: string, data: Partial<AdminCategory>) => {
    try {
      const res = await apiRequest<{ data: AdminCategory }>(`/admin/categories/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      });
      await invalidate();
      return res.data;
    } catch (err: unknown) {
      throw new Error(errorText(err, 'Lỗi khi cập nhật danh mục'));
    }
  };

  const uploadCoverImage = async (id: string, file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiRequest<{ data: AdminCategory }>(`/admin/categories/${id}/cover-image`, {
        method: 'POST',
        body: formData
      });
      await invalidate();
      return res.data;
    } catch (err: unknown) {
      throw new Error(errorText(err, 'Lỗi khi tải ảnh lên'));
    }
  };

  const removeCoverImage = async (id: string) => {
    const res = await apiRequest<{ data: AdminCategory }>(`/admin/categories/${id}/cover-image`, {
      method: 'DELETE',
    });
    await invalidate();
    return res.data;
  };

  const reorderCategories = async (items: Array<{ id: string; sortOrder: number }>) => {
    await apiRequest('/admin/categories/reorder', {
      method: 'PATCH',
      body: JSON.stringify({ items }),
    });
    await invalidate();
  };

  return {
    categories,
    totalCount: data?.meta?.total ?? 0,
    totalPages: data?.meta?.totalPages ?? 1,
    isLoading,
    isFetching,
    error: error instanceof Error ? error.message : (error ? String(error) : null),
    refetch,
    updateStatus,
    createCategory,
    updateCategory,
    uploadCoverImage,
    removeCoverImage,
    reorderCategories,
  };
}
