<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { listPlugins } from '@/api/settings'
import { apiErrorMessage } from '@/utils/apiError'
import {
  PLUGIN_CATEGORIES,
  categoryLabel,
  normalizePluginCat,
  pluginCategories,
  pluginInCategory,
} from '@/utils/pluginCategories'
import './settings-ui.css'

const router = useRouter()
const loading = ref(false)
const plugins = ref([])
const cat = ref('all')

const visible = computed(() => plugins.value.filter((row) => pluginInCategory(row, cat.value)))
const enabledCount = computed(() => visible.value.filter((p) => p.enabled !== false).length)

const load = async () => {
  loading.value = true
  try {
    const res = await listPlugins()
    plugins.value = res?.data?.plugins || []
  } catch (e) {
    plugins.value = []
    ElMessage.error(apiErrorMessage(e, '加载插件失败'))
  } finally {
    loading.value = false
  }
}

const openPlugin = (row) => {
  if (!row?.id) return
  router.push({ name: 'PluginDetail', params: { pluginId: row.id } })
}

onMounted(load)
</script>

<template>
  <div class="settings-panel wide-panel" v-loading="loading">
    <header class="settings-page-header">
      <div>
        <h2 class="settings-page-title">插件策略</h2>
      </div>
      <div class="settings-summary-pill">{{ enabledCount }} 个已启用</div>
    </header>

    <div class="settings-tabbar is-compact">
      <button
        v-for="item in PLUGIN_CATEGORIES"
        :key="item.id"
        type="button"
        class="settings-tab"
        :class="{ active: cat === item.id }"
        @click="cat = normalizePluginCat(item.id)"
      >
        <strong>{{ item.label }}</strong>
        <span>{{ item.desc }}</span>
      </button>
    </div>

    <section class="settings-table-card">
      <el-table
        :data="visible"
        border
        stripe
        size="small"
        empty-text="暂无数据"
        class="plugins-table"
        @row-click="openPlugin"
      >
        <el-table-column label="名称" min-width="140">
          <template #default="{ row }">{{ row.name || row.id }}</template>
        </el-table-column>
        <el-table-column label="ID" min-width="100">
          <template #default="{ row }">{{ row.id }}</template>
        </el-table-column>
        <el-table-column label="分类" min-width="140">
          <template #default="{ row }">
            {{ pluginCategories(row).map(categoryLabel).join(' · ') || '—' }}
          </template>
        </el-table-column>
        <el-table-column label="策略" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="row.enabled !== false ? 'success' : 'info'">
              {{ row.enabled !== false ? '启用' : '关闭' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="说明" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">{{ row.summary || '—' }}</template>
        </el-table-column>
      </el-table>
    </section>
  </div>
</template>

<style scoped>
.plugins-table {
  cursor: pointer;
}
</style>
