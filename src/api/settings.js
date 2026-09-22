import request from '@/utils/request'
import { recordAudit } from '@/utils/auditLog'

export const getCaseResourceKeyCatalog = () =>
  request({ url: '/settings/case-resource-key', method: 'get' })

export const getResourceTransitionRules = () =>
  request({ url: '/settings/resource-transition-rules', method: 'get' })

export const patchResourceTransitionRule = (ruleId, data) =>
  request({ url: `/settings/resource-transition-rules/${encodeURIComponent(ruleId)}`, method: 'patch', data })

export const getAccountPoolTemplates = () =>
  request({ url: '/settings/account-pool-templates', method: 'get' })

export const saveAccountPoolTemplates = (payload) => {
  const body = Array.isArray(payload)
    ? { templates: payload, extension_addons: {} }
    : payload
  return request({ url: '/settings/account-pool-templates', method: 'put', data: body })
}

export const saveAccountPoolCustomTemplate = (templateId, template) =>
  request({
    url: `/settings/account-pool-templates/custom/${encodeURIComponent(templateId)}`,
    method: 'put',
    data: { template },
  })

export const saveAccountPoolBuiltinFields = (templateId, fields) =>
  request({
    url: `/settings/account-pool-templates/builtin/${encodeURIComponent(templateId)}/fields`,
    method: 'put',
    data: { fields },
  })

export const deleteAccountPoolCustomTemplate = (templateId) =>
  request({
    url: `/settings/account-pool-templates/custom/${encodeURIComponent(templateId)}`,
    method: 'delete',
  })

export const listFeishuBots = () =>
  request({ url: '/settings/feishu/bots', method: 'get' })

export const createFeishuBot = (data) =>
  request({ url: '/settings/feishu/bots', method: 'post', data })

export const updateFeishuBot = (botId, data) =>
  request({ url: `/settings/feishu/bots/${botId}`, method: 'put', data })

export const deleteFeishuBot = (botId) =>
  request({ url: `/settings/feishu/bots/${botId}`, method: 'delete' })

export const listRobotIntegrations = () =>
  request({ url: '/settings/robots/bots', method: 'get' })

export const createRobotIntegration = (data) =>
  request({ url: '/settings/robots/bots', method: 'post', data })

export const updateRobotIntegration = (botId, data) =>
  request({ url: `/settings/robots/bots/${botId}`, method: 'put', data })

export const deleteRobotIntegration = (botId) =>
  request({ url: `/settings/robots/bots/${botId}`, method: 'delete' })

/** @deprecated 兼容旧接口 */
export const getFeishuBotSettings = () =>
  request({ url: '/settings/feishu', method: 'get' })

export const getTestingKnowledge = (appId = '') =>
  request({ url: '/settings/knowledge', method: 'get', params: appId ? { app_id: appId } : {} })

export const saveTestingKnowledge = (items) =>
  request({ url: '/settings/knowledge', method: 'put', data: { items } })

export const upsertKnowledgeItem = (item) => {
  const id = item.id || ''
  return request({ url: `/settings/knowledge/${id || 'new'}`, method: 'put', data: item })
}

export const deleteKnowledgeItem = (id) =>
  request({ url: `/settings/knowledge/${encodeURIComponent(id)}`, method: 'delete' })

export const reviewKnowledgeItem = (id, data) =>
  request({ url: `/settings/knowledge/${encodeURIComponent(id)}/review`, method: 'post', data })

export const autoReviewKnowledge = (appId = '') =>
  request({ url: '/settings/knowledge/auto-review', method: 'post', data: { app_id: appId || '' }, timeout: 180000 })

export const getKnowledgeJobSettings = () =>
  request({ url: '/settings/knowledge/jobs', method: 'get' })

export const saveKnowledgeJobSettings = (data) =>
  request({ url: '/settings/knowledge/jobs', method: 'put', data })

export const analyzeFailureKnowledge = (data) =>
  request({ url: '/settings/knowledge/analyze-failure', method: 'post', data })

