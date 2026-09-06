<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Refresh, Search } from '@element-plus/icons-vue'
import { listPackKinds, listPacks, reloadPacks, setPackLifecycle } from '@/api/packs'
import { apiErrorMessage, writeUnavailableMessage } from '@/utils/apiError'
import PackCreateDialog from './PackCreateDialog.vue'
import PackEntryDrawer from './PackEntryDrawer.vue'

const STATUS_OPTIONS = [
  { value: 'pending', label: '待启用' },
  { value: 'active', label: '生效中' },
  { value: 'deprecated', label: '已停用' },
]
const STATUS_LABEL = Object.fromEntries(STATUS_OPTIONS.map((s) => [s.value, s.label]))
const STATUS_TYPE = { pending: 'info', active: 'success', deprecated: '' }
const PLATFORM_OPTIONS = [
  { value: 'android', label: 'Android' },
  { value: 'ios', label: 'iOS' },
  { value: 'web', label: 'Web' },
  { value: 'mac', label: 'macOS' },
  { value: 'windows', label: 'Windows' },
]
const CATEGORY_OPTIONS = [
  { value: 'ui_interaction', label: '界面操作' },
  { value: 'system', label: '系统' },
  { value: 'app_lifecycle', label: '应用生命周期' },
  { value: 'hitl', label: '人工' },
  { value: 'assertion', label: '断言' },
  { value: 'control', label: '控制' },
  { value: 'deterministic', label: '确定性恢复' },
  { value: 'advise', label: '提示模型恢复' },
]
const CREATABLE_KINDS = new Set(['recovery'])

const route = useRoute()

const loading = ref(false)
const reloading = ref(false)
const savingUid = ref('')
const activeKind = ref('')
const keyword = ref('')
const lifecycleFilter = ref('')
const platformFilter = ref('')
const categoryFilter = ref('')

const kinds = ref([])
const items = ref([])
const notReady = ref({})
const health = ref({ error_count: 0, by_kind: {}, errors: [] })
const showErrors = ref(false)

const page = ref(1)
const pageSize = ref(50)
const drawerOpen = ref(false)
const activeRow = ref(null)
const createOpen = ref(false)

const kindTabs = computed(() => kinds.value || [])
const currentTab = computed(() => kindTabs.value.find((t) => t.kind === activeKind.value))
const kindReady = computed(() => currentTab.value?.ready !== false)
const kindBlocked = computed(() => !!currentTab.value && !kindReady.value)
const kindBlockedReason = computed(() =>
  currentTab.value?.not_ready_reason
  || notReady.value[activeKind.value]
  || '暂无数据',
)
const canCreate = computed(() => {
  if (!kindReady.value) return false
  if (currentTab.value?.writable === true) return true
  return CREATABLE_KINDS.has(activeKind.value)
})
const hasFilter = computed(() =>
  !!(keyword.value.trim() || lifecycleFilter.value || platformFilter.value || categoryFilter.value),
)

const uiStatus = (row) => {
  if (!row) return 'pending'
  if (row.status) return row.status
  if (row.overridden_by || row.lifecycle === 'deprecated' || row.enabled === false) return 'deprecated'
  if (row.lifecycle === 'draft' || row.lifecycle === 'review' || row.lifecycle === 'pending') return 'pending'
  return 'active'
}

