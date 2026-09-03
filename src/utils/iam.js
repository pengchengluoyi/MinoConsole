/** 账号角色（登录身份）。与产品角色（AI catalog）不是同一套。 */

export const ACCOUNT_ROLES = [
  { id: 'admin', label: '管理员' },
  { id: 'user', label: '用户' },
]

const ROLE_ALIASES = {
  platform_admin: 'admin',
  org_admin: 'admin',
  qa_lead: 'user',
  operator: 'user',
  viewer: 'user',
}

export const normalizeRole = (id) => {
  const raw = String(id || '').trim()
  const mapped = ROLE_ALIASES[raw] || raw
  return ACCOUNT_ROLES.some((row) => row.id === mapped) ? mapped : (raw || '—')
}

export const roleLabel = (id) => {
  const norm = normalizeRole(id)
  return ACCOUNT_ROLES.find((row) => row.id === norm)?.label || norm || '—'
}

export const CONSOLE_FEATURES = [
  { id: 'catalog', label: '项目与应用' },
  { id: 'nodes', label: '节点与设备' },
  { id: 'members', label: '成员' },
  { id: 'access', label: '权限配置' },
  { id: 'roles', label: '产品角色' },
  { id: 'packs', label: '扩展包' },
  { id: 'mail', label: '发信' },
  { id: 'system', label: '系统参数' },
]

export const STUDIO_FEATURES = [
  { id: 'projects', label: '项目 / 用例' },
  { id: 'keys', label: '模型密钥' },
  { id: 'plugins', label: '插件凭证' },
  { id: 'scout_install', label: 'Scout 安装 / 启动' },
  { id: 'runs', label: '执行 / HITL' },
]

/** yes | no | read — 用户不能登录 Console */
export const RBAC_MATRIX = {
  admin: {
    console: {
      catalog: 'read', nodes: 'read', members: 'yes', access: 'yes', roles: 'yes', packs: 'yes',
      mail: 'yes', system: 'yes',
    },
    studio: {
      projects: 'yes', keys: 'yes', plugins: 'yes', scout_install: 'yes', runs: 'yes',
    },
  },
  user: {
    console: {
      catalog: 'no', nodes: 'no', members: 'no', access: 'no', roles: 'no', packs: 'no',
      mail: 'no', system: 'no',
    },
    studio: {
      projects: 'yes', keys: 'yes', plugins: 'yes', scout_install: 'yes', runs: 'yes',
    },
  },
}

export const cellLabel = (value) => {
  if (value === 'yes') return '可写'
  if (value === 'read') return '只读'
  return '—'
}
