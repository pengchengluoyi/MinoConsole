<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import {
  deleteKnowledgeItem,
  getTestingKnowledge,
  reviewKnowledgeItem,
  upsertKnowledgeItem,
} from '@/api/settings'
import { listProjects } from '@/api/project'
import { apiErrorMessage } from '@/utils/apiError'
import { parseProjectList } from '@/utils/catalog'
import '../../Settings/settings-ui.css'

const props = defineProps({
  appId: { type: String, required: true },
  projectId: { type: String, default: '' },
  embedded: { type: Boolean, default: true },
})

const STATUS_LABEL = { approved: '已通过', pending: '待审', rejected: '已驳回' }
const STATUS_TYPE = { approved: 'success', pending: 'warning', rejected: 'info' }

const loading = ref(false)
const saving = ref(false)
const items = ref([])
const apps = ref([])
const keyword = ref('')
const statusFilter = ref('')

const drawerOpen = ref(false)
const editing = ref(null)
const form = ref(emptyForm())
const showTechIds = ref(false)

function emptyForm() {
  return {
    id: '',
    title: '',
    content: '',
    category: '其他',
    tagsText: '',
    scopeIds: [],
    enabled: true,
    source: 'manual',
    review_status: 'approved',
  }
}

const appName = (id) => apps.value.find((a) => a.id === id)?.name || '应用'

function rowMatchesScope(row) {
  const ids = row.app_ids || []
  if (!ids.length) return true
  if (props.appId && ids.includes(props.appId)) return true
  if (props.projectId && ids.includes(props.projectId)) return true
  return false
}

const visible = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  return items.value.filter((row) => {
    if (!rowMatchesScope(row)) return false
    if (statusFilter.value && row.review_status !== statusFilter.value) return false
    if (!q) return true
    const hay = [row.title, row.content, row.category, ...(row.tags || [])].join(' ').toLowerCase()
    return hay.includes(q)
  })
})

const load = async () => {
  loading.value = true
  try {
    const [know, proj] = await Promise.all([
      getTestingKnowledge(),
      listProjects().catch(() => ({})),
    ])
    items.value = know?.data?.items || []
    const projects = parseProjectList(proj)
    apps.value = projects.flatMap((p) =>
      (p.apps || []).map((a) => ({
        id: a.id,
        name: a.name || a.id,
        project: p.name || p.id,
        project_id: p.id,
      })),
    )
  } catch (e) {
    items.value = []
    ElMessage.error(apiErrorMessage(e, '读取知识库失败'))
  } finally {
    loading.value = false
  }
}

const openCreate = () => {
  editing.value = null
  form.value = emptyForm()
  form.value.scopeIds = props.appId ? [props.appId] : []
  drawerOpen.value = true
}

const openEdit = (row) => {
  editing.value = row
  form.value = {
    id: row.id,
    title: row.title || '',
    content: row.content || '',
    category: row.category || '其他',
    tagsText: (row.tags || []).join(', '),
    scopeIds: [...(row.app_ids || [])],
    enabled: row.enabled !== false,
    source: row.source || 'manual',
    review_status: row.review_status || 'approved',
  }
  drawerOpen.value = true
}

const scopeLabel = (ids) => {
  if (!ids?.length) return '全部应用'
  return ids.map((id) => {
    if (id === props.projectId) return `项目：${props.projectId ? '本项目' : id}`
    return appName(id)
  }).join('、')
}

const save = async () => {
  if (!form.value.title.trim()) {
    ElMessage.warning('先填标题')
    return
  }
  saving.value = true
  try {
    await upsertKnowledgeItem({
      id: form.value.id,
      title: form.value.title.trim(),
      content: form.value.content.trim(),
      category: form.value.category.trim() || '其他',
      tags: form.value.tagsText.split(/[,，]/).map((t) => t.trim()).filter(Boolean),
      app_ids: [...form.value.scopeIds],
      enabled: form.value.enabled !== false,
      source: form.value.source || 'manual',
      review_status: form.value.review_status || 'approved',
    })
    ElMessage.success(form.value.id ? '已保存' : '已创建')
    drawerOpen.value = false
    await load()
  } catch (e) {
    ElMessage.error(apiErrorMessage(e, '保存失败'))
  } finally {
    saving.value = false
  }
}

