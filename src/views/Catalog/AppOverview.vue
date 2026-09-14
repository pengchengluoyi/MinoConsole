<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { getAppDetail } from '@/api/project'
import { formatCreatedAt } from '@/utils/formatTime'
import { creatorName, displayText, parseAppDetail } from '@/utils/catalog'
import { useCatalogAppContext } from '@/composables/useCatalogAppContext'
import '../Settings/settings-ui.css'

const { loading, app, project, projectId, appId, projectName, appName, platforms } = useCatalogAppContext()

const detail = ref(null)
const showTech = ref(false)

const loadDetail = async () => {
  if (!appId.value) return
  try {
    const res = await getAppDetail(appId.value)
    detail.value = parseAppDetail(res)
  } catch {
    detail.value = null
  }
}

const merged = computed(() => ({
  ...(app.value || {}),
  ...(detail.value || {}),
  project_name: projectName.value,
  project_id: projectId.value,
}))

const stats = computed(() => merged.value.automation_stats || {})
const qa = computed(() => merged.value.qa_process || {})

const sections = computed(() => {
  const row = merged.value
  return [
    {
      title: '应用',
      items: [
        { label: '名称', value: row.name || appName.value },
        { label: '说明', value: row.description },
        { label: '覆盖端', value: platforms.value.join(' · ') },
        { label: '所属项目', value: row.project_name || projectName.value },
      ],
    },
    {
      title: '归属',
      items: [
        { label: '创建人', value: creatorName(row) },
        { label: '创建时间', value: formatCreatedAt(row.created_at) },
        { label: '更新时间', value: formatCreatedAt(row.updated_at) },
      ],
    },
    {
      title: '资产',
      items: [
        { label: '用例', value: String(stats.value.case_count ?? 0) },
        { label: '知识', value: String(stats.value.knowledge_count ?? 0) },
        { label: '图标槽', value: String(stats.value.icon_targets ?? 0) },
      ],
    },
  ]
})

const techItems = computed(() => {
  const row = merged.value
  return [
    { label: '应用 ID', value: row.id || appId.value },
    { label: 'UID', value: row.uid },
    { label: '项目 ID', value: row.project_id || projectId.value },
    { label: 'Android package', value: row.package },
    { label: 'iOS bundle', value: row.bundle },
    { label: 'Web', value: row.web_url },
    { label: '环境档位', value: qa.value.env_profile || row.env_profile },
  ]
})

onMounted(loadDetail)
watch(appId, loadDetail)
</script>

<template>
  <div class="app-overview" v-loading="loading">
    <section v-if="merged.icon" class="settings-card catalog-icon-card">
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

    <section class="settings-card">
      <button type="button" class="tech-toggle" @click="showTech = !showTech">
        {{ showTech ? '收起' : '展开' }}技术信息
      </button>
      <dl v-if="showTech" class="catalog-dl tech-dl">
        <div v-for="item in techItems" :key="item.label" class="catalog-dl-row">
          <dt>{{ item.label }}</dt>
          <dd>{{ displayText(item.value) }}</dd>
        </div>
      </dl>
    </section>
  </div>
</template>

<style scoped>
.catalog-dl {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px 16px;
  margin: 8px 0 0;
}
.catalog-dl-row dt { color: var(--settings-muted); font-size: 12px; }
.catalog-dl-row dd { margin: 4px 0 0; font-size: 13px; word-break: break-word; }
.catalog-icon { width: 64px; height: 64px; object-fit: contain; border-radius: 8px; }
.tech-toggle {
  border: none;
  background: none;
  color: var(--el-color-primary);
  font-size: 13px;
  cursor: pointer;
  padding: 0;
}
.tech-dl { margin-top: 12px; }
</style>
