<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getPlugin, savePlugin } from '@/api/settings'
import { apiErrorMessage } from '@/utils/apiError'
import './settings-ui.css'

const route = useRoute()
const router = useRouter()
const pluginId = computed(() => String(route.params.pluginId || ''))
const loading = ref(false)
const saving = ref(false)
const plugin = ref(null)

const facts = computed(() => {
  const row = plugin.value || {}
  return [
    { label: '名称', value: row.name },
    { label: 'ID', value: row.id },
    { label: '分类', value: (row.categories || []).join(' · ') },
    { label: '说明', value: row.summary },
  ]
})

const applyPlugin = (row) => {
  plugin.value = row
}

const load = async () => {
  if (!pluginId.value) return
  loading.value = true
  try {
    const res = await getPlugin(pluginId.value)
    applyPlugin(res?.data || null)
  } catch (e) {
    plugin.value = null
    ElMessage.error(apiErrorMessage(e, '加载插件失败'))
  } finally {
    loading.value = false
  }
}

const toggleEnabled = async (on) => {
  saving.value = true
  try {
    const res = await savePlugin(pluginId.value, { enabled: !!on })
    applyPlugin(res?.data || plugin.value)
    ElMessage.success('已保存')
  } catch (e) {
    ElMessage.error(apiErrorMessage(e, '保存失败'))
  } finally {
    saving.value = false
  }
}

onMounted(load)
watch(pluginId, load)
</script>

<template>
  <div class="settings-panel wide-panel" v-loading="loading">
    <header class="settings-page-header">
      <div>
        <el-button text class="plugin-back" @click="router.push({ name: 'Plugins' })">← 插件策略</el-button>
        <h2 class="settings-page-title">{{ plugin?.name || '插件' }}</h2>
        <p class="settings-page-desc">
          Console 只管理是否对 Studio 用户开放；飞书、禅道等凭证请在 Studio「设置 → 插件」里由各人自行绑定。
        </p>
      </div>
      <div v-if="plugin" class="header-side">
        <el-tag size="small" :type="plugin.enabled !== false ? 'success' : 'info'">
          {{ plugin.enabled !== false ? '已启用' : '已关闭' }}
        </el-tag>
        <el-switch
          :model-value="plugin.enabled !== false"
          :loading="saving"
          @change="toggleEnabled"
        />
      </div>
    </header>

    <el-empty v-if="!plugin && !loading" description="暂无数据">
      <el-button type="primary" @click="router.push({ name: 'Plugins' })">返回</el-button>
    </el-empty>

    <template v-else-if="plugin">
      <section class="settings-card">
        <div class="settings-kicker">策略</div>
        <dl class="plugin-dl">
          <div v-for="item in facts" :key="item.label" class="plugin-dl-row">
            <dt>{{ item.label }}</dt>
            <dd>{{ item.value || '—' }}</dd>
          </div>
        </dl>
      </section>
    </template>
  </div>
</template>

<style scoped>
.plugin-back {
  margin: 0 0 6px -8px;
  color: var(--settings-muted);
}

.header-side {
  display: flex;
  align-items: center;
  gap: 10px;
}

.plugin-dl {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px 16px;
  margin: 8px 0 0;
}

.plugin-dl-row dt {
  color: var(--settings-muted);
  font-size: 12px;
}

.plugin-dl-row dd {
  margin: 4px 0 0;
  color: var(--settings-text);
  font-size: 13px;
  word-break: break-all;
}
</style>
