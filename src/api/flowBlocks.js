import request from '@/utils/request'
import { recordAudit } from '@/utils/auditLog'

/** 全局逻辑块列表；channel=web|android|ios 可选 */
export const listFlowBlockCatalog = (params = {}) =>
  request({ url: '/flow-blocks/catalog', method: 'get', params })

export const getFlowBlockCatalog = (blockId) =>
  request({
    url: `/flow-blocks/catalog/${encodeURIComponent(blockId)}`,
    method: 'get',
  })

export const putFlowBlockCatalog = async (blockId, data) => {
  const res = await request({
    url: `/flow-blocks/catalog/${encodeURIComponent(blockId)}`,
    method: 'put',
    data,
  })
  recordAudit('更新 FSM 逻辑块', blockId)
  return res
}

export const getAppFlowBlockOverrides = (appId) =>
  request({ url: `/flow-blocks/apps/${encodeURIComponent(appId)}/overrides`, method: 'get' })

export const putAppFlowBlockOverrides = async (appId, overrides) => {
  const res = await request({
    url: `/flow-blocks/apps/${encodeURIComponent(appId)}/overrides`,
    method: 'put',
    data: { overrides },
  })
  recordAudit('更新应用逻辑块覆盖', appId)
  return res
}