const remove = async (row) => {
  try {
    await ElMessageBox.confirm(`删除「${row.title}」？`, '删除知识', { type: 'warning' })
  } catch {
    return
  }
  try {
    await deleteKnowledgeItem(row.id)
    ElMessage.success('已删除')
    await load()
  } catch (e) {
    ElMessage.error(apiErrorMessage(e, '删除失败'))
  }
}

const review = async (row, action) => {
  try {
    await reviewKnowledgeItem(row.id, { action })
    ElMessage.success(action === 'approve' ? '已通过' : '已驳回')
    await load()
  } catch (e) {
    ElMessage.error(apiErrorMessage(e, '审核失败'))
  }
}

watch(() => [props.appId, props.projectId], load)

onMounted(load)
</script>

<template>
  <div class="kn-panel" v-loading="loading">
    <div class="embedded-toolbar">
      <p class="scope-note muted">本应用可见：绑定本应用 / 本项目 / 或未限定范围的知识条</p>
      <el-button type="primary" size="small" :icon="Plus" @click="openCreate">新建</el-button>
    </div>

    <div class="settings-toolbar">
      <el-input v-model="keyword" class="toolbar-search" clearable placeholder="搜标题 / 正文 / 标签" />
      <el-select v-model="statusFilter" placeholder="审核状态" clearable class="filter-item">
        <el-option v-for="(label, value) in STATUS_LABEL" :key="value" :label="label" :value="value" />
      </el-select>
    </div>

    <section class="settings-table-card">
      <el-table :data="visible" border stripe size="small" empty-text="暂无知识" @row-click="openEdit">
        <el-table-column label="标题" min-width="180">
          <template #default="{ row }"><strong>{{ row.title }}</strong></template>
        </el-table-column>
        <el-table-column label="分类" width="100" prop="category" />
        <el-table-column label="生效范围" min-width="140">
          <template #default="{ row }">{{ scopeLabel(row.app_ids) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="STATUS_TYPE[row.review_status] || 'info'" effect="light">
              {{ STATUS_LABEL[row.review_status] || row.review_status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="" width="200" @click.stop>
          <template #default="{ row }">
            <el-button v-if="row.review_status === 'pending'" link type="primary" size="small" @click.stop="review(row, 'approve')">通过</el-button>
            <el-button v-if="row.review_status === 'pending'" link size="small" @click.stop="review(row, 'reject')">驳回</el-button>
            <el-button link type="danger" size="small" @click.stop="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <el-drawer v-model="drawerOpen" :size="560" :with-header="false">
      <div class="pd-wrap">
        <h3 class="pd-title">{{ editing ? '编辑知识' : '新建知识' }}</h3>
        <el-form label-position="top">
          <el-form-item label="标题"><el-input v-model="form.title" maxlength="80" show-word-limit /></el-form-item>
          <el-form-item label="分类"><el-input v-model="form.category" /></el-form-item>
          <el-form-item label="正文"><el-input v-model="form.content" type="textarea" :rows="10" /></el-form-item>
          <el-form-item label="标签"><el-input v-model="form.tagsText" placeholder="逗号分隔" /></el-form-item>
          <el-form-item label="生效范围（应用或项目）">
            <el-select v-model="form.scopeIds" multiple filterable clearable placeholder="空 = 全部应用">
              <el-option v-if="projectId" :label="`本项目（共享）`" :value="projectId" />
              <el-option
                v-for="a in apps.filter((x) => !appId || x.id === appId)"
                :key="a.id"
                :label="a.name"
                :value="a.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="启用"><el-switch v-model="form.enabled" /></el-form-item>
        </el-form>
        <div class="pd-editor-bar">
          <el-button @click="drawerOpen = false">取消</el-button>
          <el-button type="primary" :loading="saving" @click="save">保存</el-button>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<style scoped>
.embedded-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; gap: 8px; }
.scope-note { margin: 0; font-size: 13px; }
.filter-item { width: 140px; }
.pd-wrap { padding: 8px; }
.pd-title { margin: 0 0 12px; font-size: 16px; }
.pd-editor-bar { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
.muted { color: var(--el-text-color-secondary); }
</style>
