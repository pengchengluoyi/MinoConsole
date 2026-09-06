<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import {
  deleteKnowledgeItem,
  getTestingKnowledge,
  reviewKnowledgeItem,
  upsertKnowledgeItem,
} from '@/api/settings'
import { listProjects } from '@/api/project'
import { apiErrorMessage } from '@/utils/apiError'
import { parseProjectList } from '@/utils/catalog'
import '../Settings/settings-ui.css'

const STATUS_LABEL = { approved: '已通过', pending: '待审', rejected: '已驳回' }
const STATUS_TYPE = { approved: 'success', pending: 'warning', rejected: 'info' }

const loading = ref(false)
const saving = ref(false)
const items = ref([])
const apps = ref([])
const keyword = ref('')
const statusFilter = ref('')
const appFilter = ref('')

const drawerOpen = ref(false)
const editing = ref(null)
const form = ref(emptyForm())

function emptyForm() {
  return {
    id: '',
    title: '',
    content: '',
    category: '其他',
    tagsText: '',
    app_ids: [],
    enabled: true,
    source: 'manual',
    review_status: 'approved',
  }
}

const appName = (id) => apps.value.find((a) => a.id === id)?.name || id

const visible = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  return items.value.filter((row) => {
    if (statusFilter.value && row.review_status !== statusFilter.value) return false
    if (appFilter.value && !(row.app_ids || []).includes(appFilter.value)) return false
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
    app_ids: [...(row.app_ids || [])],
    enabled: row.enabled !== false,
    source: row.source || 'manual',
    review_status: row.review_status || 'approved',
  }
  drawerOpen.value = true
}

const payloadFromForm = () => ({
  id: form.value.id,
  title: form.value.title.trim(),
  content: form.value.content.trim(),
  category: form.value.category.trim() || '其他',
  tags: form.value.tagsText.split(/[,，]/).map((t) => t.trim()).filter(Boolean),
  app_ids: [...form.value.app_ids],
  enabled: form.value.enabled !== false,
  source: form.value.source || 'manual',
  review_status: form.value.review_status || 'approved',
})

const save = async () => {
  if (!form.value.title.trim()) {
    ElMessage.warning('先填标题')
    return
  }
  saving.value = true
  try {
    await upsertKnowledgeItem({ ...payloadFromForm(), id: form.value.id })
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

onMounted(load)
</script>

<template>
  <div class="settings-panel wide-panel" v-loading="loading">
    <header class="settings-page-header">
      <div>
        <h2 class="settings-page-title">知识库</h2>
      </div>
      <el-button type="primary" :icon="Plus" @click="openCreate">新建</el-button>
    </header>

    <div class="settings-toolbar">
      <el-input
        v-model="keyword"
        class="toolbar-search"
        clearable
        placeholder="搜标题 / 正文 / 标签"
        :prefix-icon="Search"
      />
      <el-select v-model="statusFilter" placeholder="审核状态" clearable class="filter-item">
        <el-option v-for="(label, value) in STATUS_LABEL" :key="value" :label="label" :value="value" />
      </el-select>
      <el-select v-model="appFilter" placeholder="应用" clearable filterable class="filter-item">
        <el-option
          v-for="a in apps"
          :key="a.id"
          :label="a.project ? `${a.project} / ${a.name}` : a.name"
          :value="a.id"
        />
      </el-select>
    </div>

    <section class="settings-table-card">
      <el-table :data="visible" border stripe size="small" empty-text="暂无知识" @row-click="openEdit">
        <el-table-column label="标题" min-width="180">
          <template #default="{ row }">
            <strong>{{ row.title }}</strong>
          </template>
        </el-table-column>
        <el-table-column label="分类" width="100" prop="category" />
        <el-table-column label="应用" min-width="140">
          <template #default="{ row }">
            <span v-if="!(row.app_ids || []).length">全部应用</span>
            <span v-else>{{ row.app_ids.map(appName).join('、') }}</span>
          </template>
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
            <el-button
              v-if="row.review_status === 'pending'"
              link
              type="primary"
              size="small"
              @click.stop="review(row, 'approve')"
            >通过</el-button>
            <el-button
              v-if="row.review_status === 'pending'"
              link
              size="small"
              @click.stop="review(row, 'reject')"
            >驳回</el-button>
            <el-button link type="danger" size="small" @click.stop="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <el-drawer v-model="drawerOpen" :size="560" :with-header="false" class="pack-drawer">
      <div class="pd-wrap">
        <header class="pd-head">
          <h3 class="pd-title">{{ editing ? '编辑知识' : '新建知识' }}</h3>
        </header>
        <el-form label-position="top" class="kn-form">
          <el-form-item label="标题">
            <el-input v-model="form.title" maxlength="80" show-word-limit />
          </el-form-item>
          <el-form-item label="分类">
            <el-input v-model="form.category" />
          </el-form-item>
          <el-form-item label="正文">
            <el-input v-model="form.content" type="textarea" :rows="10" />
          </el-form-item>
          <el-form-item label="标签">
            <el-input v-model="form.tagsText" placeholder="逗号分隔" />
          </el-form-item>
          <el-form-item label="适用应用">
            <el-select v-model="form.app_ids" multiple filterable clearable placeholder="空 = 全部应用">
              <el-option
                v-for="a in apps"
                :key="a.id"
                :label="a.project ? `${a.project} / ${a.name}` : a.name"
                :value="a.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="启用">
            <el-switch v-model="form.enabled" />
          </el-form-item>
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
.pd-wrap { padding: 4px 8px 24px; }
.pd-head { margin-bottom: 16px; }
.pd-title { margin: 0; font-size: 16px; }
.kn-form { margin-top: 8px; }
.pd-editor-bar { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
.filter-item { width: 140px; }
</style>
