import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { listProjects } from '@/api/project'
import { parseProjectList, platformTags } from '@/utils/catalog'

const STORAGE_KEY = 'mino.console.lastAppScope'

export function readStoredAppScope() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.appId || !parsed?.projectId) return null
    return { projectId: String(parsed.projectId), appId: String(parsed.appId) }
  } catch {
    return null
  }
}

export function storeAppScope(projectId, appId) {
  if (!projectId || !appId) return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      projectId: String(projectId),
      appId: String(appId),
    }))
  } catch {
    /* ignore */
  }
}

/** 从路由 params 解析当前项目 / 应用上下文（Catalog 应用壳专用）。 */
export function useCatalogAppContext() {
  const route = useRoute()
  const router = useRouter()
  const loading = ref(false)
  const project = ref(null)
  const app = ref(null)

  const projectId = computed(() => String(route.params.projectId || ''))
  const appId = computed(() => String(route.params.appId || ''))
  const projectName = computed(() => project.value?.name || '')
  const appName = computed(() => app.value?.name || '')
  const platforms = computed(() => platformTags(app.value?.platforms || ''))

  const refresh = async () => {
    const pid = projectId.value
    const aid = appId.value
    if (!pid || !aid) {
      project.value = null
      app.value = null
      return
    }
    loading.value = true
    try {
      const list = parseProjectList(await listProjects())
      const proj = list.find((p) => String(p.id) === pid) || null
      project.value = proj
      app.value = (proj?.apps || []).find((a) => String(a.id) === aid) || null
      if (app.value) storeAppScope(pid, aid)
    } catch {
      project.value = null
      app.value = null
    } finally {
      loading.value = false
    }
  }

  const goTab = (tab) => {
    const name = {
      overview: 'CatalogAppOverview',
      knowledge: 'CatalogAppKnowledge',
      docs: 'CatalogAppDocs',
      intel: 'CatalogAppIntel',
    }[tab]
    if (!name) return
    router.push({
      name,
      params: { projectId: projectId.value, appId: appId.value },
    })
  }

  const backToProject = () => {
    if (!projectId.value) return
    router.push({ name: 'CatalogProject', params: { projectId: projectId.value } })
  }

  watch([projectId, appId], () => {
    refresh()
  })

  onMounted(refresh)

  return {
    loading,
    project,
    app,
    projectId,
    appId,
    projectName,
    appName,
    platforms,
    refresh,
    goTab,
    backToProject,
  }
}
