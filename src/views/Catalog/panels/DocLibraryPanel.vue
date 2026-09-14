<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Upload } from '@element-plus/icons-vue'
import {
  deleteDoc,
  extractDocKnowledge,
  getDocChunks,
  listDocs,
  listRobotIntegrations,
  patchDocSync,
  searchDocs,
  syncDocNow,
  syncFeishuDoc,
  uploadDoc,
} from '@/api/settings'
import { apiErrorMessage } from '@/utils/apiError'
import '../../Settings/settings-ui.css'

const props = defineProps({
  appId: { type: String, required: true },
  projectId: { type: String, default: '' },
  embedded: { type: Boolean, default: false },
})

const STATUS_LABEL = { ok: '已索引', parsing: '解析中', error: '失败' }
const STATUS_TYPE = { ok: 'success', parsing: 'warning', error: 'danger' }
const FILE_LABEL = { md: 'Markdown', pdf: 'PDF' }
const KIND_LABEL = { upload: '上传', feishu: '飞书' }

const loading = ref(false)
const uploading = ref(false)
const searching = ref(false)
const items = ref([])
const panel = ref('list')
const searchQ = ref('')
const searchHits = ref([])
const searchVector = ref(true)
const syncToggling = ref('')
const syncNowing = ref('')

const drawerOpen = ref(false)
const detail = ref(null)
const chunks = ref([])
const extracting = ref(false)
const feishuOpen = ref(false)
const feishuSyncing = ref(false)
const feishuUrl = ref('')
const feishuBotId = ref('')
const feishuTitle = ref('')
const larkBots = ref([])

