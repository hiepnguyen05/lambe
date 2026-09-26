import { authorizedAdminRequest } from './admin-auth.api'
import type {
  CategoriesApiResponse,
  CategoryDetailApiResponse,
  CreateCategoryPayload,
  ReorderCategoriesPayload,
  ServiceCategory,
  ServiceCategoryStatus,
  UpdateCategoryPayload,
} from '../types/admin-categories.types'

export const adminCategoriesApi = {
  async getAll(params?: { search?: string; status?: string }): Promise<ServiceCategory[]> {
    const query = new URLSearchParams()
    if (params?.search?.trim()) query.set('search', params.search.trim())
    if (params?.status) query.set('status', params.status)

    const queryString = query.toString() ? `?${query.toString()}` : ''
    const response = await authorizedAdminRequest<CategoriesApiResponse>(
      `/admin/categories${queryString}`,
    )
    return response.data
  },

  async getOne(id: string): Promise<ServiceCategory> {
    const response = await authorizedAdminRequest<CategoryDetailApiResponse>(
      `/admin/categories/${id}`,
    )
    return response.data
  },

  async create(payload: CreateCategoryPayload): Promise<ServiceCategory> {
    const response = await authorizedAdminRequest<CategoryDetailApiResponse>(
      '/admin/categories',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    )
    return response.data
  },

  async update(id: string, payload: UpdateCategoryPayload): Promise<ServiceCategory> {
    const response = await authorizedAdminRequest<CategoryDetailApiResponse>(
      `/admin/categories/${id}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
    )
    return response.data
  },

  async updateStatus(id: string, status: ServiceCategoryStatus): Promise<ServiceCategory> {
    const response = await authorizedAdminRequest<CategoryDetailApiResponse>(
      `/admin/categories/${id}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      },
    )
    return response.data
  },

  async reorder(payload: ReorderCategoriesPayload): Promise<ServiceCategory[]> {
    const response = await authorizedAdminRequest<CategoriesApiResponse>(
      '/admin/categories/reorder',
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
    )
    return response.data
  },

  async uploadCoverImage(id: string, file: File): Promise<ServiceCategory> {
    const formData = new FormData()
    formData.append('file', file)

    const response = await authorizedAdminRequest<CategoryDetailApiResponse>(
      `/admin/categories/${id}/cover-image`,
      {
        method: 'POST',
        body: formData,
      },
    )
    return response.data
  },

  async removeCoverImage(id: string): Promise<ServiceCategory> {
    const response = await authorizedAdminRequest<CategoryDetailApiResponse>(
      `/admin/categories/${id}/cover-image`,
      {
        method: 'DELETE',
      },
    )
    return response.data
  },

  async delete(id: string): Promise<ServiceCategory> {
    const response = await authorizedAdminRequest<CategoryDetailApiResponse>(
      `/admin/categories/${id}`,
      {
        method: 'DELETE',
      },
    )
    return response.data
  },
}
