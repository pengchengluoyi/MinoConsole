<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Refresh, Search } from '@element-plus/icons-vue'
import { listPackKinds, listPackRoots, listPacks, reloadPacks } from '@/api/packs'
import { apiErrorMessage } from '@/utils/apiError'
import PackCreateDialog from './PackCreateDialog.vue'
import PackEntryDrawer from './PackEntryDrawer.vue'

const PROVIDER_LABEL = {
  platform: '平台团队',
  device_team: '设备环境组',
  app_qa: '业务测试',
  learned: '自动学习',
  doc: '文档学习',
  third_party: '第三方',
}
const LIFECYCLE_LABEL = { draft: '待确认', review: '待评审', active: '生效中', deprecated: '已停用' }
const ROOT_LABEL = { app: '应用私有', team: '团队共享', builtin: '仓库内置', learned: '自动学习' }
// 与现有写入契约对齐：目前只有恢复规则能新建。其它 kind 等服务端声明 writable。
const CREATABLE_KINDS = new Set(['recovery'])

const route = useRoute()

const loading = ref(false)
const reloading = ref(false)
const activeKind = ref('')
const keyword = ref('')
const providerFilter = ref('')
const lifecycleFilter = ref('')
const rootFilter = ref('')

const kinds = ref([])
const items = ref([])
const notReady = ref({})
const health = ref({ error_count: 0, by_kind: {}, errors: [] })
const showErrors = ref(false)

const drawerOpen = ref(false)
const activeRow = ref(null)
const createOpen = ref(false)
const roots = ref([])

const kindTabs = computed(() => kinds.value || [])
const currentTab = computed(() => kindTabs.value.find((t) => t.kind === activeKind.value))
const writableRoots = computed(() => roots.value.filter((r) => r.writable))
const writesOpen = computed(() => writableRoots.value.length > 0)
const kindReady = computed(() => currentTab.value?.ready !== false)
const kindBlocked = computed(() => !!currentTab.value && !kindReady.value)
const kindBlockedReason = computed(() =>
  currentTab.value?.not_ready_reason
  || notReady.value[activeKind.value]
  || '暂无数据',
)
const canCreate = computed(() => {
  if (!writesOpen.value || !kindReady.value) return false
  if (currentTab.value?.writable === true) return true
  return CREATABLE_KINDS.has(activeKind.value)
})
const hasFilter = computed(() =>
  !!(keyword.value.trim() || providerFilter.value || lifecycleFilter.value || rootFilter.value),
)

const providerOptions = computed(() => {
  const set = new Set(items.value.map((i) => i.provider).filter(Boolean))
  return [...set].map((p) => ({ value: p, label: PROVIDER_LABEL[p] || p }))
})

const rowWritable = (row) => {
  if (!row) return false
  return !!roots.value.find((r) => r.root === row.root)?.writable
}

const fetchRoots = async () => {
  try {
    const res = await listPackRoots()
    roots.value = res?.data?.roots || []
  } catch {
    roots.value = []
  }
}

const fetchKinds = async () => {
  try {
    const res = await listPackKinds()
    kinds.value = res?.data?.kinds || []
    health.value = res?.data?.health || health.value
  } catch (e) {
    ElMessage.error(apiErrorMessage(e, '读取扩展分类失败'))
  }
}

const fetchItems = async () => {
  if (!activeKind.value) return
  loading.value = true
  try {
    const params = { kind: activeKind.value }
    if (keyword.value.trim()) params.q = keyword.value.trim()
    if (providerFilter.value) params.provider = providerFilter.value
    if (lifecycleFilter.value) params.lifecycle = lifecycleFilter.value
    if (rootFilter.value) params.root = rootFilter.value
    const res = await listPacks(params)
    const data = res?.data || {}
    items.value = data.items || []
    notReady.value = data.not_ready || {}
    if (data.health) health.value = data.health
  } catch (e) {
    ElMessage.error(apiErrorMessage(e, '读取扩展列表失败'))
    items.value = []
  } finally {
    loading.value = false
  }
}

const switchKind = (kind) => {
  if (activeKind.value === kind) return
  activeKind.value = kind
  fetchItems()
}

const onReload = async () => {
  reloading.value = true
  try {
    const res = await reloadPacks()
    health.value = res?.data?.health || health.value
    ElMessage.success(res?.msg || '已重载')
    await Promise.all([fetchKinds(), fetchItems(), fetchRoots()])
  } catch (e) {
    ElMessage.error(apiErrorMessage(e, '重载失败'))
  } finally {
    reloading.value = false
  }
}

const openRow = (row) => {
  activeRow.value = row
  drawerOpen.value = true
}

const statusOf = (row) => {
  if (row.overridden_by) return { icon: '🚫', tip: `被 ${row.overridden_by} 覆盖，执行期不生效` }
  if (row.lifecycle === 'deprecated' || !row.enabled) return { icon: '🚫', tip: '已停用' }
  if (row.lifecycle === 'draft') return { icon: '⏸', tip: '待确认后才生效' }
  if (row.lifecycle === 'review') return { icon: '🧪', tip: '待评审' }
  return { icon: '✅', tip: '生效中' }
}

