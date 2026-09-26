import { authorizedAdminRequest } from './admin-auth.api'
import type {
  CreateServicePayload,
  PaginatedServicesResponse,
  ReorderServicesPayload,
  ServiceDetailApiResponse,
  ServiceQueryParams,
  ServiceStatus,
  StandardService,
  UpdateServicePayload,
} from '../types/admin-services.types'

export const adminServicesApi = {
  async getAll(params?: ServiceQueryParams): Promise<PaginatedServicesResponse> {
    const query = new URLSearchParams()
    if (params?.search?.trim()) query.set('search', params.search.trim())
    if (params?.categoryId) query.set('categoryId', params.categoryId)
    if (params?.status) query.set('status', params.status)
    if (params?.page) query.set('page', params.page.toString())
    if (params?.limit) query.set('limit', params.limit.toString())

    const queryString = query.toString() ? `?${query.toString()}` : ''
    return authorizedAdminRequest<PaginatedServicesResponse>(
      `/admin/services${queryString}`,
    )
  },

  async getOne(id: string): Promise<StandardService> {
    const response = await authorizedAdminRequest<ServiceDetailApiResponse>(
      `/admin/services/${id}`,
    )
    return response.data
  },

  async create(payload: CreateServicePayload): Promise<StandardService> {
    const response = await authorizedAdminRequest<ServiceDetailApiResponse>(
      '/admin/services',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    )
    return response.data
  },

  async update(id: string, payload: UpdateServicePayload): Promise<StandardService> {
    const response = await authorizedAdminRequest<ServiceDetailApiResponse>(
      `/admin/services/${id}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
    )
    return response.data
  },

  async updateStatus(id: string, status: ServiceStatus): Promise<StandardService> {
    const response = await authorizedAdminRequest<ServiceDetailApiResponse>(
      `/admin/services/${id}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      },
    )
    return response.data
  },

  async uploadCoverImage(id: string, file: File): Promise<StandardService> {
    const formData = new FormData()
    formData.append('file', file)

    const response = await authorizedAdminRequest<ServiceDetailApiResponse>(
      `/admin/services/${id}/cover-image`,
      {
        method: 'POST',
        body: formData,
      },
    )
    return response.data
  },

  async removeCoverImage(id: string): Promise<StandardService> {
    const response = await authorizedAdminRequest<ServiceDetailApiResponse>(
      `/admin/services/${id}/cover-image`,
      {
        method: 'DELETE',
      },
    )
    return response.data
  },

  async reorder(categoryId: string, payload: ReorderServicesPayload): Promise<void> {
    await authorizedAdminRequest(
      `/admin/categories/${categoryId}/services/reorder`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
    )
  },
}
