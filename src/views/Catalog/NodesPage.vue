<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { listRuntimeAssets, parseRuntimeAssets } from '@/api/runtime'
import { apiErrorMessage } from '@/utils/apiError'
import { formatCreatedAt } from '@/utils/formatTime'
import '../Settings/settings-ui.css'

const loading = ref(false)
const assets = ref({ scout_count: 0, studio_count: 0, device_count: 0, scouts: [], studios: [] })

const statusLabel = (row) => {
  if (row?.kind === 'studio') return '—'
  if (row?.alive || row?.online || row?.status === 'online') return '在线'
  return '离线'
}

const statusType = (row) => {
  if (row?.kind === 'studio') return 'info'
  if (row?.alive || row?.online || row?.status === 'online') return 'success'
  return 'info'
}

const ownerOf = (row) => row?.owner_name || row?.owner_user_id || '未归属'

const kindLabel = (row) => (row?.kind === 'studio' ? 'Studio' : 'Scout')

const rowId = (row) => {
  if (row?.kind === 'studio') return row.studio_id || '—'
  return row.scout_id || row.node_id || '—'
}

const heartbeatOf = (row) => {
  if (row?.kind === 'studio') return formatCreatedAt(row.updated_at || row.first_seen || '')
  return formatCreatedAt(row.last_heartbeat || row.last_seen || '')
}

const tableRows = computed(() => {
  const scouts = (assets.value.scouts || []).map((row) => ({
    ...row,
    kind: 'scout',
    row_key: `scout:${row.node_id || row.scout_id || ''}`,
    devices: row.devices || [],
    device_count: row.device_count ?? (row.devices || []).length,
  }))
  const studios = (assets.value.studios || []).map((row) => ({
    ...row,
    kind: 'studio',
    row_key: `studio:${row.studio_id || ''}`,
    devices: row.devices || [],
    device_count: row.device_count ?? (row.devices || []).length,
  }))
  return [...scouts, ...studios]
})

const load = async () => {
  loading.value = true
  try {
    assets.value = parseRuntimeAssets(await listRuntimeAssets())
  } catch (e) {
    assets.value = { scout_count: 0, studio_count: 0, device_count: 0, scouts: [], studios: [] }
    ElMessage.error(apiErrorMessage(e, '加载节点失败'))
  } finally {
    loading.value = false
  }
}

const summary = computed(() => {
  const a = assets.value
  return `${a.scout_count} 个 Scout · ${a.studio_count} 个 Studio · ${a.device_count} 台设备`
})

onMounted(load)
</script>

<template>
  <div class="settings-panel wide-panel catalog-page" v-loading="loading">
    <header class="settings-page-header">
      <div>
        <h2 class="settings-page-title">节点与设备</h2>
      </div>
      <div class="settings-summary-pill">{{ summary }}</div>
    </header>

    <div class="settings-toolbar">
      <button type="button" class="settings-action-pill refresh-pill toolbar-push" :disabled="loading" @click="load">刷新</button>
    </div>

    <section class="settings-table-card">
      <el-table
        :data="tableRows"
        border
        stripe
        size="small"
        empty-text="暂无节点"
        row-key="row_key"
      >
        <el-table-column type="expand">
          <template #default="{ row }">
            <el-table
              :data="row.devices || []"
              border
              size="small"
              empty-text="暂无设备"
              class="nested-table"
            >
              <el-table-column label="设备" min-width="140">
                <template #default="{ row: d }">{{ d.sn || '—' }}</template>
              </el-table-column>
              <el-table-column label="类型" width="90">
                <template #default="{ row: d }">{{ d.type || d.platform || '—' }}</template>
              </el-table-column>
              <el-table-column label="型号" min-width="120">
                <template #default="{ row: d }">{{ d.model || '—' }}</template>
              </el-table-column>
              <el-table-column label="账户" min-width="120">
                <template #default="{ row: d }">{{ ownerOf(d) }}</template>
              </el-table-column>
              <el-table-column label="状态" width="80">
                <template #default="{ row: d }">
                  <el-tag size="small" :type="statusType(d)">{{ statusLabel(d) }}</el-tag>
                </template>
              </el-table-column>
            </el-table>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="88">
          <template #default="{ row }">
            <el-tag size="small" :type="row.kind === 'studio' ? 'info' : 'warning'" effect="plain">
              {{ kindLabel(row) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="ID" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">
            <code>{{ rowId(row) }}</code>
          </template>
        </el-table-column>
        <el-table-column label="账户" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ ownerOf(row) }}</template>
        </el-table-column>
        <el-table-column label="设备" width="72">
          <template #default="{ row }">{{ row.device_count ?? (row.devices || []).length }}</template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag v-if="row.kind !== 'studio'" size="small" :type="statusType(row)">{{ statusLabel(row) }}</el-tag>
            <span v-else class="studio-meta">{{ row.scout_count || 0 }} 个 Scout</span>
          </template>
        </el-table-column>
        <el-table-column label="心跳" min-width="160">
          <template #default="{ row }">{{ heartbeatOf(row) }}</template>
        </el-table-column>
      </el-table>
    </section>
  </div>
</template>

<style scoped>
.nested-table {
  margin: 8px 12px 12px;
}
.toolbar-push {
  margin-left: auto;
}
.studio-meta {
  font-size: 12px;
  color: var(--mo-muted);
}
code { font-size: 12px; }
</style>