export const appendAppKnowledge = (appId, item) =>
  request({ url: '/settings/knowledge/append', method: 'post', data: { app_id: appId, item } })

export const listAppKnowledge = (appId) =>
  request({ url: `/settings/knowledge/app/${appId}`, method: 'get' })

export const listDocs = (appId, projectId = '') =>
  request({
    url: '/settings/docs',
    method: 'get',
    params: { app_id: appId, ...(projectId ? { project_id: projectId } : {}) },
  })

export const searchDocs = (q, appId, limit = 20, vector = false) =>
  request({
    url: '/settings/docs/search',
    method: 'get',
    params: { q, app_id: appId, limit, ...(vector ? { vector: 1 } : {}) },
  })

export const patchDocSync = (sourceId, data) =>
  request({
    url: `/settings/docs/${encodeURIComponent(sourceId)}/sync`,
    method: 'patch',
    data,
  })

export const syncDocNow = (sourceId) =>
  request({
    url: `/settings/docs/${encodeURIComponent(sourceId)}/sync-now`,
    method: 'post',
    timeout: 120000,
  })

export const getDoc = (sourceId) =>
  request({ url: `/settings/docs/${encodeURIComponent(sourceId)}`, method: 'get' })

export const getDocChunks = (sourceId, offset = 0, limit = 50) =>
  request({
    url: `/settings/docs/${encodeURIComponent(sourceId)}/chunks`,
    method: 'get',
    params: { offset, limit },
  })

export const deleteDoc = (sourceId) =>
  request({ url: `/settings/docs/${encodeURIComponent(sourceId)}`, method: 'delete' })

export const syncFeishuDoc = (data) =>
  request({ url: '/settings/docs/sync-feishu', method: 'post', data, timeout: 120000 })

export const extractDocKnowledge = (sourceId, params = {}) =>
  request({
    url: `/settings/docs/${encodeURIComponent(sourceId)}/extract`,
    method: 'post',
    params,
    timeout: 180000,
  })

export const uploadDoc = ({ file, appId, projectId = '', title = '' }) => {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('app_id', appId)
  if (projectId) fd.append('project_id', projectId)
  if (title) fd.append('title', title)
  return request({
    url: '/settings/docs/upload',
    method: 'post',
    data: fd,
    timeout: 120000,
  })
}

export const getFigmaSettings = () =>
  request({ url: '/settings/figma', method: 'get' })

export const saveFigmaSettings = (data) =>
  request({ url: '/settings/figma', method: 'put', data })

export const testFigmaToken = (accessToken = '') =>
  request({ url: '/settings/figma/test', method: 'post', data: { access_token: accessToken } })

export const getMailSettings = () =>
  request({ url: '/settings/mail', method: 'get' })

export const saveMailSettings = async (data) => {
  const res = await request({ url: '/settings/mail', method: 'put', data })
  recordAudit('保存发信', data?.host || data?.from_email || '')
  return res
}

export const testMailSettings = (to = '') =>
  request({ url: '/settings/mail/test', method: 'post', data: { to }, timeout: 25000 })

export const listPlugins = () =>
  request({ url: '/settings/plugins', method: 'get' })

export const getPlugin = (pluginId) =>
  request({ url: `/settings/plugins/${pluginId}`, method: 'get' })

export const savePlugin = (pluginId, data) =>
  request({ url: `/settings/plugins/${pluginId}`, method: 'put', data })

export const chatPlugin = (pluginId, data) =>
  request({ url: `/settings/plugins/${pluginId}/chat`, method: 'post', data, timeout: 120000 })

export const syncFeishuListener = () =>
  request({ url: '/settings/plugins/feishu/listener/sync', method: 'post', timeout: 20000 })

export const startWechatLogin = () =>
  request({ url: '/settings/plugins/wechat/login', method: 'post', timeout: 30000 })

export const getWechatLogin = () =>
  request({ url: '/settings/plugins/wechat/login', method: 'get', timeout: 20000 })

export const verifyWechatLogin = (verifyCode) =>
  request({ url: '/settings/plugins/wechat/login/verify', method: 'post', data: { verify_code: verifyCode }, timeout: 20000 })

