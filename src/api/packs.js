import request from '@/utils/request'
import { recordAudit } from '@/utils/auditLog'

// Tab 分类由 GET /packs/kinds 下发。创建 / 改规则 / 上下线取决于服务端是否开放可写根与写入接口。

/** Tab 元数据：中文名、条目数、是否已就绪。不要在页面写死分类。 */
export const listPackKinds = () =>
  request({ url: '/packs/kinds', method: 'get' })

/**
 * 条目列表
 * @param {object} params { kind, q, provider, lifecycle, root, app_id, fixture }
 *   fixture=1 时返回样例数据，前端可在后端未就绪 / 无设备时开发
 */
export const listPacks = (params = {}) =>
  request({ url: '/packs', method: 'get', params })

/** 条目详情（含原始 YAML）。uid 形如 builtin/recovery/screen_asleep_or_locked */
const packPath = (uid) => String(uid || '').split('/').filter(Boolean).map(encodeURIComponent).join('/')

export const getPack = (uid, params = {}) =>
  request({ url: `/packs/${packPath(uid)}`, method: 'get', params })

/** 加载健康度：坏条目清单，供顶部红条 */
export const getPacksHealth = () =>
  request({ url: '/packs/health', method: 'get' })

/** 改完 YAML 立即重载（不必重启服务） */
export const reloadPacks = () =>
  request({ url: '/packs/reload', method: 'post' })

/** 启停 / 改生命周期：{ lifecycle?: 'draft'|'review'|'active'|'deprecated', enabled?: boolean } */
export const setPackLifecycle = async (uid, data) => {
  const res = await request({ url: `/packs/${packPath(uid)}/lifecycle`, method: 'post', data })
  recordAudit('更改扩展包状态', uid)
  return res
}

/** 保存整份 YAML（校验不过后端会 400，不落盘） */
export const savePackYaml = async (uid, rawYaml) => {
  const res = await request({ url: `/packs/${packPath(uid)}`, method: 'put', data: { raw_yaml: rawYaml } })
  recordAudit('保存扩展包 YAML', uid)
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

/** 四个根的说明与条目数（新建时选落哪个根） */
export const listPackRoots = (params = {}) =>
  request({ url: '/packs/roots', method: 'get', params })

/**
 * 新建条目
 * @param {object} data { kind, root, app_id?, pack_id?, id, owner?, raw_yaml?, overwrite? }
 *   raw_yaml 留空则后端按 kind 生成最小骨架（默认 lifecycle: draft）
 */
export const createPack = async (data) => {
  const res = await request({ url: '/packs/create', method: 'post', data })
  recordAudit('新建扩展包', data?.id || '')
  return res
}
