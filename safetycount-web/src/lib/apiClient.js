import { appConfig } from './appConfig'

function buildApiUrl(path) {
  const value = String(path || '')

  if (/^https?:\/\//i.test(value)) {
    return value
  }

  const endpoint = value.replace(/^\/api\/?/i, '').replace(/^\/+/, '')

  if (appConfig.apiBaseUrl.startsWith('/')) {
    return `${appConfig.apiBaseUrl}${endpoint}`
  }

  return new URL(endpoint, appConfig.apiBaseUrl).toString()
}

export function apiFetch(path, init = {}) {
  return fetch(buildApiUrl(path), {
    ...init,
    credentials: 'include',
  })
}

export { buildApiUrl }
