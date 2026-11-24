import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ApiError,
  apiRequest,
  getAdminAccessToken,
  localizeValidationMessage,
  refreshAdminSession,
  setAdminAccessToken,
} from '../src/lib/api-client.ts'

test('ApiError holds status and error message', () => {
  const err = new ApiError('Không tìm thấy tài nguyên', 404)
  assert.equal(err.name, 'ApiError')
  assert.equal(err.status, 404)
  assert.equal(err.message, 'Không tìm thấy tài nguyên')
})

test('apiRequest injects the in-memory Bearer token and includes cookies', async () => {
  const mockToken = 'test-mock-token-xyz'
  const originalFetch = globalThis.fetch

  let capturedHeaders: Headers | undefined
  let capturedCredentials: RequestCredentials | undefined

  setAdminAccessToken(mockToken)

  globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
    capturedHeaders = new Headers(init?.headers)
    capturedCredentials = init?.credentials
    return new Response(JSON.stringify({ success: true, data: { ok: true } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const res = await apiRequest<{ success: boolean; data: { ok: boolean } }>('/test-endpoint')
    assert.equal(res.success, true)
    assert.equal(capturedHeaders?.get('Authorization'), `Bearer ${mockToken}`)
    assert.equal(capturedCredentials, 'include')
  } finally {
    setAdminAccessToken(null)
    globalThis.fetch = originalFetch
  }
})

test('apiRequest sets Content-Type application/json when body is present', async () => {
  const originalFetch = globalThis.fetch
  let capturedHeaders: Headers | undefined

  globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
    capturedHeaders = new Headers(init?.headers)
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    await apiRequest('/test-post', {
      method: 'POST',
      body: JSON.stringify({ name: 'Hair' }),
    })
    assert.equal(capturedHeaders?.get('Content-Type'), 'application/json')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('apiRequest refreshes once and retries with the new token', async () => {
  const originalFetch = globalThis.fetch
  setAdminAccessToken('expired-token')
  const calls: Array<{ path: string; authorization: string | null }> = []

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input)
    calls.push({ path, authorization: new Headers(init?.headers).get('Authorization') })
    if (path.endsWith('/admin/auth/refresh')) {
      return new Response(JSON.stringify({ data: { accessToken: 'fresh-token', account: {} } }), { status: 200 })
    }
    if (calls.filter((call) => call.path.endsWith('/admin/services')).length === 1) {
      return new Response(JSON.stringify({ message: 'Token đã hết hạn' }), { status: 401 })
    }
    return new Response(JSON.stringify({ data: [] }), { status: 200 })
  }

  try {
    await apiRequest('/admin/services')
    assert.equal(calls.length, 3)
    assert.equal(calls[2].authorization, 'Bearer fresh-token')
    assert.equal(getAdminAccessToken(), 'fresh-token')
  } finally {
    setAdminAccessToken(null)
    globalThis.fetch = originalFetch
  }
})

test('concurrent refresh calls share one request', async () => {
  const originalFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => {
    calls++
    await new Promise((resolve) => setTimeout(resolve, 5))
    return new Response(JSON.stringify({ data: { accessToken: 'fresh-token', account: {} } }), { status: 200 })
  }

  try {
    await Promise.all([refreshAdminSession(), refreshAdminSession()])
    assert.equal(calls, 1)
  } finally {
    setAdminAccessToken(null)
    globalThis.fetch = originalFetch
  }
})

test('apiRequest clears the session when refresh fails', async () => {
  const originalFetch = globalThis.fetch

  let eventDispatched = false
  setAdminAccessToken('expired-token')

  const originalDispatch = globalThis.dispatchEvent
  globalThis.dispatchEvent = (event: Event) => {
    if (event.type === 'lambe:unauthorized') {
      eventDispatched = true
    }
    return true
  }

  globalThis.fetch = async () => {
    return new Response(JSON.stringify({ message: 'Token đã hết hạn' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    await assert.rejects(
      async () => {
        await apiRequest('/admin/services')
      },
      (err: Error) => {
        assert.equal((err as ApiError).status, 401)
        assert.equal(err.message, 'Token đã hết hạn')
        return true
      }
    )
    assert.equal(getAdminAccessToken(), null)
    assert.equal(eventDispatched, true)
  } finally {
    setAdminAccessToken(null)
    globalThis.fetch = originalFetch
    globalThis.dispatchEvent = originalDispatch
  }
})

test('localizeValidationMessage converts English class-validator messages to natural Vietnamese', () => {
  assert.equal(
    localizeValidationMessage('description must be shorter than or equal to 500 characters'),
    'Mô tả không được vượt quá 500 ký tự.'
  )
  assert.equal(
    localizeValidationMessage('name must be longer than or equal to 2 characters'),
    'Tên phải có ít nhất 2 ký tự.'
  )
  assert.equal(
    localizeValidationMessage('name should not be empty'),
    'Tên không được để trống.'
  )
  assert.equal(
    localizeValidationMessage('sortOrder must be an integer number'),
    'Thứ tự sắp xếp phải là số nguyên.'
  )
  assert.equal(
    localizeValidationMessage('sortOrder must not be less than 0'),
    'Thứ tự sắp xếp không được nhỏ hơn 0.'
  )
  assert.equal(
    localizeValidationMessage('categoryId must be a UUID'),
    'Danh mục phải là mã định danh (UUID) hợp lệ.'
  )
})
