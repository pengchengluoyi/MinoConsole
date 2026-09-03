import request from '@/utils/request'
import { nexusOrigin, usesWebProxy } from '@/utils/config'

export const getMeBootstrap = () =>
  request({ url: '/me/bootstrap', method: 'get' })

export const getStudioNav = () =>
  request({ url: '/me/studio-nav', method: 'get' })

export const saveStudioNav = (allowed) =>
  request({ url: '/me/studio-nav', method: 'put', data: { allowed } })

export const getServerInfoHttp = () =>
  request({ url: '/sys/server_info', method: 'get' })

export const getHealthHttp = async () => {
  const path = usesWebProxy() ? '/health' : `${nexusOrigin()}/health`
  const response = await fetch(path, { headers: { Accept: 'application/json' } })
  if (!response.ok) {
    const err = new Error(`HTTP ${response.status}`)
    err.response = { status: response.status }
    throw err
  }
  return response.json()
}
