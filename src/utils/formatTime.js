import { formatRelativeTime } from '@/utils/relativeTime'

export const formatCreatedAt = (value) => {
  if (value == null || value === '') return '—'
  const n = Number(value)
  const date = Number.isFinite(n) && n > 0
    ? new Date(n < 1e12 ? n * 1000 : n)
    : new Date(String(value).replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('zh-CN', { hour12: false })
}

export const formatCreatedRelative = (value) => {
  if (value == null || value === '') return '—'
  const n = Number(value)
  const date = Number.isFinite(n) && n > 0
    ? new Date(n < 1e12 ? n * 1000 : n)
    : new Date(String(value).replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return '—'
  return formatRelativeTime(date)
}