const scopeText = (row) => {
  const s = row.scope || {}
  const bits = []
  if (s.app_ids?.length) bits.push(`应用 ${String(s.app_ids[0]).slice(0, 8)}`)
  else bits.push('全部应用')
  if (s.app_versions) bits.push(s.app_versions)
  if (s.platforms?.length) bits.push(s.platforms.join('/'))
  if (s.visible_to?.length === 1 && s.visible_to[0] === 'system') bits.push('仅系统层可见')
  return bits.join(' · ')
}

const statsText = (row) => {
  const h = Number(row.stats?.hit_count || 0)
  const r = Number(row.stats?.refuted_count || 0)
  if (!h && !r) return ''
  return `命中 ${h}${r ? ` / 推翻 ${r}` : ''}`
}

const emptyCopy = computed(() => {
  if (hasFilter.value) return '没有符合筛选的条目'
  return '暂无数据'
})

onMounted(async () => {
  const q = String(route.query.q || '').trim()
  const kind = String(route.query.kind || '').trim()
  if (q) keyword.value = q
  await Promise.all([fetchKinds(), fetchRoots()])
  const allowed = new Set(kindTabs.value.map((t) => t.kind))
  if (kind && allowed.has(kind)) {
    activeKind.value = kind
  } else if (kind === 'capability' && allowed.has('generic')) {
    activeKind.value = 'generic'
  } else if (kindTabs.value.length) {
    activeKind.value = kindTabs.value[0].kind
  }
  if (q && !kind) {
    for (const t of kindTabs.value) {
      try {
        const res = await listPacks({ kind: t.kind, q })
        if ((res?.data?.items || []).length) {
          activeKind.value = t.kind
          break
        }
      } catch {
        /* 某个分类查失败时继续试下一个 */
      }
    }
  }
  await fetchItems()
})

const onCreated = async (item) => {
  await Promise.all([fetchItems(), fetchRoots(), fetchKinds()])
  if (item) openRow(item)
}

const onDrawerChanged = async () => {
  await Promise.all([fetchItems(), fetchKinds(), fetchRoots()])
}
</script>

