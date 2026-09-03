<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { listProjects } from '@/api/project'
import { apiErrorMessage } from '@/utils/apiError'
import { formatCreatedAt } from '@/utils/formatTime'
import {
  appCountOf,
  caseCountOf,
  creatorName,
  inventoryOf,
  parseProjectList,
} from '@/utils/catalog'
import '../Settings/settings-ui.css'

const router = useRouter()
const loading = ref(false)
const projects = ref([])
const keyword = ref('')

const inventory = computed(() => inventoryOf(projects.value))

const filtered = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  if (!q) return projects.value
  return projects.value.filter((p) => {
    const hay = [
      p.name,
      p.description,
      p.id,
      p.created_by_name,
      ...(p.apps || []).flatMap((a) => [a.name, a.id]),
    ].join(' ').toLowerCase()
    return hay.includes(q)
  })
})

const load = async () => {
  loading.value = true
  try {
    projects.value = parseProjectList(await listProjects())
  } catch (e) {
    projects.value = []
    ElMessage.error(apiErrorMessage(e, '加载项目失败'))
  } finally {
    loading.value = false
  }
}

const openProject = (p) => {
  if (!p?.id) return
  router.push({ name: 'CatalogProject', params: { projectId: p.id } })
}

onMounted(load)
</script>

<template>
  <div class="settings-panel wide-panel catalog-page" v-loading="loading">
    <header class="settings-page-header">
      <div>
        <h2 class="settings-page-title">项目与应用</h2>
      </div>
      <div class="settings-summary-pill">
        {{ inventory.projects }} 个项目 · {{ inventory.apps }} 个应用
      </div>
    </header>

    <div class="settings-toolbar">
      <el-input
        v-model="keyword"
        class="toolbar-search"
        clearable
        placeholder="按名称或创建人筛选"
      />
      <el-button text :loading="loading" class="toolbar-push" @click="load">刷新</el-button>
    </div>

    <section class="settings-table-card">
      <el-table
        :data="filtered"
        border
        stripe
        size="small"
        empty-text="暂无数据"
        class="catalog-table"
        @row-click="openProject"
      >
        <el-table-column label="名称" min-width="180">
          <template #default="{ row }">
            <span class="catalog-name">{{ row.name || '未命名项目' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="应用数" width="90">
          <template #default="{ row }">{{ appCountOf(row) }}</template>
        </el-table-column>
        <el-table-column label="用例数" width="90">
          <template #default="{ row }">{{ caseCountOf(row) }}</template>
        </el-table-column>
        <el-table-column label="创建人" min-width="120">
          <template #default="{ row }">{{ creatorName(row) }}</template>
        </el-table-column>
        <el-table-column label="更新时间" min-width="160">
          <template #default="{ row }">{{ formatCreatedAt(row.updated_at || row.created_at) }}</template>
        </el-table-column>
      </el-table>
    </section>
  </div>
</template>

<style scoped>
.catalog-table {
  cursor: pointer;
}

.catalog-name {
  font-weight: 600;
  color: var(--settings-text);
}
</style>
