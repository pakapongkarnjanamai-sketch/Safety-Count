function normalizeBaseUrl(value) {
  const trimmed = String(value || '').trim()
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`
}

function isRelativeBaseUrl(value) {
  return value.startsWith('/')
}

function shouldUseLocalhostFallback() {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname.toLowerCase()
  return host === 'localhost' || host === '127.0.0.1'
}

function resolveApiBaseUrl() {
  const configured = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL ?? '/api/')

  if (isRelativeBaseUrl(configured) && shouldUseLocalhostFallback()) {
    return 'http://localhost:5028/api/'
  }

  return configured
}

export const appConfig = {
  apiBaseUrl: resolveApiBaseUrl(),
}
