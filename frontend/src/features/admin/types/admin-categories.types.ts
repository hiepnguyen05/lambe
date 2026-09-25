export type ServiceCategoryStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED'

export interface CategoryActor {
  id: string
  username: string
  fullName: string
}

export interface ServiceCategory {
  id: string
  code: string
  name: string
  normalizedName: string
  slug: string
  description?: string | null
  iconUrl?: string | null
  coverImageUrl?: string | null
  sortOrder: number
  status: ServiceCategoryStatus
  createdAt: string
  updatedAt: string
  createdBy?: CategoryActor | null
  updatedBy?: CategoryActor | null
}

export interface CreateCategoryPayload {
  code: string
  name: string
  slug: string
  description?: string
  iconUrl?: string
  coverImageUrl?: string
  sortOrder?: number
  status?: ServiceCategoryStatus
}

export interface UpdateCategoryPayload {
  code?: string
  name?: string
  slug?: string
  description?: string
  iconUrl?: string
  coverImageUrl?: string
  sortOrder?: number
  status?: ServiceCategoryStatus
}

export interface CategoriesApiResponse {
  success: true
  data: ServiceCategory[]
}

export interface CategoryDetailApiResponse {
  success: true
  message?: string
  data: ServiceCategory
}
