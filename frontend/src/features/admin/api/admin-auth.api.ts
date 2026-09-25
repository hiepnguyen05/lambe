import { ApiError, apiRequest } from '../../../lib/api-client'
import type {
  AdminAccount,
  AdminAccountResponse,
  AdminSessionResponse,
} from '../types/admin-auth.types'

let accessToken: string | null = null
let refreshPromise: Promise<AdminSessionResponse> | null = null

function saveSession(response: AdminSessionResponse): AdminSessionResponse {
  accessToken = response.data.accessToken
  return response
}

function refreshSession(): Promise<AdminSessionResponse> {
  if (!refreshPromise) {
    refreshPromise = apiRequest<AdminSessionResponse>('/admin/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    })
      .then(saveSession)
      .finally(() => {
        refreshPromise = null
      })
  }

  return refreshPromise
}

async function requestCurrentAccount(): Promise<AdminAccount> {
  if (!accessToken) {
    return (await refreshSession()).data.account
  }

  const response = await apiRequest<AdminAccountResponse>('/admin/auth/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
    credentials: 'include',
  })

  return response.data.account
}

export async function authorizedAdminRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  if (!accessToken) {
    await refreshSession()
  }

  const headers = new Headers(options.headers)
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  try {
    return await apiRequest<T>(path, {
      ...options,
      headers,
      credentials: 'include',
    })
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      accessToken = null
      await refreshSession()
      if (accessToken) {
        headers.set('Authorization', `Bearer ${accessToken}`)
      }
      return apiRequest<T>(path, {
        ...options,
        headers,
        credentials: 'include',
      })
    }
    throw error
  }
}

export const adminAuthApi = {
  async login(username: string, password: string): Promise<AdminAccount> {
    const response = await apiRequest<AdminSessionResponse>('/admin/auth/login', {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    })

    return saveSession(response).data.account
  },

  async restoreSession(): Promise<AdminAccount> {
    return (await refreshSession()).data.account
  },

  async getCurrentAccount(): Promise<AdminAccount> {
    try {
      return await requestCurrentAccount()
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) {
        throw error
      }

      accessToken = null
      await refreshSession()
      return requestCurrentAccount()
    }
  },

  async logout(): Promise<void> {
    try {
      await apiRequest('/admin/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
    } finally {
      accessToken = null
    }
  },
}

