export const PLUGIN_CATEGORIES = [
  { id: 'all', label: '全部', desc: '所有外部系统' },
  { id: 'docs', label: '文档', desc: 'Wiki 副本' },
  { id: 'im', label: 'IM', desc: '群通知、对话与提缺陷' },
  { id: 'defect', label: '缺陷', desc: '禅道等缺陷库' },
  { id: 'design', label: '设计', desc: '设计稿学习' },
]

export function normalizePluginCat(cat) {
  const id = String(cat || 'all')
  return PLUGIN_CATEGORIES.some((c) => c.id === id) ? id : 'all'
}

export function pluginCategories(plugin) {
  const list = plugin?.categories
  if (Array.isArray(list) && list.length) return list
  return plugin?.kind ? [plugin.kind] : []
}

export function pluginInCategory(plugin, cat) {
  const id = normalizePluginCat(cat)
  if (id === 'all') return true
  return pluginCategories(plugin).includes(id)
}

export function categoryLabel(id) {
  return PLUGIN_CATEGORIES.find((c) => c.id === id)?.label || id
}

export function statusLabel(row) {
  if (row?.status === 'ready') return '已连接'
  if (row?.status === 'off') return '已关闭'
  return '待连接'
}

export function statusType(row) {
  if (row?.status === 'ready') return 'success'
  if (row?.status === 'off') return 'info'
  return 'warning'
}
