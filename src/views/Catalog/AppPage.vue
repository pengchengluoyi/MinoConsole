<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getAppDetail, listProjects } from '@/api/project'
import { apiErrorMessage } from '@/utils/apiError'
import { formatCreatedAt } from '@/utils/formatTime'
import {
  creatorName,
  displayText,
  parseAppDetail,
  parseProjectList,
  platformTags,
} from '@/utils/catalog'
import '../Settings/settings-ui.css'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const app = ref(null)
const listed = ref(null)

const projectId = computed(() => String(route.params.projectId || ''))
const appId = computed(() => String(route.params.appId || ''))
const title = computed(() => app.value?.name || listed.value?.name || '未找到应用')
const merged = computed(() => ({ ...(listed.value || {}), ...(app.value || {}) }))
const platforms = computed(() => platformTags(merged.value.platforms))
const stats = computed(() => merged.value.automation_stats || {})
const qa = computed(() => merged.value.qa_process || {})

const sections = computed(() => {
  const row = merged.value
  return [
    {
      title: '应用',
      items: [
        { label: '名称', value: row.name || '未命名应用' },
        { label: 'ID', value: row.id },
        { label: 'UID', value: row.uid },
        { label: '说明', value: row.description },
        { label: '覆盖端', value: platforms.value.join(' · ') },
        { label: '所属项目', value: row.project_name },
        { label: '项目 ID', value: row.project_id || projectId.value },
      ],
    },
    {
      title: '归属',
      items: [
        { label: '创建人', value: creatorName(row) },
        { label: '创建人 ID', value: row.created_by },
        { label: '创建时间', value: formatCreatedAt(row.created_at) },
        { label: '更新时间', value: formatCreatedAt(row.updated_at) },
      ],
    },
    {
      title: '包体与环境',
      items: [
        { label: '环境档位', value: qa.value.env_profile || row.env_profile },
        { label: 'Android package', value: row.package },
        { label: 'iOS bundle', value: row.bundle },
        { label: 'Web', value: row.web_url },
      ],
    },
    {
      title: '资产',
      items: [
        { label: '用例', value: String(stats.value.case_count ?? 0) },
        { label: '图标槽', value: String(stats.value.icon_targets ?? 0) },
        { label: '知识', value: String(stats.value.knowledge_count ?? 0) },
        { label: '需求', value: qa.value.requirement_count != null ? String(qa.value.requirement_count) : '' },
        { label: '版本', value: qa.value.release_count != null ? String(qa.value.release_count) : '' },
        { label: '流程更新', value: qa.value.updated_at ? formatCreatedAt(qa.value.updated_at) : qa.value.updated_at },
      ],
    },
  ]
})

const back = () => {
  if (projectId.value) router.push({ name: 'CatalogProject', params: { projectId: projectId.value } })
  else router.push({ name: 'Catalog' })
}

const load = async () => {
  loading.value = true
  try {
    const [detailRes, list] = await Promise.all([
      getAppDetail(appId.value).catch(() => null),
      listProjects().catch(() => []),
    ])
    app.value = parseAppDetail(detailRes)
    const project = parseProjectList(list).find((p) => String(p.id) === projectId.value)
    listed.value = (project?.apps || []).find((a) => String(a.id) === appId.value) || null
    if (!app.value && listed.value) {
      app.value = {
        ...listed.value,
        project_id: projectId.value,
        project_name: project?.name,
      }
    }
  } catch (e) {
    app.value = null
    listed.value = null
    ElMessage.error(apiErrorMessage(e, '加载应用失败'))
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(appId, load)
</script>

<template>
  <div class="settings-panel wide-panel catalog-page" v-loading="loading">
    <header class="settings-page-header">
      <div>
        <el-button text class="catalog-back" @click="back">← {{ merged.project_name || '返回项目' }}</el-button>
        <h2 class="settings-page-title">{{ title }}</h2>
      </div>
    </header>

    <el-empty v-if="!app && !listed && !loading" description="未找到应用">
      <el-button type="primary" @click="back">返回项目</el-button>
    </el-empty>

    <template v-else>
      <section v-if="merged.icon" class="settings-card catalog-icon-card">
        <div class="settings-kicker">图标</div>
        <img :src="merged.icon" alt="" class="catalog-icon">
      </section>

      <section v-for="block in sections" :key="block.title" class="settings-card">
        <div class="settings-kicker">{{ block.title }}</div>
        <dl class="catalog-dl">
          <div v-for="item in block.items" :key="item.label" class="catalog-dl-row">
            <dt>{{ item.label }}</dt>
            <dd>{{ displayText(item.value) }}</dd>
          </div>
        </dl>
      </section>
    </template>
  </div>
</template>

<style scoped>
.catalog-back {
  margin: 0 0 6px -8px;
  color: var(--settings-muted);
}

.catalog-dl {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px 16px;
  margin: 8px 0 0;
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

.catalog-icon-card {
  margin-bottom: 12px;
}

.catalog-icon {
  display: block;
  margin-top: 8px;
  width: 64px;
  height: 64px;
  object-fit: contain;
  border-radius: 8px;
  background: var(--settings-soft);
}
</style>
