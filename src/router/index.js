import { createRouter, createWebHistory } from 'vue-router'
import { getAuthStatus, logoutAccount } from '@/api/auth'
import { clearTitlebar } from '@/composables/useTitlebar'
import { clearRealtimeTokens } from '@/utils/realtime'
import { normalizeRole } from '@/utils/iam'
import Login from '../views/Login/index.vue'

const AdminLayout = () => import('../layouts/AdminLayout.vue')
const Dashboard = () => import('../views/Dashboard/index.vue')
const AccountsPage = () => import('../views/Settings/AccountsPage.vue')
const PermissionsPage = () => import('../views/Permissions/index.vue')
const AuditPage = () => import('../views/Audit/index.vue')
const RolesPage = () => import('../views/Settings/RolesPage.vue')
const PacksPage = () => import('../views/Settings/PacksPage.vue')
const KeysPage = () => import('../views/Settings/KeysPage.vue')
const SystemPage = () => import('../views/Settings/SystemPage.vue')
const NetworkPage = () => import('../views/Network/index.vue')
const LayerStack = () => import('../views/Settings/LayerStack.vue')
const CatalogPage = () => import('../views/Catalog/index.vue')
const CatalogProject = () => import('../views/Catalog/ProjectPage.vue')
const CatalogApp = () => import('../views/Catalog/AppPage.vue')
const NodesPage = () => import('../views/Catalog/NodesPage.vue')
const PluginsPage = () => import('../views/Settings/PluginsPage.vue')
const PluginDetail = () => import('../views/Settings/PluginDetailPage.vue')

const keepQuery = (path) => (to) => ({ path, query: to.query })

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: { requiresGuest: true },
  },
  {
    path: '/',
    component: AdminLayout,
    meta: { requiresAuth: true },
    redirect: '/dashboard',
    children: [
      { path: 'dashboard', name: 'Dashboard', component: Dashboard, meta: { title: '工作台' } },
      { path: 'catalog', name: 'Catalog', component: CatalogPage, meta: { title: '项目与应用' } },
      { path: 'catalog/:projectId', name: 'CatalogProject', component: CatalogProject, meta: { title: '项目' } },
      { path: 'catalog/:projectId/apps/:appId', name: 'CatalogApp', component: CatalogApp, meta: { title: '应用' } },
      { path: 'nodes', name: 'Nodes', component: NodesPage, meta: { title: '节点与设备' } },
      { path: 'members', name: 'Members', component: AccountsPage, meta: { title: '成员' } },
      { path: 'permissions', name: 'Permissions', component: PermissionsPage, meta: { title: '权限配置' } },
      { path: 'access', redirect: { path: '/permissions', query: { tab: 'matrix' } } },
      { path: 'audit', name: 'Audit', component: AuditPage, meta: { title: '操作记录' } },
      { path: 'roles', name: 'Roles', component: RolesPage, meta: { title: '产品角色' } },
      { path: 'stack', name: 'Stack', component: LayerStack, meta: { title: '编排' } },
      { path: 'packs', name: 'Packs', component: PacksPage, meta: { title: '扩展包' } },
      { path: 'mail', name: 'Mail', component: KeysPage, meta: { title: '发信' } },
      { path: 'plugins', name: 'Plugins', component: PluginsPage, meta: { title: '插件策略' } },
      { path: 'plugins/:pluginId', name: 'PluginDetail', component: PluginDetail, meta: { title: '插件策略' } },
      { path: 'health', name: 'Health', component: SystemPage, meta: { title: '运行状态' } },
      { path: 'system', redirect: '/health' },
      { path: 'network', name: 'Network', component: NetworkPage, meta: { title: '网络 / 内网域名' } },
      { path: 'scout', redirect: '/dashboard' },
      { path: 'settings', redirect: '/dashboard' },
      { path: 'settings/overview', redirect: '/dashboard' },
      { path: 'settings/accounts', redirect: '/members' },
      { path: 'settings/roles', redirect: keepQuery('/roles') },
      { path: 'settings/stack', redirect: '/stack' },
      { path: 'settings/skills', redirect: { path: '/roles', query: { tab: 'skills' } } },
      { path: 'settings/packs', redirect: keepQuery('/packs') },
      { path: 'settings/keys', redirect: '/mail' },
      { path: 'settings/system', redirect: '/health' },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/dashboard',
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

const AUTH_CHECK_MS = 8000

function withTimeout(promise, ms = AUTH_CHECK_MS) {
  let timer
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('auth-timeout')), ms)
    }),
  ])
}

router.beforeEach(async (to, from, next) => {
  if (to.fullPath !== from.fullPath) clearTitlebar()
  const loggedInTitle = to.meta.title ? `Mino Console · ${to.meta.title}` : 'Mino Console'
  document.title = to.matched.some((r) => r.meta.requiresGuest) ? '登录 · Mino Console' : loggedInTitle
  const needsAuth = to.matched.some((r) => r.meta.requiresAuth)
  const isGuest = to.matched.some((r) => r.meta.requiresGuest)
  if (isGuest || !needsAuth) return next()
  const hasToken = typeof localStorage !== 'undefined' && !!localStorage.getItem('token')
  try {
    const auth = await withTimeout(getAuthStatus(), 8000)
    const data = auth?.data || {}
    const loggedIn = !!data.logged_in
    if (!loggedIn) return next('/login')
    if (normalizeRole(data.role) !== 'admin') {
      clearRealtimeTokens()
      try { await logoutAccount() } catch { /* ignore */ }
      return next('/login')
    }
    next()
  } catch (e) {
    const detail = e?.response?.data?.detail || e?.message || ''
    if (e?.response?.status === 403 || String(detail).includes('仅管理员')) {
      clearRealtimeTokens()
      return next('/login')
    }
    if (hasToken) return next()
    return next('/login')
  }
})

export default router