<template>
  <div class="packs-panel" v-loading="loading">
    <el-alert v-if="health.error_count" type="warning" :closable="false" show-icon class="pk-health">
      <template #title>
        <span>{{ health.error_count }} 个条目有问题</span>
        <el-button link type="primary" size="small" @click="showErrors = !showErrors">
          {{ showErrors ? '收起' : '查看' }}
        </el-button>
        <el-button link type="primary" size="small" :icon="Refresh" :loading="reloading" @click="onReload">
          重载
        </el-button>
      </template>
      <ul v-if="showErrors" class="pk-errors">
        <li v-for="(e, i) in health.errors" :key="i">
          <code>{{ e.path || e.file || '—' }}</code>
          <span v-if="e.kind" class="pk-err-kind">{{ e.kind }}</span>
          {{ e.message }}
        </li>
      </ul>
    </el-alert>

    <div class="toolbar">
      <div class="settings-tabbar is-compact">
        <button
          v-for="t in kindTabs"
          :key="t.kind"
          type="button"
          class="settings-tab"
          :class="{ active: activeKind === t.kind }"
          @click="switchKind(t.kind)"
        >
          <strong>{{ t.label }}<em v-if="t.count" class="pk-count">{{ t.count }}</em></strong>
          <span>{{ t.desc }}</span>
        </button>
      </div>

      <div class="settings-toolbar pk-filters">
        <template v-if="!kindBlocked">
          <el-input
            v-model="keyword"
            class="toolbar-search"
            clearable
            placeholder="搜标题 / 触发条件 / 负责人"
            :prefix-icon="Search"
            @keyup.enter="fetchItems"
            @clear="fetchItems"
          />
          <el-select
            v-model="providerFilter"
            placeholder="提供方"
            clearable
            class="filter-item"
            @change="fetchItems"
          >
            <el-option v-for="o in providerOptions" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
          <el-select
            v-model="lifecycleFilter"
            placeholder="状态"
            clearable
            class="filter-item"
            @change="fetchItems"
          >
            <el-option v-for="(label, v) in LIFECYCLE_LABEL" :key="v" :label="label" :value="v" />
          </el-select>
          <el-select
            v-if="roots.length"
            v-model="rootFilter"
            placeholder="来源根"
            clearable
            class="filter-item"
            @change="fetchItems"
          >
            <el-option
              v-for="r in roots"
              :key="r.root"
              :value="r.root"
              :label="`${ROOT_LABEL[r.root] || r.label || r.root}（${r.count}）`"
            />
          </el-select>
          <el-button :icon="Search" @click="fetchItems">查询</el-button>
        </template>
        <el-button :icon="Refresh" :loading="reloading" @click="onReload">重载</el-button>
        <button v-if="canCreate" type="button" class="settings-action-pill" @click="createOpen = true">
          新建<span class="settings-action-arrow">→</span>
        </button>
      </div>
    </div>

    <p v-if="!kindTabs.length && !loading" class="pk-empty">暂无数据</p>

    <p v-else-if="kindBlocked" class="pk-empty">{{ kindBlockedReason }}</p>

    <p v-else-if="!items.length && !loading" class="pk-empty">{{ emptyCopy }}</p>

    <div v-else-if="items.length" class="settings-table-card pk-list">
      <div v-for="row in items" :key="row.uid" class="pk-row" @click="openRow(row)">
        <div class="pk-row-main">
          <span class="pk-status" :title="statusOf(row).tip">{{ statusOf(row).icon }}</span>
          <span class="pk-name">{{ row.title || row.id }}</span>
          <code class="pk-id">{{ row.id }}</code>
          <el-tag v-if="row.detail?.origin === 'runtime'" size="small" effect="plain">编排</el-tag>
          <el-tag v-else-if="row.detail?.exec_class && row.kind !== 'recovery'" size="small" effect="plain">
            设备动作
          </el-tag>
          <el-tag v-if="row.detail?.mode" size="small" effect="plain" class="pk-mode">
            {{ row.detail.mode === 'deterministic' ? '确定性' : '给模型提示' }}
          </el-tag>
          <el-tag v-if="row.detail?.pure_declarative" size="small" type="success" effect="plain">
            纯声明
          </el-tag>
          <el-tag
            v-if="row.detail?.status"
            size="small"
            effect="plain"
            :type="row.detail.status === 'supported' ? 'success'
              : (row.detail.status === 'partial' ? 'warning' : 'danger')"
          >
            {{ row.detail.status }}
          </el-tag>
          <el-tag
            v-if="row.overridden_by"
            size="small"
            type="info"
            effect="plain"
            :title="`被 ${row.overridden_by} 覆盖，执行期不生效`"
          >
            已被覆盖
          </el-tag>
          <span class="pk-spacer" />
          <span v-if="statsText(row)" class="pk-stats">{{ statsText(row) }}</span>
        </div>
        <div class="pk-row-sub">
          <span class="pk-root">{{ ROOT_LABEL[row.root] || row.root }}</span>
          <span class="pk-provider">{{ PROVIDER_LABEL[row.provider] || row.provider }}</span>
          <span class="pk-owner" :class="{ missing: !row.owner }">{{ row.owner || '未指定负责人' }}</span>
          <span class="pk-scope">{{ scopeText(row) }}</span>
          <span v-if="row.when || row.summary" class="pk-when">{{ row.when || row.summary }}</span>
        </div>
      </div>
    </div>

    <PackCreateDialog v-model="createOpen" :kind="activeKind" @created="onCreated" />

    <PackEntryDrawer
      v-model="drawerOpen"
      :uid="activeRow?.uid || ''"
      :row="activeRow"
      :writable="rowWritable(activeRow)"
      @changed="onDrawerChanged"
    />
  </div>
</template>

<style scoped>
.packs-panel { width: 100%; }
.pk-health { margin-bottom: 12px; }
.pk-errors { margin: 8px 0 0; padding-left: 18px; font-size: 12px; line-height: 1.7; }
.pk-err-kind { color: var(--settings-muted); margin: 0 4px; }
.pk-empty { margin: 8px 0 0; font-size: 13px; color: var(--settings-muted); }

.toolbar { display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px; }
.pk-count {
  margin-left: 4px; font-style: normal; font-size: 11px; padding: 0 5px;
  border-radius: 8px; background: var(--settings-soft); color: var(--settings-muted);
}
.pk-filters { margin-bottom: 0; }

.pk-list { display: flex; flex-direction: column; }
.pk-row {
  padding: 10px 12px; border-bottom: 1px solid var(--settings-border);
  cursor: pointer; transition: background .15s;
}
.pk-row:hover { background: var(--settings-soft); }
.pk-row-main { display: flex; align-items: center; gap: 8px; }
.pk-status { font-size: 13px; }
.pk-name { font-size: 14px; font-weight: 500; color: var(--settings-text); }
.pk-id { font-size: 12px; color: var(--settings-muted); }
.pk-spacer { flex: 1; }
.pk-stats { font-size: 12px; color: var(--settings-muted); }
.pk-row-sub {
  display: flex; align-items: center; gap: 10px; margin-top: 4px;
  font-size: 12px; color: var(--settings-muted); flex-wrap: wrap;
}
.pk-provider { padding: 0 6px; border-radius: 8px; background: var(--settings-soft); }
.pk-root {
  padding: 0 6px; border-radius: 8px; background: var(--settings-primary-soft);
  color: var(--settings-primary);
}
.pk-owner.missing { color: var(--el-color-warning); }
.pk-when {
  flex: 1; min-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  color: var(--settings-muted);
}
</style>
