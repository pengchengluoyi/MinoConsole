import request from '@/utils/request'
import { recordAudit } from '@/utils/auditLog'

export const getScreenKeyRefs = (appId) =>
  request({ url: `/nav-fsm/${encodeURIComponent(appId)}/screen-key-refs`, method: 'get' })

export const putScreenKeyRefs = async (appId, items) => {
  const res = await request({
    url: `/nav-fsm/${encodeURIComponent(appId)}/screen-key-refs`,
    method: 'put',
    data: { items },
  })
  recordAudit({ action: 'nav_screen_key_refs', target: appId })
  return res
}
