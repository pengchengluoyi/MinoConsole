import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getAuthStatus, logoutAccount } from '@/api/auth'
import { getMeBootstrap, getServerInfoHttp } from '@/api/me'
import { pingServer } from '@/utils/config'
import { recordAudit } from '@/utils/auditLog'
import { clearRealtimeTokens } from '@/utils/realtime'

export const useSessionStore = defineStore('session', () => {
  const user = ref(null)
  const capabilities = ref({})
  const nexus = ref({
    reachable: false,
    version: '',
    service: '',
  })
  const loading = ref(false)

  const displayName = computed(() => {
    const u = user.value || {}
    return u.name || u.username || u.email || '未登录'
  })

  const role = computed(() => user.value?.role || '')

  const applyUser = (data) => {
    if (!data) {
      user.value = null
      capabilities.value = {}
      return
    }
    user.value = {
      user_id: data.user_id || '',
      email: data.email || '',
      name: data.name || '',
      username: data.username || '',
      role: data.role || '',
      logged_in: data.logged_in !== false,
    }
    capabilities.value = data.capabilities || {}
  }

  const refreshNexus = async () => {
    try {
      const info = await getServerInfoHttp()
      const data = info?.data || info || {}
      nexus.value = {
        reachable: true,
        version: data.version || data.nexus_version || '',
        service: data.service || 'MinoNexus',
      }
      return true
    } catch {
      const ok = await pingServer(1500)
      nexus.value = {
        reachable: ok,
        version: ok ? nexus.value.version : '',
        service: ok ? (nexus.value.service || 'MinoNexus') : '',
      }
      return ok
    }
  }

  const refreshUser = async () => {
    try {
      const res = await getMeBootstrap()
      applyUser(res?.data || {})
      return true
    } catch {
      try {
        const res = await getAuthStatus()
        applyUser(res?.data || {})
        return !!res?.data?.logged_in
      } catch {
        applyUser(null)
        return false
      }
    }
  }

  const refresh = async () => {
    loading.value = true
    try {
      await Promise.all([refreshNexus(), refreshUser()])
    } finally {
      loading.value = false
    }
  }

  const logout = async () => {
    const who = displayName.value
    try {
      await logoutAccount()
    } catch { /* 本地清会话即可 */ }
    recordAudit('退出登录', who)
    clearRealtimeTokens()
    applyUser(null)
  }

  return {
    user,
    capabilities,
    nexus,
    loading,
    displayName,
    role,
    refresh,
    refreshNexus,
    refreshUser,
    logout,
  }
})
