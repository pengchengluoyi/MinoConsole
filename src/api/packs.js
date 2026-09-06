import request from '@/utils/request'
import { recordAudit } from '@/utils/auditLog'

// Tab 分类由 GET /packs/kinds 下发。创建 / 改规则 / 上下线取决于服务端是否开放可写根与写入接口。

/** Tab 元数据：中文名、条目数、是否已就绪。不要在页面写死分类。 */
export const listPackKinds = () =>
  request({ url: '/packs/kinds', method: 'get' })

/**
 * 条目列表
 * @param {object} params { kind, q, lifecycle, platform, category }
 */
export const listPacks = (params = {}) =>
  request({ url: '/packs', method: 'get', params })

/** 条目详情。uid 形如 builtin/recovery/screen_asleep_or_locked */
const packPath = (uid) => String(uid || '').split('/').filter(Boolean).map(encodeURIComponent).join('/')

export const getPack = (uid, params = {}) =>
  request({ url: `/packs/${packPath(uid)}`, method: 'get', params })

/** 加载健康度：坏条目清单，供顶部红条 */
export const getPacksHealth = () =>
  request({ url: '/packs/health', method: 'get' })

/** 重载 catalog_entries 到内存 */
export const reloadPacks = () =>
  request({ url: '/packs/reload', method: 'post' })

/** 整条覆盖保存。body 含 display_name / description / platforms / payload 等 */
export const updatePack = async (uid, data) => {
  const res = await request({ url: `/packs/${packPath(uid)}`, method: 'put', data })
  recordAudit('更新扩展包', uid)
  return res
}

/** 启停：{ status?: 'pending'|'active'|'deprecated' } */
export const setPackLifecycle = async (uid, data) => {
  const res = await request({ url: `/packs/${packPath(uid)}/lifecycle`, method: 'post', data })
  recordAudit('更改扩展包状态', uid)
  return res
}


/**
 * 单条预演。控制台永远 execute=0，不连设备。
 * @param {string} uid
 * @param {object} params { source='catalog', package, app_id }
 */
export const dryRunPack = (uid, params = {}) => {
  const { execute: _ignored, ...rest } = params || {}
  return request({
    url: `/packs/${packPath(uid)}/dry-run`,
    method: 'post',
    params: { source: rest.source || 'catalog', ...rest, execute: 0 },
  })
}

/**
 * 新建条目
 * @param {object} data { kind, pack_id?, id }
 */
export const createPack = async (data) => {
  const res = await request({ url: '/packs/create', method: 'post', data })
  recordAudit('新建扩展包', data?.id || '')
  return res
}
