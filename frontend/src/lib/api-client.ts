const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

interface ApiErrorBody {
  message?: string | string[]
}

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function getErrorMessage(body: ApiErrorBody | null): string {
  if (Array.isArray(body?.message)) {
    return body.message.join('. ')
  }

  return body?.message || 'Không thể kết nối đến máy chủ. Vui lòng thử lại.'
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
  } catch {
    throw new ApiError(
      'Không thể kết nối đến máy chủ. Vui lòng kiểm tra backend đang chạy.',
      0,
    )
  }

  const body = (await response.json().catch(() => null)) as T | ApiErrorBody | null

  if (!response.ok) {
    throw new ApiError(getErrorMessage(body as ApiErrorBody | null), response.status)
  }

  return body as T
}
