const KEY = 'mino.console.audit'
const MAX = 200

const read = () => {
  try {
    const raw = sessionStorage.getItem(KEY)
    const rows = raw ? JSON.parse(raw) : []
    return Array.isArray(rows) ? rows : []
  } catch {
    return []
  }
}

const write = (rows) => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(rows.slice(0, MAX)))
  } catch { /* quota / private mode */ }
}

/** 只记本浏览器本次会话里真实发生的管理操作，不编造历史。 */
export const recordAudit = (action, detail = '') => {
  const row = {
    t: Date.now(),
    action: String(action || '').trim() || '操作',
    detail: String(detail || '').trim(),
  }
  write([row, ...read()])
  return row
}

export const listAudit = () => read()

export const clearAudit = () => write([])
