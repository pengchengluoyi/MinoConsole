<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getResourceTransitionRules, patchResourceTransitionRule } from '@/api/settings'
import './settings-ui.css'

const loading = ref(false)
const rules = ref([])

const platformLabel = (p) => {
  const v = String(p || 'any')
  if (v === 'any') return '任意'
  if (v === 'android') return 'Android'
  if (v === 'ios') return 'iOS'
  if (v === 'web') return 'Web'
  return v
}

const effectSummary = (effects) => {
  const list = Array.isArray(effects) ? effects : []
  return list
    .map((e) => {
      if (!e || typeof e !== 'object') return ''
      const act = e.action || ''
      const src = e.source || e.stale_reason || ''
      return src ? `${act} (${src})` : act
    })
    .filter(Boolean)
    .join(' → ') || '—'
}

const grouped = computed(() => {
  const map = new Map()
  for (const row of rules.value) {
    const tid = row.trigger_id || 'other'
    if (!map.has(tid)) map.set(tid, [])
    map.get(tid).push(row)
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
})

const load = async () => {
  loading.value = true
  try {
    const res = await getResourceTransitionRules()
    rules.value = res?.data?.rules || []
  } catch (e) {
    ElMessage.error(e?.response?.data?.detail || e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

const setRuleEnabled = async (row, enabled) => {
  const next = Boolean(enabled)
  try {
    await patchResourceTransitionRule(row.rule_id, { enabled: next })
    row.enabled = next
    ElMessage.success(next ? '已启用' : '已停用')
  } catch (e) {
    ElMessage.error(e?.response?.data?.detail || e?.message || '更新失败')
  }
}

onMounted(load)
</script>

<template>
  <div class="settings-panel case-key-page" v-loading="loading">
    <header class="settings-page-header">
      <div>
        <h2 class="settings-page-title">转移规则</h2>
        <p class="page-lead page-lead-tight">
          能力 / 探测 / 路线图触发 <code>trigger_id</code>，经规则表写入机态与号池；跑批轨迹见 Session Log
          <code>resource/transition</code>。
        </p>
      </div>
      <el-button size="small" @click="load">刷新</el-button>
    </header>

    <section class="settings-card case-key-block">
      <p class="case-key-meta">
        可在此启停规则；effects 仍由 seed / 库维护。登出类 cap 白名单见 <code>resource_logout_caps.py</code>。
      </p>
    </section>

    <section
      v-for="[triggerId, rows] in grouped"
      :key="triggerId"
      class="settings-card case-key-block"
    >
      <h3 class="case-key-h3">trigger · {{ triggerId }}</h3>
      <el-table :data="rows" size="small" border stripe>
        <el-table-column prop="rule_id" label="规则 ID" min-width="160" show-overflow-tooltip />
        <el-table-column label="平台" width="88">
          <template #default="{ row }">{{ platformLabel(row.platform) }}</template>
        </el-table-column>
        <el-table-column label="启用" width="72" align="center">
          <template #default="{ row }">
            <el-switch :model-value="Boolean(row.enabled)" @change="(v) => setRuleEnabled(row, v)" />
          </template>
        </el-table-column>
        <el-table-column prop="label" label="说明" min-width="140" show-overflow-tooltip />
        <el-table-column label="effects" min-width="200">
          <template #default="{ row }">{{ effectSummary(row.effects) }}</template>
        </el-table-column>
      </el-table>
    </section>

    <el-empty v-if="!loading && !rules.length" description="暂无规则（检查 Nexus 是否已启动并完成 seed）" />
  </div>
</template>

<style scoped>
.case-key-page .page-lead-tight {
  margin-top: 4px;
  font-size: 13px;
}
.case-key-block {
  margin-bottom: 16px;
}
.case-key-h3 {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 600;
}
.case-key-meta {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
</style>
