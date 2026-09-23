<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { getCaseResourceKeyCatalog } from '@/api/settings'
import './settings-ui.css'

const LAYER_FALLBACK = [
  { id: 'precondition', label: '前置' },
  { id: 'operation', label: '操作' },
  { id: 'expected', label: '预期' },
  { id: 'generic', label: '通用' },
]

const loading = ref(false)
const catalog = ref(null)
const keyword = ref('')
const layer = ref('all')
const section = ref('all')
const page = ref(1)
const pageSize = ref(10)

const sections = computed(() => catalog.value?.sections || [])
const layers = computed(() => catalog.value?.key_layers || LAYER_FALLBACK)
const entries = computed(() => catalog.value?.entries || [])
const prepFlow = computed(() => catalog.value?.prep_flow || null)

const layerLabel = (id) => layers.value.find((x) => x.id === id)?.label || id || '—'
const sectionLabel = (id) => sections.value.find((s) => s.id === id)?.label || id

const filtered = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  return entries.value.filter((row) => {
    if (layer.value !== 'all' && (row.key_layer || 'precondition') !== layer.value) return false
    if (section.value !== 'all' && (row.section || '') !== section.value) return false
    if (!q) return true
    const blob = [
      row.write_category,
      row.claim_path,
      row.resource,
      row.dsl,
      row.runtime,
      row.key_layer,
      ...(row.write_examples || []),
      ...(Array.isArray(row.config_keys) ? row.config_keys : [row.config_keys]),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return blob.includes(q)
  })
})

const paged = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filtered.value.slice(start, start + pageSize.value)
})

watch([keyword, layer, section, pageSize], () => {
  page.value = 1
})

const load = async () => {
  loading.value = true
  try {
    const res = await getCaseResourceKeyCatalog()
    catalog.value = res?.data || null
  } catch (e) {
    ElMessage.error(e?.response?.data?.detail || e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="settings-panel case-key-page" v-loading="loading">
    <header class="settings-page-header">
      <div>
        <h2 class="settings-page-title">用例密钥</h2>
        <p class="settings-page-desc">
          Claim（锁）写在前置编号行；Lease（钥匙）由跑批生成。
          设备登录态打机态，账号登录态打号池 session；账号与数据可用「字段名-状态」或直接写状态（如「已配置形象」）。
        </p>
      </div>
      <div class="settings-summary-pill is-muted">
        v{{ catalog?.version || '—' }} · {{ filtered.length }} / {{ entries.length }} 条
      </div>
    </header>

    <p v-if="prepFlow" class="case-key-prep">
      前置流程：
      <strong v-for="(s, i) in prepFlow.steps || []" :key="s.id">
        {{ s.label }}<span v-if="i < (prepFlow.steps || []).length - 1"> → </span>
      </strong>
      <span class="case-key-prep-drop">（已移除切换测试环境）</span>
    </p>
    <pre v-if="catalog?.example_precondition" class="case-key-pre">{{ catalog.example_precondition }}</pre>

    <div class="settings-toolbar">
      <el-select v-model="layer" class="filter-item" placeholder="层级">
        <el-option label="全部层级" value="all" />
        <el-option v-for="item in layers" :key="item.id" :label="item.label" :value="item.id" />
      </el-select>
      <el-select v-model="section" class="filter-item" placeholder="分组">
        <el-option label="全部分组" value="all" />
        <el-option v-for="s in sections" :key="s.id" :label="s.label" :value="s.id" />
      </el-select>
      <el-input
        v-model="keyword"
        class="toolbar-search"
        clearable
        placeholder="搜索类别 / 路径 / DSL"
        :prefix-icon="Search"
      />
    </div>

    <section class="settings-table-card">
      <el-table :data="paged" size="small" border stripe empty-text="无匹配条目">
        <el-table-column label="层级" width="88">
          <template #default="{ row }">{{ layerLabel(row.key_layer || 'precondition') }}</template>
        </el-table-column>
        <el-table-column prop="write_category" label="类别" width="128" show-overflow-tooltip />
        <el-table-column label="写法示例" min-width="180">
          <template #default="{ row }">
            <span v-for="(ex, i) in row.write_examples || []" :key="i" class="case-key-ex">
              {{ ex }}<br v-if="i < row.write_examples.length - 1" />
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="claim_path" label="Claim 路径" min-width="200" show-overflow-tooltip />
        <el-table-column prop="resource" label="资源对象" min-width="160" show-overflow-tooltip />
        <el-table-column label="配置 / 字段" min-width="140">
          <template #default="{ row }">
            <template v-if="Array.isArray(row.config_keys)">
              <span v-for="(k, i) in row.config_keys" :key="k">{{ k }}<br v-if="i < row.config_keys.length - 1" /></span>
            </template>
            <span v-else>{{ row.config_keys }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="dsl" label="DSL / 枚举" min-width="160" show-overflow-tooltip />
        <el-table-column prop="runtime" label="跑批" min-width="160" show-overflow-tooltip />
        <el-table-column label="分组" width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ sectionLabel(row.section) }}</template>
        </el-table-column>
      </el-table>
      <el-pagination
        class="settings-table-pager"
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="filtered.length"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        background
        small
      />
    </section>
  </div>
</template>

<style scoped>
.case-key-prep {
  margin: 0 0 8px;
  font-size: 12px;
  color: var(--el-text-color-regular);
}
.case-key-prep-drop {
  margin-left: 6px;
  color: var(--el-text-color-secondary);
}
.case-key-pre {
  margin: 0 0 12px;
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.5;
  background: var(--el-fill-color-light);
  border-radius: 6px;
  white-space: pre-wrap;
  word-break: break-word;
}
.case-key-ex {
  font-size: 12px;
}
</style>
