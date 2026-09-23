import { createRouter, createWebHistory } from 'vue-router'
import { getAuthStatus, logoutAccount } from '@/api/auth'
import { readStoredAppScope } from '@/composables/useCatalogAppContext'
import { clearTitlebar } from '@/composables/useTitlebar'
import { clearRealtimeTokens } from '@/utils/realtime'
import { normalizeRole } from '@/utils/iam'
import Login from '../views/Login/index.vue'

const AdminLayout = () => import('../layouts/AdminLayout.vue')
const Dashboard = () => import('../views/Dashboard/index.vue')
const PermissionsPage = () => import('../views/Permissions/index.vue')
const AuditPage = () => import('../views/Audit/index.vue')
const RolesPage = () => import('../views/Settings/RolesPage.vue')
const SkillsPage = () => import('../views/Settings/SkillsPage.vue')
const JobsPage = () => import('../views/Settings/JobsPage.vue')
const KnowledgePage = () => import('../views/Knowledge/index.vue')
const DocLibraryPage = () => import('../views/DocLibrary/index.vue')
const AppIntelPage = () => import('../views/AppIntel/index.vue')
const SystemPage = () => import('../views/Settings/SystemPage.vue')
const AccountPoolTemplatesPage = () => import('../views/Settings/AccountPoolTemplatesPage.vue')
const CaseResourceKeyPage = () => import('../views/Settings/CaseResourceKeyPage.vue')
const ResourceTransitionRulesPage = () => import('../views/Settings/ResourceTransitionRulesPage.vue')
const NetworkPage = () => import('../views/Network/index.vue')
const LayerStack = () => import('../views/Settings/LayerStack.vue')
const CatalogPage = () => import('../views/Catalog/index.vue')
const CatalogProject = () => import('../views/Catalog/ProjectPage.vue')
const CatalogAppShell = () => import('../views/Catalog/AppShell.vue')
const CatalogAppOverview = () => import('../views/Catalog/AppOverview.vue')
const CatalogAppKnowledge = () => import('../views/Catalog/AppKnowledge.vue')
const CatalogAppDocs = () => import('../views/Catalog/AppDocs.vue')
const CatalogAppIntel = () => import('../views/Catalog/AppIntel.vue')
const NodesPage = () => import('../views/Catalog/NodesPage.vue')

const keepQuery = (path) => (to) => ({ path, query: to.query })

function redirectToCatalogAppTab(tab) {
  const s = readStoredAppScope()
  if (s) {
    const routes = {
      docs: 'docs',
      intel: 'intel',
      knowledge: 'knowledge',
      overview: '',
    }
    const suffix = routes[tab] ? `/${routes[tab]}` : ''
    return `/catalog/${s.projectId}/apps/${s.appId}${suffix}`
  }
  return '/catalog'
}

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
      {
        path: 'catalog/:projectId/apps/:appId',
        component: CatalogAppShell,
        meta: { title: '应用' },
        children: [
          { path: '', name: 'CatalogApp', redirect: { name: 'CatalogAppOverview' } },
          { path: 'overview', name: 'CatalogAppOverview', component: CatalogAppOverview, meta: { title: '应用' } },
          { path: 'knowledge', name: 'CatalogAppKnowledge', component: CatalogAppKnowledge, meta: { title: '应用 · 知识' } },
          { path: 'docs', name: 'CatalogAppDocs', component: CatalogAppDocs, meta: { title: '应用 · 文档' } },
          { path: 'intel', name: 'CatalogAppIntel', component: CatalogAppIntel, meta: { title: '应用 · 信息基座' } },
        ],
      },
      { path: 'nodes', name: 'Nodes', component: NodesPage, meta: { title: '节点与设备' } },
      {
        path: 'account-pool-templates',
        name: 'AccountPoolTemplates',
        component: AccountPoolTemplatesPage,
        meta: { title: '号池模板' },
      },
      {
        path: 'case-resource-key',
        name: 'CaseResourceKey',
        component: CaseResourceKeyPage,
        meta: { title: '用例密钥' },
      },
      {
        path: 'resource-transition-rules',
        name: 'ResourceTransitionRules',
        component: ResourceTransitionRulesPage,
        meta: { title: '转移规则' },
      },
      { path: 'permissions', name: 'Permissions', component: PermissionsPage, meta: { title: '权限配置' } },
      { path: 'access', redirect: { path: '/permissions', query: { tab: 'matrix' } } },
      { path: 'audit', name: 'Audit', component: AuditPage, meta: { title: '操作记录' } },
      { path: 'skills', name: 'Skills', component: SkillsPage, meta: { title: '技能' } },
      { path: 'jobs', name: 'Jobs', component: JobsPage, meta: { title: 'Jobs' } },
      {
        path: 'roles',
        name: 'Roles',
        component: RolesPage,
        meta: { title: '角色' },
        beforeEnter: (to) => {
          if (to.query.tab === 'skills') {
            return { path: '/skills', query: { skill: to.query.skill || to.query.role || undefined } }
          }
          return true
        },
      },
      { path: 'stack', name: 'Stack', component: LayerStack, meta: { title: '编排' } },
      { path: 'knowledge', name: 'Knowledge', component: KnowledgePage, meta: { title: '知识审核' } },
      { path: 'doc-library', name: 'DocLibrary', component: DocLibraryPage, meta: { title: '文档库' } },
      { path: 'app-intel', name: 'AppIntel', component: AppIntelPage, meta: { title: '信息基座' } },
      { path: 'health', name: 'Health', component: SystemPage, meta: { title: '运行状态' } },
      { path: 'system', redirect: '/health' },
      { path: 'network', name: 'Network', component: NetworkPage, meta: { title: '网络 / 内网域名' } },
      { path: 'scout', redirect: '/dashboard' },
      { path: 'settings', redirect: '/dashboard' },
      { path: 'settings/overview', redirect: '/dashboard' },
      { path: 'members', redirect: '/dashboard' },
      { path: 'settings/accounts', redirect: '/dashboard' },
      {
        path: 'settings/roles',
        redirect: (to) => (
          to.query.tab === 'skills'
            ? { path: '/skills', query: { skill: to.query.skill || to.query.role || undefined } }
            : { path: '/roles', query: { role: to.query.role || undefined } }
        ),
      },
      { path: 'settings/stack', redirect: '/stack' },
      { path: 'settings/skills', redirect: (to) => ({ path: '/skills', query: { skill: to.query.skill || undefined } }) },
      { path: 'settings/jobs', redirect: (to) => ({ path: '/jobs', query: { job: to.query.job || undefined } }) },
      { path: 'packs', redirect: '/dashboard' },
      { path: 'settings/packs', redirect: '/dashboard' },
      { path: 'settings/knowledge', redirect: '/knowledge' },
      { path: 'settings/doc-library', redirect: () => redirectToCatalogAppTab('docs') },
      { path: 'settings/app-intel', redirect: () => redirectToCatalogAppTab('intel') },
      { path: 'mail', redirect: '/dashboard' },
      { path: 'plugins', redirect: '/dashboard' },
      { path: 'plugins/:pluginId', redirect: '/dashboard' },
      { path: 'settings/keys', redirect: '/dashboard' },
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
