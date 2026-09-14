<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCatalogAppContext } from '@/composables/useCatalogAppContext'
import '../Settings/settings-ui.css'

const route = useRoute()
const router = useRouter()
const {
  loading,
  appName,
  projectName,
  platforms,
  projectId,
  appId,
  backToProject,
} = useCatalogAppContext()

const activeTab = computed(() => {
  const name = String(route.name || '')
  if (name.includes('Knowledge')) return 'knowledge'
  if (name.includes('Docs')) return 'docs'
  if (name.includes('Intel')) return 'intel'
  return 'overview'
})

const tabs = [
  { id: 'overview', label: '概览', route: 'CatalogAppOverview' },
  { id: 'knowledge', label: '执行知识', route: 'CatalogAppKnowledge' },
  { id: 'docs', label: '文档库', route: 'CatalogAppDocs' },
  { id: 'intel', label: '信息基座', route: 'CatalogAppIntel' },
]

const goTab = (tab) => {
  router.push({
    name: tab.route,
    params: { projectId: projectId.value, appId: appId.value },
  })
}
</script>

<template>
  <div class="settings-panel wide-panel catalog-app-shell" v-loading="loading">
    <header class="settings-page-header">
      <div>
        <el-button text class="catalog-back" @click="backToProject">← {{ projectName || '返回项目' }}</el-button>
        <h2 class="settings-page-title">
          {{ appName || '应用' }}
          <span v-if="platforms.length" class="platform-tags">
            <span v-for="p in platforms" :key="p" class="platform-tag">{{ p }}</span>
          </span>
        </h2>
        <p class="settings-page-desc">应用级配置：执行知识、原始文档、信息基座与导航均归属此被测端</p>
      </div>
    </header>

    <nav class="app-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        class="app-tab"
        :class="{ active: activeTab === tab.id }"
        @click="goTab(tab)"
      >
        {{ tab.label }}
      </button>
    </nav>

    <div class="app-tab-body">
      <router-view />
    </div>
  </div>
</template>

<style scoped>
.catalog-back {
  margin: 0 0 6px -8px;
  color: var(--settings-muted);
}

.settings-page-desc {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.platform-tags {
  display: inline-flex;
  gap: 6px;
  margin-left: 8px;
  vertical-align: middle;
}

.platform-tag {
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--settings-soft, #f1f5f9);
  color: var(--settings-muted, #64748b);
}

.app-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  padding-bottom: 8px;
}

.app-tab {
  border: none;
  background: transparent;
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  color: var(--el-text-color-regular);
}

.app-tab.active {
  background: var(--el-color-primary-light-9, #ecf5ff);
  color: var(--el-color-primary);
  font-weight: 600;
}

.app-tab-body {
  min-height: 200px;
}
</style>
