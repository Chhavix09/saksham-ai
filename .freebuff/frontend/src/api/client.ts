// API client: attaches the JWT, maps backend errors to friendly messages.
// Never expose raw backend errors to the user.

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function getToken(): string | null {
  return localStorage.getItem('saksham_token')
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem('saksham_token', token)
  else localStorage.removeItem('saksham_token')
}

function friendlyMessage(status: number, detail?: string): string {
  if (detail && typeof detail === 'string' && detail.length > 4) return detail
  switch (status) {
    case 400:
      return 'Please check the information you entered and try again.'
    case 401:
      return 'Please log in to continue.'
    case 403:
      return 'You do not have permission to do this.'
    case 404:
      return 'The requested item was not found. It may have been removed.'
    case 409:
      return 'This record already exists. Please check and try again.'
    case 422:
      return 'Please check the information you entered and try again.'
    case 429:
      return 'Too many attempts. Please wait a moment and try again.'
    default:
      return 'Something went wrong. Please try again in a moment.'
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers })
  } catch {
    throw new ApiError(0, 'Please check your internet connection and try again.')
  }

  if (response.status === 204) return undefined as T

  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    body = null
  }

  if (!response.ok) {
    const detail = (body as { detail?: unknown } | null)?.detail
    const message = friendlyMessage(response.status, typeof detail === 'string' ? detail : undefined)
    if (response.status === 401) {
      setToken(null)
      window.dispatchEvent(new CustomEvent('saksham:unauthorized'))
    }
    throw new ApiError(response.status, message)
  }
  return body as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}