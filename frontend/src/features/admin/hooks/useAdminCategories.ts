import { useState, useEffect, useCallback } from 'react';
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

export function useAdminCategories() {
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAdminAuth();

  const fetchCategories = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ data: AdminCategory[] }>('/admin/categories', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCategories(res.data || []);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải danh sách danh mục');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const updateStatus = async (id: string, status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED') => {
    try {
      await apiRequest(`/admin/categories/${id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status })
      });
      setCategories(prev => prev.map(c => c.id === id ? { ...c, status } : c));
      return true;
    } catch (err: any) {
      throw new Error(err.message || 'Lỗi khi cập nhật trạng thái');
    }
  };

  const createCategory = async (data: Partial<AdminCategory>) => {
    try {
      const res = await apiRequest<{ data: AdminCategory }>('/admin/categories', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(data)
      });
      setCategories(prev => [res.data, ...prev]);
      return res.data;
    } catch (err: any) {
      throw new Error(err.message || 'Lỗi khi tạo danh mục');
    }
  };

  const updateCategory = async (id: string, data: Partial<AdminCategory>) => {
    try {
      const res = await apiRequest<{ data: AdminCategory }>(`/admin/categories/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(data)
      });
      setCategories(prev => prev.map(c => c.id === id ? res.data : c));
      return res.data;
    } catch (err: any) {
      throw new Error(err.message || 'Lỗi khi cập nhật danh mục');
    }
  };

  const uploadCoverImage = async (id: string, file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiRequest<{ data: AdminCategory }>(`/admin/categories/${id}/cover-image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        // Do NOT set Content-Type header to allow browser to generate boundary for multipart/form-data
        body: formData
      });
      setCategories(prev => prev.map(c => c.id === id ? res.data : c));
      return res.data;
    } catch (err: any) {
      throw new Error(err.message || 'Lỗi khi tải ảnh lên');
    }
  };

  return {
    categories,
    isLoading,
    error,
    refetch: fetchCategories,
    updateStatus,
    createCategory,
    updateCategory,
    uploadCoverImage
  };
}
