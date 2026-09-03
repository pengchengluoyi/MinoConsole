<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getHealthHttp, getServerInfoHttp } from '@/api/me'
import { getRuntimeStatusHttp } from '@/api/system'
import { nexusOrigin, usesWebProxy, pingServer } from '@/utils/config'
import './settings-ui.css'

const router = useRouter()
const loading = ref(true)
const origin = usesWebProxy() ? (typeof window !== 'undefined' ? window.location.origin : '') : nexusOrigin()
const reachable = ref(false)
const version = ref('')
const service = ref('')
const health = ref(null)
const runtime = ref(null)
const errors = ref({})

const endpoints = computed(() => runtime.value?.endpoints || [])
const nodeSummary = computed(() => {
  if (runtime.value && typeof runtime.value.node_count === 'number') {
    return {
      total: runtime.value.node_count,
      alive: runtime.value.nodes_alive ?? runtime.value.node?.nodes_alive,
    }
  }
  return { total: health.value?.nodes ?? '—', alive: health.value?.nodes_alive ?? '—' }
})

onMounted(async () => {
  loading.value = true
  errors.value = {}
  reachable.value = await pingServer(1500)

  const grab = async (key, fn) => {
    try {
      return await fn()
    } catch (e) {
      errors.value[key] = e?.response?.data?.detail || e?.message || '读取失败'
      return null
    }
  }

  const info = await grab('info', getServerInfoHttp)
  if (info) {
    reachable.value = true
    version.value = info?.data?.version || ''
    service.value = info?.data?.service || 'MinoNexus'
  }

  health.value = await grab('health', getHealthHttp)
  if (health.value?.nexus_version && !version.value) version.value = health.value.nexus_version

  const rt = await grab('runtime', getRuntimeStatusHttp)
  runtime.value = rt?.data || null

  loading.value = false
})
</script>

<template>
  <div class="settings-panel system-page wide-panel" v-loading="loading">
    <header class="settings-page-header">
      <div>
        <h2 class="settings-page-title">运行状态</h2>
      </div>
      <div class="settings-summary-pill" :class="reachable ? '' : 'is-err'">
        {{ reachable ? 'Nexus 可达' : '无法连接服务器' }}
      </div>
    </header>

    <section class="sys-grid">
      <article class="settings-card">
        <div class="settings-kicker">连接</div>
        <h3 class="system-card-title">{{ service || 'MinoNexus' }} {{ version }}</h3>
        <p class="settings-page-desc">{{ origin }}</p>
        <p v-if="errors.info" class="settings-page-desc">{{ errors.info }}</p>
      </article>

      <article class="settings-card">
        <div class="settings-kicker">健康检查</div>
        <h3 class="system-card-title">{{ health?.ok ? '正常' : (errors.health ? '未返回' : '—') }}</h3>
        <p class="settings-page-desc">
          协议 {{ health?.protocol_version || '—' }}
          · 节点 {{ health?.nodes ?? '—' }}
          · 在线 {{ health?.nodes_alive ?? '—' }}
        </p>
        <p v-if="errors.health" class="settings-page-desc">{{ errors.health }}</p>
      </article>

      <article class="settings-card clickable" @click="router.push('/nodes')">
        <div class="settings-kicker">执行器</div>
        <h3 class="system-card-title">{{ nodeSummary.total }} 个节点</h3>
        <p class="settings-page-desc">在线 {{ nodeSummary.alive ?? '—' }} · 明细见库存</p>
      </article>
    </section>

    <section class="settings-table-card">
      <div class="settings-kicker">服务端点</div>
      <el-table v-if="endpoints.length" :data="endpoints" empty-text="没有端点">
        <el-table-column prop="name" label="名称" min-width="140" />
        <el-table-column prop="url" label="地址" min-width="240" show-overflow-tooltip />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">{{ row.online ? '在线' : '离线' }}</template>
        </el-table-column>
      </el-table>
      <p v-else class="settings-page-desc sys-empty">
        {{ errors.runtime || '暂无数据' }}
      </p>
    </section>
  </div>
</template>

<style scoped>
.sys-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}
.system-card-title {
  margin: 8px 0 4px;
  font-size: 16px;
  font-weight: 700;
  color: var(--settings-text);
}
.settings-table-card {
  margin-top: 12px;
}
.settings-table-card .settings-kicker {
  margin-bottom: 8px;
}
.sys-empty {
  padding: 8px 0 4px;
}
.clickable {
  cursor: pointer;
}
.clickable:hover {
  border-color: color-mix(in srgb, var(--settings-primary, #6366f1) 35%, var(--settings-border, #e5e7eb));
}
</style>
