export type ServiceStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED'

export interface CategorySummary {
  id: string
  code: string
  name: string
  slug: string
  status: string
}

export interface AdminActorSummary {
  id: string
  username: string
  fullName: string
}

export interface StandardService {
  id: string
  categoryId: string
  code: string
  name: string
  slug: string
  description?: string | null
  iconUrl?: string | null
  coverImageUrl?: string | null
  minPriceAmount: number
  maxPriceAmount: number
  currencyCode: string
  defaultDurationMinutes?: number | null
  sortOrder: number
  status: ServiceStatus
  createdAt: string
  updatedAt: string
  category?: CategorySummary
  createdBy?: AdminActorSummary | null
  updatedBy?: AdminActorSummary | null
}

export interface ServiceQueryParams {
  search?: string
  categoryId?: string
  status?: ServiceStatus | string
  page?: number
  limit?: number
}

export interface PaginatedServicesResponse {
  success: boolean
  data: StandardService[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface ServiceDetailApiResponse {
  success: boolean
  data: StandardService
}

export interface CreateServicePayload {
  categoryId: string
  code: string
  name: string
  slug: string
  description?: string | null
  iconUrl?: string | null
  minPriceAmount: number
  maxPriceAmount: number
  defaultDurationMinutes?: number | null
  sortOrder?: number
}

export interface UpdateServicePayload {
  name?: string
  slug?: string
  description?: string | null
  iconUrl?: string | null
  minPriceAmount?: number
  maxPriceAmount?: number
  defaultDurationMinutes?: number | null
  sortOrder?: number
}

export interface ServiceOrderItemPayload {
  id: string
  sortOrder: number
}

export interface ReorderServicesPayload {
  items: ServiceOrderItemPayload[]
}