export const logoutWechat = () =>
  request({ url: '/settings/plugins/wechat/logout', method: 'post', timeout: 20000 })

export const syncWechatListener = () =>
  request({ url: '/settings/plugins/wechat/listener/sync', method: 'post', timeout: 20000 })

export const debugFeishuWiki = (data) =>
  request({ url: '/settings/plugins/feishu/wiki/debug', method: 'post', data, timeout: 30000 })

export const testZentaoPlugin = (data = {}) =>
  request({ url: '/settings/plugins/zentao/test', method: 'post', data, timeout: 20000 })

export const fetchZentaoToken = (data = {}) =>
  request({ url: '/settings/plugins/zentao/token', method: 'post', data, timeout: 20000 })

export const testZentaoBug = (data = {}) =>
  request({ url: '/settings/plugins/zentao/bugs/test', method: 'post', data, timeout: 20000 })

export const getSkillsCatalog = () =>
  request({ url: '/settings/skills', method: 'get' })

export const listAIProviders = () =>
  request({ url: '/settings/ai/providers', method: 'get' })

export const saveAIProvider = (providerId, data) =>
  request({ url: `/settings/ai/providers/${providerId}`, method: 'put', data })

export const deleteAIProvider = (providerId) =>
  request({ url: `/settings/ai/providers/${providerId}`, method: 'delete' })

export const saveAIUsage = (data) =>
  request({ url: '/settings/ai/usage', method: 'put', data })

export const getAIPlanPrompt = () =>
  request({ url: '/settings/ai/plan-prompt', method: 'get' })

export const listAIRoles = () =>
  request({ url: '/settings/ai/roles', method: 'get' })

export const getLayerStack = () =>
  request({ url: '/settings/ai/stack', method: 'get' })

export const saveLayerStack = async (data) => {
  const res = await request({ url: '/settings/ai/stack', method: 'put', data })
  recordAudit(data?.reset ? '恢复默认编排' : '保存编排', '')
  return res
}

export const chatAIRole = (data) =>
  request({ url: '/settings/ai/roles/chat', method: 'post', data, timeout: 120000 })

export const saveRolePrompt = (roleId, data) =>
  request({ url: `/settings/ai/roles/${roleId}/prompt`, method: 'put', data })

export const listAISkills = () =>
  request({ url: '/settings/ai/skills', method: 'get' })

export const getAISkill = (skillId) =>
  request({ url: `/settings/ai/skills/${skillId}`, method: 'get' })

export const createAISkill = (data) =>
  request({ url: '/settings/ai/skills', method: 'post', data })

export const saveAISkill = (skillId, data) =>
  request({ url: `/settings/ai/skills/${skillId}`, method: 'put', data })

export const listAIJobs = () =>
  request({ url: '/settings/ai/jobs', method: 'get' })

export const getAIJob = (jobId) =>
  request({ url: `/settings/ai/jobs/${jobId}`, method: 'get' })

export const getAIJobsHealth = () =>
  request({ url: '/settings/ai/jobs/health', method: 'get' })

export const saveAIJob = async (jobId, data) => {
  const res = await request({ url: `/settings/ai/jobs/${jobId}`, method: 'put', data })
  recordAudit(data?.reset ? '恢复默认 Job' : '保存 Job', jobId)
  return res
}

export const previewAIJob = (jobId, data = {}) =>
  request({ url: `/settings/ai/jobs/${jobId}/preview`, method: 'post', data, timeout: 60000 })

export const listDispatchCalls = (params = {}) =>
  request({ url: '/settings/dispatch', method: 'get', params })

export const getDispatchCall = (id) =>
  request({ url: `/settings/dispatch/${id}`, method: 'get' })

/** 系统设置 - ClawNode 日志存储目录 */
export const getClawnodeLogsDir = () =>
  request({ url: '/settings/system/clawnode/logs-dir', method: 'get' })

export const saveClawnodeLogsDir = (path) =>
  request({ url: '/settings/system/clawnode/logs-dir', method: 'put', data: { path } })