function formatBytes(n) {
  const v = Number(n) || 0
  if (v < 1024) return `${v} B`
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`
  return `${(v / (1024 * 1024)).toFixed(1)} MB`
}

function formatTime(ts) {
  const n = Number(ts) || 0
  if (!n) return '—'
  return new Date(n * 1000).toLocaleString()
}

const load = async () => {
  if (!props.appId) {
    items.value = []
    return
  }
  loading.value = true
  try {
    const res = await listDocs(props.appId, props.projectId)
    items.value = res?.data?.items || []
  } catch (e) {
    items.value = []
    ElMessage.error(apiErrorMessage(e, '读取文档库失败'))
  } finally {
    loading.value = false
  }
}

const loadBots = async () => {
  try {
    const res = await listRobotIntegrations()
    larkBots.value = (res?.data?.bots || res?.bots || []).filter((b) => b.platform === 'lark' && b.configured)
    if (!feishuBotId.value && larkBots.value.length) {
      feishuBotId.value = larkBots.value[0].id
    }
  } catch {
    larkBots.value = []
  }
}

const openFeishu = async () => {
  if (!props.appId) return
  feishuUrl.value = ''
  feishuTitle.value = ''
  await loadBots()
  if (!larkBots.value.length) {
    ElMessage.warning('请先在设置中配置飞书机器人')
    return
  }
  feishuOpen.value = true
}

const syncFeishu = async () => {
  const url = feishuUrl.value.trim()
  if (!url) {
    ElMessage.warning('请填写飞书文档链接')
    return
  }
  feishuSyncing.value = true
  try {
    await syncFeishuDoc({
      url,
      app_id: props.appId,
      project_id: props.projectId,
      bot_id: feishuBotId.value,
      title: feishuTitle.value.trim(),
    })
    ElMessage.success('飞书文档已同步')
    feishuOpen.value = false
    await load()
  } catch (e) {
    ElMessage.error(apiErrorMessage(e, '飞书同步失败'))
  } finally {
    feishuSyncing.value = false
  }
}

const onUploadPick = async (uploadFile) => {
  const file = uploadFile?.raw
  if (!file || !props.appId) return
  const name = String(file.name || '').toLowerCase()
  if (!name.endsWith('.md') && !name.endsWith('.markdown') && !name.endsWith('.pdf')) {
    ElMessage.warning('仅支持 .md / .pdf')
    return
  }
  uploading.value = true
  try {
    await uploadDoc({ file, appId: props.appId, projectId: props.projectId })
    ElMessage.success('文档已入库')
    panel.value = 'list'
    await load()
  } catch (e) {
    ElMessage.error(apiErrorMessage(e, '上传失败'))
  } finally {
    uploading.value = false
  }
}

const runSearch = async () => {
  const q = searchQ.value.trim()
  if (!q) {
    ElMessage.warning('输入检索词')
    return
  }
  if (!props.appId) return
  searching.value = true
  try {
    const res = await searchDocs(q, props.appId, 20, searchVector.value)
    searchHits.value = res?.data?.items || []
  } catch (e) {
    searchHits.value = []
    ElMessage.error(apiErrorMessage(e, '检索失败'))
  } finally {
    searching.value = false
  }
}

const openDetail = async (row) => {
  detail.value = row
  drawerOpen.value = true
  chunks.value = []
  try {
    const res = await getDocChunks(row.id)
    chunks.value = res?.data?.items || []
  } catch (e) {
    ElMessage.error(apiErrorMessage(e, '读取分片失败'))
  }
}

const extract = async (row) => {
  if (!row?.id || !props.appId) return
  extracting.value = true
  try {
    const res = await extractDocKnowledge(row.id, {
      app_id: props.appId,
      project_id: props.projectId,
    })
    const n = res?.data?.saved ?? 0
    ElMessage.success(res?.msg || `已抽取 ${n} 条，请到执行知识库审核`)
  } catch (e) {
    ElMessage.error(apiErrorMessage(e, '抽取失败（需配置大模型 Key）'))
  } finally {
    extracting.value = false
  }
}

const toggleAutoSync = async (row, enabled) => {
  if (!row?.id || row.source_kind !== 'feishu') return
  syncToggling.value = row.id
  try {
    await patchDocSync(row.id, { auto_sync: enabled, sync_interval_sec: row.sync_interval_sec || 3600 })
    row.auto_sync = enabled ? 1 : 0
    ElMessage.success(enabled ? '已开启定时同步' : '已关闭定时同步')
  } catch (e) {
    ElMessage.error(apiErrorMessage(e, '更新同步设置失败'))
  } finally {
    syncToggling.value = ''
  }
}

const runSyncNow = async (row) => {
  if (!row?.id) return
  syncNowing.value = row.id
  try {
    await syncDocNow(row.id)
    ElMessage.success('已同步')
    await load()
  } catch (e) {
    ElMessage.error(apiErrorMessage(e, '同步失败'))
  } finally {
    syncNowing.value = ''
  }
}

const remove = async (row) => {
  try {
    await ElMessageBox.confirm(`删除「${row.title}」？`, '删除文档', { type: 'warning' })
  } catch {
    return
  }
  try {
    await deleteDoc(row.id)
    ElMessage.success('已删除')
    if (detail.value?.id === row.id) drawerOpen.value = false
    await load()
  } catch (e) {
    ElMessage.error(apiErrorMessage(e, '删除失败'))
  }
}

watch(() => [props.appId, props.projectId], () => {
  searchHits.value = []
  load()
})

onMounted(load)
</script>

<template>
  <div class="doc-panel" :class="{ embedded }" v-loading="loading">
    <header v-if="!embedded" class="settings-page-header">
      <div>
        <h2 class="settings-page-title">文档库</h2>
        <p class="settings-page-desc">上传 PDF / Markdown，全文检索原始文档</p>
      </div>
      <div class="header-actions">
        <el-button @click="openFeishu">从飞书导入</el-button>
        <el-upload
          :auto-upload="false"
          :show-file-list="false"
          accept=".md,.markdown,.pdf"
          :disabled="uploading"
          :on-change="onUploadPick"
        >
          <el-button type="primary" :icon="Upload" :loading="uploading">上传文档</el-button>
        </el-upload>
      </div>
    </header>

    <div v-else class="embedded-toolbar">
      <div class="header-actions">
        <el-button size="small" @click="openFeishu">飞书导入</el-button>
        <el-upload
          :auto-upload="false"
          :show-file-list="false"
          accept=".md,.markdown,.pdf"
          :disabled="uploading"
          :on-change="onUploadPick"
        >
          <el-button type="primary" size="small" :icon="Upload" :loading="uploading">上传</el-button>
        </el-upload>
      </div>
      <el-radio-group v-model="panel" size="small">
        <el-radio-button value="list">列表</el-radio-button>
        <el-radio-button value="search">检索</el-radio-button>
      </el-radio-group>
    </div>

    <div v-if="!embedded" class="settings-toolbar">
      <el-radio-group v-model="panel" size="small">
        <el-radio-button value="list">文档列表</el-radio-button>
        <el-radio-button value="search">全文检索</el-radio-button>
      </el-radio-group>
    </div>

    <section v-if="panel === 'list'" class="settings-table-card">
      <el-table :data="items" border stripe size="small" empty-text="暂无文档" @row-click="openDetail">
        <el-table-column label="标题" min-width="200">
          <template #default="{ row }">
            <strong>{{ row.title }}</strong>
            <div class="sub-line">{{ row.original_filename }}</div>
          </template>
        </el-table-column>
        <el-table-column label="来源" width="88">
          <template #default="{ row }">{{ KIND_LABEL[row.source_kind] || row.source_kind || '上传' }}</template>
        </el-table-column>
        <el-table-column label="类型" width="88">
          <template #default="{ row }">{{ FILE_LABEL[row.file_type] || row.file_type }}</template>
        </el-table-column>
        <el-table-column label="分片" width="72" prop="chunk_count" />
        <el-table-column label="大小" width="88">
          <template #default="{ row }">{{ formatBytes(row.file_size) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="88">
          <template #default="{ row }">
            <el-tag size="small" :type="STATUS_TYPE[row.status] || 'info'" effect="light">
              {{ STATUS_LABEL[row.status] || row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="定时同步" width="100">
          <template #default="{ row }">
            <el-switch
              v-if="row.source_kind === 'feishu'"
              :model-value="!!row.auto_sync"
              :loading="syncToggling === row.id"
              @change="(v) => toggleAutoSync(row, v)"
              @click.stop
            />
            <span v-else class="sub-line">—</span>
          </template>
        </el-table-column>
        <el-table-column label="更新时间" width="168">
          <template #default="{ row }">{{ formatTime(row.updated_at) }}</template>
        </el-table-column>
        <el-table-column label="" width="220" @click.stop>
          <template #default="{ row }">
            <el-button
              v-if="row.source_kind === 'feishu'"
              link type="primary" size="small"
              :loading="syncNowing === row.id"
              @click.stop="runSyncNow(row)"
            >立即同步</el-button>
            <el-button
              v-if="row.status === 'ok'"
              link type="primary" size="small"
              :loading="extracting"
              @click.stop="extract(row)"
            >抽取知识</el-button>
            <el-button link type="danger" size="small" @click.stop="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <section v-else class="settings-table-card search-panel">
      <div class="search-bar">
        <el-input
          v-model="searchQ"
          clearable
          placeholder="检索文档正文…"
          :prefix-icon="Search"
          @keyup.enter="runSearch"
        />
        <el-button type="primary" :loading="searching" @click="runSearch">检索</el-button>
        <el-checkbox v-model="searchVector" label="向量增强" />
      </div>
      <el-table
        v-loading="searching"
        :data="searchHits"
        border stripe size="small"
        empty-text="输入关键词后检索"
        @row-click="(row) => openDetail({ id: row.source_id, title: row.title })"
      >
        <el-table-column label="文档" min-width="160" prop="title" />
        <el-table-column label="章节" width="140" prop="heading" show-overflow-tooltip />
        <el-table-column label="摘要" min-width="280" show-overflow-tooltip>
          <template #default="{ row }">{{ row.snippet || row.text }}</template>
        </el-table-column>
      </el-table>
    </section>

    <el-drawer v-model="drawerOpen" :size="640" :with-header="false" class="pack-drawer">
      <div class="pd-wrap" v-if="detail">
        <header class="pd-head">
          <h3 class="pd-title">{{ detail.title }}</h3>
          <p class="pd-meta">
            {{ FILE_LABEL[detail.file_type] || detail.file_type }}
            · {{ detail.chunk_count }} 片 · {{ formatBytes(detail.file_size) }}
          </p>
          <p v-if="detail.error_msg" class="pd-error">{{ detail.error_msg }}</p>
          <div v-if="detail.status === 'ok'" class="pd-actions">
            <el-button type="primary" size="small" :loading="extracting" @click="extract(detail)">
              抽取为执行知识（待审核）
            </el-button>
          </div>
        </header>
        <div class="chunk-list">
          <article v-for="ch in chunks" :key="ch.id" class="chunk-card">
            <h4 v-if="ch.heading">{{ ch.heading }}</h4>
            <pre>{{ ch.text }}</pre>
          </article>
          <p v-if="!chunks.length" class="empty-chunks">暂无分片</p>
        </div>
      </div>
    </el-drawer>

    <el-dialog v-model="feishuOpen" title="从飞书导入文档" width="520px">
      <el-form label-position="top">
        <el-form-item label="飞书机器人">
          <el-select v-model="feishuBotId" placeholder="选择机器人" style="width: 100%">
            <el-option v-for="b in larkBots" :key="b.id" :label="b.name" :value="b.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="文档链接">
          <el-input v-model="feishuUrl" placeholder="https://xxx.feishu.cn/wiki/..." />
        </el-form-item>
        <el-form-item label="标题（可选）">
          <el-input v-model="feishuTitle" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="feishuOpen = false">取消</el-button>
        <el-button type="primary" :loading="feishuSyncing" @click="syncFeishu">同步</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.doc-panel.embedded { padding-top: 0; }
.embedded-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  flex-wrap: wrap;
  gap: 8px;
}
.header-actions { display: flex; gap: 8px; align-items: center; }
.sub-line { font-size: 12px; color: var(--el-text-color-secondary); margin-top: 2px; }
.search-panel { padding-top: 4px; }
.search-bar { display: flex; gap: 8px; margin-bottom: 12px; max-width: 560px; }
.pd-wrap { padding: 4px 8px 24px; }
.pd-title { margin: 0; font-size: 16px; }
.pd-meta { margin: 6px 0 0; font-size: 13px; color: var(--el-text-color-secondary); }
.pd-error { color: var(--el-color-danger); font-size: 13px; }
.pd-actions { margin-top: 10px; }
.chunk-list { display: flex; flex-direction: column; gap: 12px; }
.chunk-card { border: 1px solid var(--el-border-color-lighter); border-radius: 8px; padding: 10px 12px; }
.chunk-card pre { margin: 0; white-space: pre-wrap; word-break: break-word; font-family: inherit; font-size: 13px; }
.empty-chunks { color: var(--el-text-color-secondary); font-size: 13px; }
</style>
