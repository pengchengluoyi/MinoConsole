<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getCaseResourceKeyCatalog } from '@/api/settings'
import './settings-ui.css'

const loading = ref(false)
const catalog = ref(null)

const sections = computed(() => catalog.value?.sections || [])
const entries = computed(() => catalog.value?.entries || [])

const sectionLabel = (id) => sections.value.find((s) => s.id === id)?.label || id

const grouped = computed(() => {
  const map = new Map()
  for (const row of entries.value) {
    const sid = row.section || 'other'
    if (!map.has(sid)) map.set(sid, [])
    map.get(sid).push(row)
  }
  return sections.value
    .map((s) => ({ section: s, rows: map.get(s.id) || [] }))
    .filter((g) => g.rows.length)
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
        <p class="page-lead page-lead-tight">
          Claim（锁）→ 用例前置 / <code>meta.resource_key</code> / <code>case_scene</code>；
          Lease（钥匙）→ 跑批生成，勿写入用例。
        </p>
      </div>
    </header>

    <section v-if="catalog" class="settings-card case-key-block">
      <h3 class="case-key-h3">前置编号行</h3>
      <pre class="case-key-pre">{{ catalog.example_precondition }}</pre>
      <p class="case-key-meta">
        落库：<code>{{ catalog.claim_storage?.primary }}</code>；
        文本编译：<code>{{ catalog.claim_storage?.fallback_compile_from?.join(', ') }}</code>
      </p>
    </section>

    <section v-if="catalog?.example_claim" class="settings-card case-key-block">
      <h3 class="case-key-h3">resource_key 示例（v{{ catalog.version }})</h3>
      <pre class="case-key-pre case-key-json">{{ JSON.stringify(catalog.example_claim, null, 2) }}</pre>
    </section>

    <section
      v-for="group in grouped"
      :key="group.section.id"
      class="settings-card case-key-block"
    >
      <h3 class="case-key-h3">{{ group.section.label }}</h3>
      <el-table :data="group.rows" size="small" border stripe>
        <el-table-column prop="write_category" label="前置类别" width="108" />
        <el-table-column label="写法示例" min-width="160">
          <template #default="{ row }">
            <span v-for="(ex, i) in row.write_examples || []" :key="i" class="case-key-ex">
              {{ ex }}<br v-if="i < row.write_examples.length - 1" />
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="claim_path" label="Claim 路径" min-width="200" show-overflow-tooltip />
        <el-table-column prop="resource" label="资源对象" width="168" show-overflow-tooltip />
        <el-table-column prop="config_keys" label="配置 / 字段" min-width="140">
          <template #default="{ row }">
            <template v-if="Array.isArray(row.config_keys)">
              <span v-for="(k, i) in row.config_keys" :key="k">{{ k }}<br v-if="i < row.config_keys.length - 1" /></span>
            </template>
            <span v-else>{{ row.config_keys }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="dsl" label="DSL / 枚举" min-width="160" show-overflow-tooltip />
        <el-table-column prop="runtime" label="跑批" min-width="140" show-overflow-tooltip />
      </el-table>
    </section>

    <section v-if="catalog?.lease_storage" class="settings-card case-key-block">
      <h3 class="case-key-h3">{{ sectionLabel('lease') }}</h3>
      <p class="case-key-meta">{{ catalog.lease_storage.note }}</p>
      <ul class="case-key-list">
        <li v-for="f in catalog.lease_storage.ctx_fields || []" :key="f"><code>{{ f }}</code></li>
      </ul>
    </section>
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
.case-key-pre {
  margin: 0;
  padding: 12px;
  font-size: 12px;
  line-height: 1.5;
  background: var(--el-fill-color-light);
  border-radius: 6px;
  white-space: pre-wrap;
  word-break: break-word;
}
.case-key-json {
  max-height: 360px;
  overflow: auto;
}
.case-key-meta {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.case-key-list {
  margin: 8px 0 0;
  padding-left: 1.2em;
  font-size: 12px;
}
.case-key-ex {
  font-size: 12px;
}
</style>
