const PLATFORM_LABEL = {
  Mobile: '移动端',
  Android: 'Android',
  iOS: 'iOS',
  Web: 'Web',
  Windows: 'Windows',
  Mac: 'Mac',
}

export function parseProjectList(res) {
  if (Array.isArray(res)) return res
  if (Array.isArray(res?.data)) return res.data
  if (Array.isArray(res?.data?.projects)) return res.data.projects
  return []
}

export function parseAppDetail(res) {
  if (res?.data && typeof res.data === 'object' && !Array.isArray(res.data)) return res.data
  if (res && typeof res === 'object' && res.id) return res
  return null
}

export function platformTags(platforms) {
  const raw = Array.isArray(platforms)
    ? platforms
    : String(platforms || '').split(',')
  const tags = raw.map((p) => String(p).trim()).filter(Boolean)
  if (tags.includes('Android') && tags.includes('iOS') && !tags.includes('Mobile')) {
    return ['移动端']
  }
  return tags.map((p) => PLATFORM_LABEL[p] || p)
}

export function envLabels(env) {
  if (!env || typeof env !== 'object') return []
  const rows = Array.isArray(env.environments) ? env.environments : []
  return rows.map((row) => row?.label || row?.key).filter(Boolean)
}

export function inventoryOf(projects) {
  const list = Array.isArray(projects) ? projects : []
  const apps = list.reduce((n, p) => n + (p.apps || []).length, 0)
  return { projects: list.length, apps }
}

export function creatorName(row) {
  return String(row?.created_by_name || '').trim() || '—'
}

export function caseCountOf(row) {
  if (row?.case_count != null) return Number(row.case_count) || 0
  const apps = Array.isArray(row?.apps) ? row.apps : []
  if (apps.length) {
    return apps.reduce((n, a) => n + (Number(a?.automation_stats?.case_count) || 0), 0)
  }
  return Number(row?.automation_stats?.case_count) || 0
}

export function knowledgeCountOf(row) {
  if (row?.knowledge_count != null) return Number(row.knowledge_count) || 0
  return Number(row?.automation_stats?.knowledge_count) || 0
}

export function appCountOf(row) {
  if (row?.app_count != null) return Number(row.app_count) || 0
  return Array.isArray(row?.apps) ? row.apps.length : 0
}

export function displayText(value) {
  const text = value == null ? '' : String(value).trim()
  return text || '—'
}
