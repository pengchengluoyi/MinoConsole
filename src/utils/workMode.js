const KEY_SETTINGS = 'mino.work.lastSettings'

export function rememberSettingsPath(fullPath) {
  if (fullPath && String(fullPath).startsWith('/')) sessionStorage.setItem(KEY_SETTINGS, fullPath)
}

export function lastSettingsPath() {
  return sessionStorage.getItem(KEY_SETTINGS) || ''
}

export function returnFromSettingsPath() {
  return lastSettingsPath() || '/dashboard'
}

export function lastAgentPath() {
  return '/dashboard'
}
