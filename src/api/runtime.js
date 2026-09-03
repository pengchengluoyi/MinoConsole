import request from '@/utils/request'

const pickData = (res) => res?.data || res || {}

export const listRuntimeNodes = () =>
  request({ url: '/runtime/nodes', method: 'get' })

export const parseRuntimeNodes = (res) => {
  const data = pickData(res)
  if (Array.isArray(data)) return data
  if (Array.isArray(data.nodes)) return data.nodes
  if (Array.isArray(data.items)) return data.items
  if (Array.isArray(data.executors)) return data.executors
  return []
}

export const listRuntimeAssets = () =>
  request({ url: '/runtime/assets', method: 'get' })

export const parseRuntimeAssets = (res) => {
  const data = pickData(res)
  return {
    scout_count: Number(data.scout_count || 0),
    studio_count: Number(data.studio_count || 0),
    device_count: Number(data.device_count || 0),
    scouts: Array.isArray(data.scouts) ? data.scouts : [],
    studios: Array.isArray(data.studios) ? data.studios : [],
  }
}
