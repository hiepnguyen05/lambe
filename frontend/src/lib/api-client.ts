const API_BASE_URL = (import.meta.env?.VITE_API_URL || '/api').replace(/\/$/, '')

interface ApiErrorBody {
  message?: string | string[]
}

interface AdminSessionData {
  accessToken: string
  account: unknown
}

interface AdminSessionResponse {
  data: AdminSessionData
}

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

let adminAccessToken: string | null = null
let refreshPromise: Promise<AdminSessionData> | null = null

export function setAdminAccessToken(token: string | null): void {
  adminAccessToken = token
}

export function getAdminAccessToken(): string | null {
  return adminAccessToken
}

const FIELD_NAMES_VI: Record<string, string> = {
  description: 'Mô tả',
  name: 'Tên',
  code: 'Mã',
  slug: 'Đường dẫn (slug)',
  iconUrl: 'Icon',
  sortOrder: 'Thứ tự sắp xếp',
  basePrice: 'Giá cơ bản',
  durationMinutes: 'Thời lượng',
  status: 'Trạng thái',
  email: 'Email',
  phone: 'Số điện thoại',
  password: 'Mật khẩu',
  title: 'Tiêu đề',
  note: 'Ghi chú',
  reason: 'Lý do',
  categoryId: 'Danh mục',
}

export function localizeValidationMessage(rawMessage: string): string {
  const msg = rawMessage.trim()

  const maxCharMatch = msg.match(/^(\w+)\s+must be shorter than or equal to\s+(\d+)\s+characters/i)
  if (maxCharMatch) {
    const field = FIELD_NAMES_VI[maxCharMatch[1]] || maxCharMatch[1]
    return `${field} không được vượt quá ${maxCharMatch[2]} ký tự.`
  }

  const minCharMatch = msg.match(/^(\w+)\s+must be longer than or equal to\s+(\d+)\s+characters/i)
  if (minCharMatch) {
    const field = FIELD_NAMES_VI[minCharMatch[1]] || minCharMatch[1]
    return `${field} phải có ít nhất ${minCharMatch[2]} ký tự.`
  }

  const emptyMatch = msg.match(/^(\w+)\s+should not be empty/i)
  if (emptyMatch) {
    const field = FIELD_NAMES_VI[emptyMatch[1]] || emptyMatch[1]
    return `${field} không được để trống.`
  }

  const strMatch = msg.match(/^(\w+)\s+must be a string/i)
  if (strMatch) {
    const field = FIELD_NAMES_VI[strMatch[1]] || strMatch[1]
    return `${field} phải là chuỗi ký tự.`
  }

  const intMatch = msg.match(/^(\w+)\s+must be an integer number/i)
  if (intMatch) {
    const field = FIELD_NAMES_VI[intMatch[1]] || intMatch[1]
    return `${field} phải là số nguyên.`
  }

  const minNumMatch = msg.match(/^(\w+)\s+must not be less than\s+(\d+)/i)
  if (minNumMatch) {
    const field = FIELD_NAMES_VI[minNumMatch[1]] || minNumMatch[1]
    return `${field} không được nhỏ hơn ${minNumMatch[2]}.`
  }

  const maxNumMatch = msg.match(/^(\w+)\s+must not be greater than\s+(\d+)/i)
  if (maxNumMatch) {
    const field = FIELD_NAMES_VI[maxNumMatch[1]] || maxNumMatch[1]
    return `${field} không được lớn hơn ${maxNumMatch[2]}.`
  }

  const uuidMatch = msg.match(/^(\w+)\s+must be a UUID/i)
  if (uuidMatch) {
    const field = FIELD_NAMES_VI[uuidMatch[1]] || uuidMatch[1]
    return `${field} phải là mã định danh (UUID) hợp lệ.`
  }

  return msg
}

function getErrorMessage(body: ApiErrorBody | null): string {
  if (Array.isArray(body?.message)) {
    return body.message
      .map((m) => (typeof m === 'string' ? localizeValidationMessage(m) : String(m)))
      .join('. ')
  }
  if (typeof body?.message === 'string') {
    return localizeValidationMessage(body.message)
  }
  return 'Không thể kết nối đến máy chủ. Vui lòng thử lại.'
}

function dispatchUnauthorized(): void {
  adminAccessToken = null
  const target = typeof globalThis.dispatchEvent === 'function' ? globalThis : null
  if (target && typeof Event !== 'undefined') {
    target.dispatchEvent(new Event('lambe:unauthorized'))
  }
}

async function parseResponse<T>(response: Response): Promise<T | ApiErrorBody | null> {
  const responseText = await response.text()
  if (!responseText) return null
  try {
    return JSON.parse(responseText) as T | ApiErrorBody
  } catch {
    if (response.ok) {
      throw new ApiError('Máy chủ trả về dữ liệu không hợp lệ.', response.status)
    }
    return null
  }
}

async function fetchApi<T>(
  path: string,
  options: RequestInit,
): Promise<{ response: Response; body: T | ApiErrorBody | null }> {
  const headers = new Headers(options.headers)
  if (adminAccessToken) headers.set('Authorization', `Bearer ${adminAccessToken}`)
  if (options.body && !headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      credentials: 'include',
      headers,
    })
  } catch {
    throw new ApiError(
      'Không thể kết nối đến máy chủ. Vui lòng kiểm tra backend đang chạy.',
      0,
    )
  }
  return { response, body: await parseResponse<T>(response) }
}

export function refreshAdminSession(): Promise<AdminSessionData> {
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    const { response, body } = await fetchApi<AdminSessionResponse>(
      '/admin/auth/refresh',
      { method: 'POST' },
    )
    if (!response.ok) {
      adminAccessToken = null
      throw new ApiError(getErrorMessage(body as ApiErrorBody | null), response.status)
    }
    const session = (body as AdminSessionResponse | null)?.data
    if (!session?.accessToken) {
      adminAccessToken = null
      throw new ApiError('Máy chủ không trả về phiên đăng nhập hợp lệ.', response.status)
    }
    adminAccessToken = session.accessToken
    return session
  })().finally(() => {
    refreshPromise = null
  })
  return refreshPromise
}

function canRefresh(path: string): boolean {
  return ![
    '/admin/auth/login',
    '/admin/auth/refresh',
    '/admin/auth/logout',
    '/admin/auth/activate',
  ].some((authPath) => path.startsWith(authPath))
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let result = await fetchApi<T>(path, options)

  if (result.response.status === 401 && canRefresh(path)) {
    try {
      await refreshAdminSession()
      result = await fetchApi<T>(path, options)
    } catch {
      dispatchUnauthorized()
      throw new ApiError(
        getErrorMessage(result.body as ApiErrorBody | null),
        result.response.status,
      )
    }
  }

  if (!result.response.ok) {
    if (result.response.status === 401) dispatchUnauthorized()
    throw new ApiError(
      getErrorMessage(result.body as ApiErrorBody | null),
      result.response.status,
    )
  }

  return result.body as T
}
