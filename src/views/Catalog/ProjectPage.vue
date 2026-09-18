<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { listProjects } from '@/api/project'
import { apiErrorMessage } from '@/utils/apiError'
import { formatCreatedAt } from '@/utils/formatTime'
import {
  caseCountOf,
  creatorName,
  displayText,
  envLabels,
  knowledgeCountOf,
  parseProjectList,
  platformTags,
} from '@/utils/catalog'
import '../Settings/settings-ui.css'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const project = ref(null)

const projectId = computed(() => String(route.params.projectId || ''))
const labels = computed(() => envLabels(project.value?.env_summary || project.value?.env))
const facts = computed(() => {
  const p = project.value
  if (!p) return []
  return [
    { label: '名称', value: p.name || '未命名项目' },
    { label: 'ID', value: p.id },
    { label: 'UID', value: p.uid },
    { label: '说明', value: p.description },
    { label: '创建人', value: creatorName(p) },
    { label: '创建人 ID', value: p.created_by },
    { label: '创建时间', value: formatCreatedAt(p.created_at) },
    { label: '更新时间', value: formatCreatedAt(p.updated_at) },
    { label: '环境档位', value: labels.value.join(' · ') },
    { label: '应用数', value: String((p.apps || []).length) },
    { label: '用例数', value: String(caseCountOf(p)) },
    { label: '知识数（各应用合计）', value: String(knowledgeCountOf(p)) },
  ]
})

const load = async () => {
  loading.value = true
  try {
    const list = parseProjectList(await listProjects())
    project.value = list.find((p) => String(p.id) === projectId.value) || null
  } catch (e) {
    project.value = null
    ElMessage.error(apiErrorMessage(e, '加载项目失败'))
  } finally {
    loading.value = false
  }
}

const openApp = (app, tab = 'overview') => {
  if (!app?.id || !projectId.value) return
  const routes = {
    overview: 'CatalogAppOverview',
    knowledge: 'CatalogAppKnowledge',
    docs: 'CatalogAppDocs',
    intel: 'CatalogAppIntel',
  }
  router.push({
    name: routes[tab] || 'CatalogAppOverview',
    params: { projectId: projectId.value, appId: app.id },
  })
}

onMounted(load)
watch(projectId, load)
</script>

<template>
  <div class="settings-panel wide-panel catalog-page" v-loading="loading">
    <header class="settings-page-header">
      <div>
        <el-button text class="catalog-back" @click="router.push({ name: 'Catalog' })">← 项目与应用</el-button>
        <h2 class="settings-page-title">{{ project?.name || '未找到项目' }}</h2>
      </div>
      <div v-if="project" class="settings-summary-pill">{{ (project.apps || []).length }} 个应用</div>
    </header>

    <el-empty v-if="!project && !loading" description="未找到项目">
      <el-button type="primary" @click="router.push({ name: 'Catalog' })">返回目录</el-button>
    </el-empty>

    <template v-else-if="project">
      <section class="settings-card">
        <div class="settings-kicker">项目</div>
        <dl class="catalog-dl">
          <div v-for="item in facts" :key="item.label" class="catalog-dl-row">
            <dt>{{ item.label }}</dt>
            <dd>{{ displayText(item.value) }}</dd>
          </div>
        </dl>
      </section>

      <section class="settings-table-card">
        <div class="settings-kicker">应用</div>
        <el-table
          :data="project.apps || []"
          border
          stripe
          size="small"
          empty-text="暂无应用"
          class="catalog-table"
          @row-click="openApp"
        >
          <el-table-column label="名称" min-width="160">
            <template #default="{ row }">{{ row.name || '未命名应用' }}</template>
          </el-table-column>
          <el-table-column label="覆盖端" min-width="140">
            <template #default="{ row }">
              <span class="catalog-tags">
                <span v-for="t in platformTags(row.platforms)" :key="t" class="catalog-tag">{{ t }}</span>
                <span v-if="!platformTags(row.platforms).length">—</span>
              </span>
            </template>
          </el-table-column>
          <el-table-column label="用例" width="80">
            <template #default="{ row }">{{ caseCountOf(row) }}</template>
          </el-table-column>
          <el-table-column label="知识" width="80">
            <template #default="{ row }">{{ knowledgeCountOf(row) }}</template>
          </el-table-column>
          <el-table-column label="快捷入口" width="220" @click.stop>
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click.stop="openApp(row, 'docs')">文档</el-button>
              <el-button link type="primary" size="small" @click.stop="openApp(row, 'knowledge')">知识</el-button>
              <el-button link type="primary" size="small" @click.stop="openApp(row, 'intel')">信息基座</el-button>
            </template>
          </el-table-column>
          <el-table-column label="创建人" min-width="120">
            <template #default="{ row }">{{ creatorName(row) }}</template>
          </el-table-column>
          <el-table-column label="更新时间" min-width="160">
            <template #default="{ row }">{{ formatCreatedAt(row.updated_at || row.created_at) }}</template>
          </el-table-column>
        </el-table>
      </section>
    </template>
  </div>
</template>

<style scoped>
.catalog-back {
  margin: 0 0 6px -8px;
  color: var(--settings-muted);
}

.catalog-table {
  cursor: pointer;
}

.catalog-dl {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px 16px;
  margin: 8px 0 0;
}

.catalog-dl-row {
  min-width: 0;
}

.catalog-dl-row dt {
  color: var(--settings-muted);
  font-size: 12px;
}

.catalog-dl-row dd {
  margin: 4px 0 0;
  color: var(--settings-text);
  font-size: 13px;
  word-break: break-all;
}

.catalog-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.catalog-tag {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--settings-soft);
  color: var(--settings-muted);
  font-size: 11px;
}

.settings-table-card .settings-kicker {
  margin-bottom: 8px;
}
</style>