const fetchKinds = async () => {
  try {
    const res = await listPackKinds()
    kinds.value = (res?.data?.kinds || []).filter((t) => t.kind !== 'knowledge' && t.kind !== 'oracle')
    health.value = res?.data?.health || health.value
    if (activeKind.value === 'knowledge' || activeKind.value === 'oracle') {
      activeKind.value = kinds.value[0]?.kind || ''
    }
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
    if (lifecycleFilter.value) params.lifecycle = lifecycleFilter.value
    if (platformFilter.value) params.platform = platformFilter.value
    if (categoryFilter.value) params.category = categoryFilter.value
    const res = await listPacks(params)
    const data = res?.data || {}
    items.value = data.items || []
    notReady.value = data.not_ready || {}
    if (data.health) health.value = data.health
    clampPage()
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
  page.value = 1
  fetchItems()
}

const onReload = async () => {
  reloading.value = true
  try {
    const res = await reloadPacks()
    health.value = res?.data?.health || health.value
    ElMessage.success(res?.msg || '已重载')
    await Promise.all([fetchKinds(), fetchItems()])
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

const setStatus = async (row, status) => {
  if (uiStatus(row) === status) return
  savingUid.value = row.uid
  try {
    const res = await setPackLifecycle(row.uid, { status })
    const next = res?.data?.item
    if (next) {
      items.value = items.value.map((r) => (r.uid === row.uid ? { ...r, ...next } : r))
      if (activeRow.value?.uid === row.uid) activeRow.value = { ...activeRow.value, ...next }
    }
    ElMessage.success(status === 'active' ? '已启用' : '已停用')
    fetchKinds()
  } catch (e) {
    ElMessage.error(writeUnavailableMessage(e, '更改状态失败'))
  } finally {
    savingUid.value = ''
  }
}

const scopeText = (row) => {
  const s = row.scope || {}
  const bits = []
  const plats = s.platforms || []
  bits.push(plats.length ? plats.join(' / ') : '全平台')
  if (s.app_ids?.length) bits.push(`应用 ${String(s.app_ids[0]).slice(0, 8)}`)
  if (s.visible_to?.length === 1 && s.visible_to[0] === 'system') bits.push('仅系统层')
  return bits.join(' · ')
}

const emptyCopy = computed(() => {
  if (hasFilter.value) return '没有符合筛选的条目'
  return '暂无数据'
})

const pagedItems = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return items.value.slice(start, start + pageSize.value)
})

const clampPage = () => {
  const maxPage = Math.max(1, Math.ceil(items.value.length / pageSize.value) || 1)
  if (page.value > maxPage) page.value = maxPage
}

watch([lifecycleFilter, platformFilter, categoryFilter], () => {
  page.value = 1
})
watch(pageSize, () => {
  page.value = 1
})

onMounted(async () => {
  const q = String(route.query.q || '').trim()
  const kind = String(route.query.kind || '').trim()
  if (q) keyword.value = q
  await fetchKinds()
  const allowed = new Set(kindTabs.value.map((t) => t.kind))
  const aliased = { expect: 'check', step: 'do', capability: 'generic' }[kind] || kind
  if (kind && allowed.has(kind)) {
    activeKind.value = kind
  } else if (aliased && allowed.has(aliased)) {
    activeKind.value = aliased
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
  await Promise.all([fetchItems(), fetchKinds()])
  if (item) openRow(item)
}

const onDrawerChanged = async () => {
  await Promise.all([fetchItems(), fetchKinds()])
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
            placeholder="搜标题 / 标识 / 说明"
            :prefix-icon="Search"
            @keyup.enter="page = 1; fetchItems()"
            @clear="page = 1; fetchItems()"
          />
          <el-select
            v-model="lifecycleFilter"
            placeholder="状态"
            clearable
            class="filter-item"
            @change="fetchItems"
          >
            <el-option v-for="o in STATUS_OPTIONS" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
          <el-select
            v-model="platformFilter"
            placeholder="平台"
            clearable
            class="filter-item"
            @change="fetchItems"
          >
            <el-option v-for="o in PLATFORM_OPTIONS" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
          <el-select
            v-model="categoryFilter"
            placeholder="分类"
            clearable
            class="filter-item pk-filter-wide"
            @change="fetchItems"
          >
            <el-option v-for="o in CATEGORY_OPTIONS" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
          <el-button :icon="Search" @click="page = 1; fetchItems()">查询</el-button>
        </template>
        <el-button :icon="Refresh" :loading="reloading" @click="onReload">重载</el-button>
        <button v-if="canCreate" type="button" class="settings-action-pill" @click="createOpen = true">
          新建<span class="settings-action-arrow">→</span>
        </button>
      </div>
    </div>

    <p v-if="!kindTabs.length && !loading" class="pk-empty">暂无数据</p>

    <p v-else-if="kindBlocked" class="pk-empty">{{ kindBlockedReason }}</p>

    <section v-else class="settings-table-card is-fill pk-table-card">
      <el-table
        :data="pagedItems"
        height="100%"
        border
        stripe
        size="small"
        class="pk-table"
        :empty-text="emptyCopy"
        @row-click="openRow"
      >
        <el-table-column label="名称" min-width="160">
          <template #default="{ row }">
            <strong>{{ row.title || row.id }}</strong>
          </template>
        </el-table-column>
        <el-table-column label="标识" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">
            <code class="pk-id">{{ row.id }}</code>
          </template>
        </el-table-column>
        <el-table-column label="平台" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ scopeText(row) }}</template>
        </el-table-column>
        <el-table-column label="说明" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">{{ row.when || row.summary || '—' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="88">
          <template #default="{ row }">
            <el-tag size="small" :type="STATUS_TYPE[uiStatus(row)]" effect="light">
              {{ STATUS_LABEL[uiStatus(row)] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="128" fixed="right">
          <template #default="{ row }">
            <div class="pk-ops" @click.stop>
              <el-button
                link
                type="primary"
                size="small"
                :disabled="uiStatus(row) === 'active' || savingUid === row.uid"
                @click="setStatus(row, 'active')"
              >启用</el-button>
              <el-button
                link
                type="danger"
                size="small"
                :disabled="uiStatus(row) === 'deprecated' || savingUid === row.uid"
                @click="setStatus(row, 'deprecated')"
              >停用</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        class="settings-table-pager"
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="items.length"
        :page-sizes="[20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        background
        small
      />
    </section>

    <PackCreateDialog v-model="createOpen" :kind="activeKind" @created="onCreated" />

    <PackEntryDrawer
      v-model="drawerOpen"
      :uid="activeRow?.uid || ''"
      :row="activeRow"
      :writable="true"
      @changed="onDrawerChanged"
    />
  </div>
</template>

<style scoped>
.packs-panel {
  width: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.pk-health { margin-bottom: 12px; flex-shrink: 0; }
.pk-errors { margin: 8px 0 0; padding-left: 18px; font-size: 12px; line-height: 1.7; }
.pk-err-kind { color: var(--settings-muted); margin: 0 4px; }
.pk-empty { margin: 8px 0 0; font-size: 13px; color: var(--settings-muted); }

.toolbar { display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px; flex-shrink: 0; }
.pk-count {
  margin-left: 4px; font-style: normal; font-size: 11px; padding: 0 5px;
  border-radius: 8px; background: var(--settings-soft); color: var(--settings-muted);
}
.pk-filters { margin-bottom: 0; }
.pk-filters :deep(.pk-filter-wide) {
  width: 140px;
  max-width: 140px;
  flex-basis: 140px;
}
.pk-table-card { min-height: 240px; }
.pk-table-card :deep(.el-table) { flex: 1; }
.pk-table { cursor: pointer; }
.pk-id { font-size: 12px; color: var(--settings-muted); }
.pk-ops { display: inline-flex; align-items: center; gap: 0; }
</style>
