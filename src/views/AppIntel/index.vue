<script setup>
import { watch } from 'vue'
import { useRouter } from 'vue-router'
import AppScopePicker from '@/components/AppScopePicker.vue'
import AppIntelPanel from '@/views/Catalog/panels/AppIntelPanel.vue'
import { useAppScopePicker } from '@/composables/useAppScopePicker'
import '../Settings/settings-ui.css'

const router = useRouter()
const {
  loading,
  cascaderOptions,
  cascaderValue,
  projectId,
  appId,
  openInCatalog,
} = useAppScopePicker()

const goCatalog = () => openInCatalog('intel')

watch([projectId, appId], ([pid, aid]) => {
  if (pid && aid) {
    router.replace({ query: { projectId: pid, appId: aid } })
  }
})
</script>

<template>
  <div class="settings-panel wide-panel">
    <header class="settings-page-header">
      <div>
        <h2 class="settings-page-title">信息基座（跨应用）</h2>
        <p class="settings-page-desc">
          日常维护请从「项目与应用 → 应用 → 信息基座」进入；此处供跨应用检索。
        </p>
      </div>
    </header>

    <div class="settings-toolbar">
      <AppScopePicker
        v-model="cascaderValue"
        :options="cascaderOptions"
        :loading="loading"
        catalog-tab="intel"
        @open-catalog="goCatalog"
      />
    </div>

    <AppIntelPanel
      v-if="appId"
      :key="appId"
      :app-id="appId"
      :project-id="projectId"
    />
    <el-empty v-else description="请选择项目与应用" />
  </div>
</template>
