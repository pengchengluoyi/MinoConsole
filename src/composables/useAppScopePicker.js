import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { listProjects } from '@/api/project'
import { parseProjectList } from '@/utils/catalog'
import { readStoredAppScope, storeAppScope } from '@/composables/useCatalogAppContext'

/** 全局页（跨应用）用的项目→应用选择器状态。 */
export function useAppScopePicker() {
  const route = useRoute()
  const router = useRouter()
  const loading = ref(false)
  const projects = ref([])
  const projectId = ref('')
  const appId = ref('')

  const apps = computed(() => {
    const p = projects.value.find((x) => String(x.id) === projectId.value)
    return p?.apps || []
  })

  const selectedApp = computed(() =>
    apps.value.find((a) => String(a.id) === appId.value) || null,
  )

  const cascaderOptions = computed(() =>
    projects.value.map((p) => ({
      value: String(p.id),
      label: p.name || p.id,
      children: (p.apps || []).map((a) => ({
        value: String(a.id),
        label: a.name || a.id,
      })),
    })),
  )

  const cascaderValue = computed({
    get() {
      if (!projectId.value || !appId.value) return []
      return [projectId.value, appId.value]
    },
    set(val) {
      const arr = Array.isArray(val) ? val : []
      projectId.value = String(arr[0] || '')
      appId.value = String(arr[1] || '')
    },
  })

  const loadProjects = async () => {
    loading.value = true
    try {
      projects.value = parseProjectList(await listProjects())
    } catch {
      projects.value = []
    } finally {
      loading.value = false
    }
  }

  const initFromRoute = () => {
    const qPid = String(route.query.projectId || '')
    const qAid = String(route.query.appId || '')
    if (qPid && qAid) {
      projectId.value = qPid
      appId.value = qAid
      storeAppScope(qPid, qAid)
      return
    }
    const stored = readStoredAppScope()
    if (stored) {
      projectId.value = stored.projectId
      appId.value = stored.appId
      return
    }
    const first = projects.value[0]
    const firstApp = first?.apps?.[0]
    if (first && firstApp) {
      projectId.value = String(first.id)
      appId.value = String(firstApp.id)
    }
  }

  const openInCatalog = (tab = 'overview') => {
    if (!projectId.value || !appId.value) return
    const names = {
      overview: 'CatalogAppOverview',
      knowledge: 'CatalogAppKnowledge',
      docs: 'CatalogAppDocs',
      intel: 'CatalogAppIntel',
    }
    router.push({
      name: names[tab] || 'CatalogAppOverview',
      params: { projectId: projectId.value, appId: appId.value },
    })
  }

  watch([projectId, appId], ([pid, aid]) => {
    if (pid && aid) storeAppScope(pid, aid)
  })

  onMounted(async () => {
    await loadProjects()
    initFromRoute()
  })

  return {
    loading,
    projects,
    projectId,
    appId,
    apps,
    selectedApp,
    cascaderOptions,
    cascaderValue,
    loadProjects,
    openInCatalog,
  }
}
