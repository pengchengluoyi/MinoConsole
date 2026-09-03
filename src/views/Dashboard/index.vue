<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { listAuthUsers } from '@/api/auth'
import { getHealthHttp, getMeBootstrap, getServerInfoHttp } from '@/api/me'
import { listPackKinds } from '@/api/packs'
import { listProjects } from '@/api/project'
import { inventoryOf, parseProjectList } from '@/utils/catalog'
import { listRuntimeNodes, parseRuntimeNodes } from '@/api/runtime'
import { getMailSettings, listAIRoles } from '@/api/settings'
import { getRuntimeStatusHttp } from '@/api/system'
import { pingServer, nexusOrigin, usesWebProxy } from '@/utils/config'
import { roleLabel } from '@/utils/iam'
import { useSessionStore } from '@/store/session'
import '../Settings/settings-ui.css'

const router = useRouter()
const session = useSessionStore()
const loading = ref(true)
const error = ref('')

const reachable = ref(false)
const version = ref('')
const identity = ref(null)
const userCount = ref(null)
const nodeCount = ref(null)
const mailConfigured = ref(null)
const packKindCount = ref(null)
const packItemCount = ref(null)
const roleCount = ref(null)
const catalogInventory = ref(null)
const origin = computed(() => (usesWebProxy() ? window.location.origin : nexusOrigin()))

const stat = (value, fallback = '—') => (value == null ? fallback : String(value))

const identityLine = computed(() => {
  const u = identity.value
  if (!u) return '未读取到登录身份'
  const name = u.name || u.username || u.email || '当前用户'
  return `${name} · ${roleLabel(u.role)}`
})

const settle = async (fn) => {
  try {
    return { ok: true, value: await fn() }
  } catch (e) {
    return { ok: false, error: e }
  }
}

onMounted(async () => {
  loading.value = true
  error.value = ''
  try {
    reachable.value = await pingServer(1500)
    const info = await settle(getServerInfoHttp)
    if (info.ok) {
      reachable.value = true
      version.value = info.value?.data?.version || info.value?.data?.nexus_version || ''
    }

    const [
      me,
      users,
      nodes,
      runtime,
      mail,
      kinds,
      roles,
      health,
      catalog,
    ] = await Promise.all([
      settle(getMeBootstrap),
      settle(listAuthUsers),
      settle(listRuntimeNodes),
      settle(getRuntimeStatusHttp),
      settle(getMailSettings),
      settle(listPackKinds),
      settle(listAIRoles),
      settle(getHealthHttp),
      settle(listProjects),
    ])

    if (me.ok) identity.value = me.value?.data || null
    else identity.value = session.user

    if (users.ok) userCount.value = (users.value?.data?.users || []).length

    if (nodes.ok) nodeCount.value = parseRuntimeNodes(nodes.value).length
    else if (runtime.ok) {
      const data = runtime.value?.data || {}
      nodeCount.value = Array.isArray(data.nodes) ? data.nodes.length : (typeof data.node_count === 'number' ? data.node_count : null)
    }

    if (mail.ok) mailConfigured.value = !!mail.value?.data?.configured
    if (kinds.ok) {
      const list = kinds.value?.data?.kinds || []
      packKindCount.value = list.length
      packItemCount.value = list.reduce((sum, row) => sum + Number(row.count || 0), 0)
    }
    if (roles.ok) {
      const data = roles.value?.data || {}
      roleCount.value = data.counts?.product ?? data.counts?.roles ?? (data.product || []).length
    }
    if (health.ok && !version.value) version.value = health.value?.nexus_version || ''
    if (catalog.ok) catalogInventory.value = inventoryOf(parseProjectList(catalog.value))
  } catch (e) {
    error.value = e?.message || '工作台加载失败'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="settings-panel wide-panel dash-page" v-loading="loading">
    <header class="settings-page-header">
      <div>
        <h2 class="settings-page-title">工作台</h2>
      </div>
      <div class="settings-summary-pill" :class="reachable ? '' : 'is-err'">
        {{ reachable ? (version ? `Nexus ${version}` : 'Nexus 已连接') : '无法连接服务器' }}
      </div>
    </header>

    <p v-if="error" class="settings-page-desc">{{ error }}</p>

    <section class="dash-grid">
      <article class="settings-card dash-stat">
        <div class="settings-kicker">Nexus</div>
        <strong>{{ reachable ? '可达' : '不可达' }}</strong>
        <p>{{ origin }}{{ version ? ` · ${version}` : '' }}</p>
      </article>
      <article class="settings-card dash-stat">
        <div class="settings-kicker">当前身份</div>
        <strong>{{ identity ? (identity.username || identity.name || '已登录') : '—' }}</strong>
        <p>{{ identityLine }}</p>
      </article>
      <article class="settings-card dash-stat is-link" @click="router.push('/catalog')">
        <div class="settings-kicker">项目与应用</div>
        <strong>{{ catalogInventory == null ? '—' : `${catalogInventory.projects} / ${catalogInventory.apps}` }}</strong>
        <p>项目 / 应用</p>
      </article>
      <article class="settings-card dash-stat">
        <div class="settings-kicker">成员</div>
        <strong>{{ stat(userCount) }}</strong>
        <p>来自 GET /auth/users</p>
      </article>
      <article class="settings-card dash-stat">
        <div class="settings-kicker">Scout 节点</div>
        <strong>{{ stat(nodeCount) }}</strong>
        <p>来自 GET /runtime/nodes</p>
      </article>
      <article class="settings-card dash-stat">
        <div class="settings-kicker">发信</div>
        <strong>{{ mailConfigured == null ? '—' : (mailConfigured ? '已配置' : '未配置') }}</strong>
        <p>来自 GET /settings/mail</p>
      </article>
      <article class="settings-card dash-stat">
        <div class="settings-kicker">扩展包</div>
        <strong>{{ packKindCount == null ? '—' : `${packKindCount} 类` }}</strong>
        <p>{{ packItemCount == null ? '来自 GET /packs/kinds' : `共 ${packItemCount} 条` }}</p>
      </article>
      <article class="settings-card dash-stat">
        <div class="settings-kicker">产品角色</div>
        <strong>{{ stat(roleCount) }}</strong>
        <p>来自 GET /settings/ai/roles</p>
      </article>
    </section>

    <section class="settings-card dash-cta">
      <div class="settings-kicker">常用操作</div>
      <div class="dash-actions">
        <button type="button" class="settings-action-pill" @click="router.push('/catalog')">
          查看项目与应用<span class="settings-action-arrow">→</span>
        </button>
        <button type="button" class="settings-action-pill" @click="router.push('/members')">
          管理成员<span class="settings-action-arrow">→</span>
        </button>
        <button type="button" class="settings-action-pill" @click="router.push('/mail')">
          配置发信<span class="settings-action-arrow">→</span>
        </button>
        <button type="button" class="settings-action-pill" @click="router.push('/roles')">
          编辑产品角色<span class="settings-action-arrow">→</span>
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.dash-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.dash-stat strong {
  display: block;
  margin: 8px 0 4px;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.03em;
}

.dash-stat.is-link {
  cursor: pointer;
}

.dash-stat.is-link:hover {
  border-color: var(--settings-primary);
}

.dash-stat p {
  margin: 0;
  color: var(--settings-muted);
  font-size: 12px;
  line-height: 1.45;
}

.dash-cta {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dash-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
