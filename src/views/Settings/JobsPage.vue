<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import {
  getAIJobsHealth,
  listAIJobs,
  previewAIJob,
  saveAIJob,
} from '@/api/settings'
import TextDiffDialog from '@/components/TextDiffDialog.vue'
import { blocksToText, draftsToText } from '@/utils/promptDiff'
import './settings-ui.css'

const ENGINE_LABEL = {
  vision_decide: '看图决策',
  vision_assert: '视觉校验',
  observe: '观察',
  json_chat: 'JSON 对话',
  text_chat: '文本对话',
}

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const saving = ref(false)
const previewing = ref(false)
const jobs = ref([])
const health = ref({ ok: 0, broken: [] })
const keyword = ref('')
const selectedId = ref('')
const blockDrafts = ref([])
const previewText = ref('')
const revisions = ref([])
const promptVersion = ref(1)
const diffOpen = ref(false)
const diffMode = ref('publish')
const diffOldText = ref('')
const diffNewText = ref('')
const diffLeftLabel = ref('')
const diffRightLabel = ref('')
const diffShowConfirm = ref(true)

const filtered = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  if (!q) return jobs.value
  return jobs.value.filter((row) =>
    [row.id, row.label, row.summary, row.engine, row.role_id].join(' ').toLowerCase().includes(q),
  )
})

const selected = computed(() => jobs.value.find((row) => row.id === selectedId.value) || filtered.value[0] || null)

const engineLabel = (id) => ENGINE_LABEL[id] || id || '—'
const versionLabel = (v) => `v${Number(v || 1)}`

const sortedRevisions = computed(() =>
  [...revisions.value].sort((a, b) => Number(b.version || 0) - Number(a.version || 0)),
)

const syncQuery = () => {
  const job = String(route.query.job || '').trim()
  if (job) selectedId.value = job
  else if (!selectedId.value && jobs.value.length) selectedId.value = jobs.value[0].id
}

const selectJob = (row) => {
  selectedId.value = row.id
  router.replace({ query: { ...route.query, job: row.id } })
}

const loadBlocks = (row) => {
  blockDrafts.value = (row?.system_blocks || []).map((b, i) => ({
    id: b.id || `block-${i}`,
    text: b.text || '',
  }))
  revisions.value = list((row?.overrides_json || {}).revisions)
  promptVersion.value = Number(row?.prompt_version || 1)
}

const list = (v) => (Array.isArray(v) ? v : [])

const load = async () => {
  loading.value = true
  try {
    const [listRes, healthRes] = await Promise.all([listAIJobs(), getAIJobsHealth()])
    jobs.value = list(listRes?.data?.jobs)
    health.value = healthRes?.data || { ok: 0, broken: [] }
    syncQuery()
    if (selected.value) loadBlocks(selected.value)
  } catch (e) {
    ElMessage.error(e?.response?.data?.detail || e?.message || '加载 Jobs 失败')
  } finally {
    loading.value = false
  }
}

const dirty = computed(() => {
  if (!selected.value) return false
  const orig = selected.value.system_blocks || []
  return blockDrafts.value.some((b, i) => (b.text || '').trim() !== String((orig[i] || {}).text || '').trim())
})

const applyRow = (row) => {
  const idx = jobs.value.findIndex((j) => j.id === selected.value?.id)
  if (idx >= 0) jobs.value[idx] = row
  loadBlocks(row)
}

const publishedText = () => blocksToText(selected.value?.system_blocks || [])

const draftText = () => draftsToText(blockDrafts.value)

const openPublishDiff = () => {
  if (!selected.value || !dirty.value) return
  diffMode.value = 'publish'
  diffOldText.value = publishedText()
  diffNewText.value = draftText()
  diffLeftLabel.value = `生效 ${versionLabel(promptVersion.value)}`
  diffRightLabel.value = '本次变更'
  diffShowConfirm.value = true
  diffOpen.value = true
}

const openHistoryDiff = (rev) => {
  if (!selected.value || !rev) return
  diffMode.value = 'history'
  diffOldText.value = blocksToText(rev.system_blocks || [])
  diffNewText.value = dirty.value ? draftText() : publishedText()
  diffLeftLabel.value = `${versionLabel(rev.version)} · ${fmtRevTime(rev.at)}`
  diffRightLabel.value = dirty.value ? '当前编辑' : `生效 ${versionLabel(promptVersion.value)}`
  diffShowConfirm.value = false
  diffOpen.value = true
}

const save = async () => {
  if (!selected.value) return
  saving.value = true
  try {
    const system_blocks = blockDrafts.value.map((b) => ({ id: b.id, text: b.text }))
    const res = await saveAIJob(selected.value.id, { system_blocks })
    applyRow(res?.data || res)
    diffOpen.value = false
    ElMessage.success(res?.msg || `已保存 · ${versionLabel(promptVersion.value)} 生效`)
    const h = await getAIJobsHealth()
    health.value = h?.data || health.value
  } catch (e) {
    ElMessage.error(e?.response?.data?.detail || e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

const onDiffConfirm = async () => {
  if (diffMode.value === 'publish') await save()
}

const reset = async () => {
  if (!selected.value) return
  saving.value = true
  try {
    const res = await saveAIJob(selected.value.id, { reset: true })
    applyRow(res?.data || res)
    previewText.value = ''
    ElMessage.success(res?.msg || '已恢复上一版')
  } catch (e) {
    ElMessage.error(e?.response?.data?.detail || e?.message || '恢复失败')
  } finally {
    saving.value = false
  }
}

const activateVersion = async (rev) => {
  if (!selected.value || !rev?.version) return
  saving.value = true
  try {
    const res = await saveAIJob(selected.value.id, { activate_version: Number(rev.version) })
    applyRow(res?.data || res)
    previewText.value = ''
    ElMessage.success(`已启用 ${versionLabel(rev.version)} 的内容 · 当前 ${versionLabel(promptVersion.value)} 生效`)
  } catch (e) {
    ElMessage.error(e?.response?.data?.detail || e?.message || '启用失败')
  } finally {
    saving.value = false
  }
}

const preview = async () => {
  if (!selected.value) return
  previewing.value = true
  try {
    const system_blocks = blockDrafts.value.map((b) => ({ id: b.id, text: b.text }))
    const res = await previewAIJob(selected.value.id, { system_blocks })
    const messages = res?.data?.messages || []
    const meta = res?.data?.meta || {}
    const metaLine = meta.prompt_version ? `prompt ${versionLabel(meta.prompt_version)}` : ''
    previewText.value = [
      metaLine ? `# ${metaLine}${dirty.value ? '（草稿，未发布）' : ''}` : '',
      ...messages.map((m) => `[${m.role}]\n${typeof m.content === 'string' ? m.content : JSON.stringify(m.content, null, 2)}`),
    ].filter(Boolean).join('\n\n---\n\n')
  } catch (e) {
    ElMessage.error(e?.response?.data?.detail || e?.message || 'Preview 失败')
  } finally {
    previewing.value = false
  }
}

const fmtRevTime = (at) => {
  const s = String(at || '')
  if (!s) return '—'
  return s.replace('T', ' ').slice(0, 16)
}

watch(selected, (row) => {
  if (row) loadBlocks(row)
})

onMounted(load)
</script>

<template>
  <div class="settings-page jobs-page">
    <header class="jobs-head">
      <div class="jobs-head-copy">
        <div class="settings-kicker">AI · Prompt</div>
        <h1>Jobs</h1>
        <p>编辑 prompt → 保存即发布新版本。跑批 / 调用记录会带上当时生效的版本号。</p>
      </div>
      <div v-if="health.broken?.length" class="jobs-health jobs-health-warn">
        {{ health.broken.length }} 条渲染失败
      </div>
      <div v-else class="jobs-health jobs-health-ok">自检 {{ health.ok || 0 }} 条 OK</div>
    </header>

    <div class="jobs-shell">
      <aside class="jobs-nav" v-loading="loading">
        <div class="jobs-nav-head">
          <el-input v-model="keyword" placeholder="搜 id / 名称" clearable :prefix-icon="Search" />
          <span class="jobs-nav-count">{{ filtered.length }} 项</span>
        </div>
        <ul class="jobs-nav-list">
          <li
            v-for="row in filtered"
            :key="row.id"
            :class="{ active: row.id === selectedId }"
            @click="selectJob(row)"
          >
            <div class="jobs-nav-top">
              <strong>{{ row.label || row.id }}</strong>
              <span class="jobs-ver-pill">{{ versionLabel(row.prompt_version) }}</span>
            </div>
            <span class="jobs-nav-id">{{ row.id }}</span>
            <em>{{ engineLabel(row.engine) }}</em>
          </li>
        </ul>
      </aside>

      <div v-if="selected" class="jobs-main">
        <section class="jobs-card jobs-editor">
          <div class="jobs-card-head">
            <div>
              <div class="jobs-title-row">
                <h2>{{ selected.label }}</h2>
                <span class="jobs-active-ver">生效 {{ versionLabel(promptVersion) }}</span>
              </div>
              <p class="jobs-summary">{{ selected.summary }}</p>
              <div class="jobs-meta">
                <span>{{ selected.id }}</span>
                <span>{{ engineLabel(selected.engine) }}</span>
                <span v-if="selected.role_id">角色 {{ selected.role_id }}</span>
              </div>
            </div>
            <div class="jobs-actions">
              <button type="button" class="jobs-btn ghost" :disabled="previewing" @click="preview">
                {{ previewing ? '渲染中…' : 'Preview' }}
              </button>
              <button type="button" class="jobs-btn" :disabled="saving || !dirty" @click="openPublishDiff">
                {{ saving ? '保存中…' : '保存并发布' }}
              </button>
            </div>
          </div>

          <div class="jobs-editor-body">
            <div v-for="(block, i) in blockDrafts" :key="block.id + i" class="jobs-block">
              <label class="jobs-block-label">{{ block.id }}</label>
              <el-input
                v-model="block.text"
                type="textarea"
                resize="none"
                class="jobs-textarea"
              />
            </div>
          </div>
        </section>

        <aside class="jobs-side">
          <section class="jobs-card jobs-versions">
            <div class="jobs-side-head">
              <h3>版本历史</h3>
              <span class="jobs-side-hint">最近 20 条</span>
            </div>
            <p v-if="!sortedRevisions.length" class="jobs-empty">还没有历史版本，保存后会自动生成。</p>
            <ul v-else class="jobs-ver-list">
              <li v-for="rev in sortedRevisions" :key="rev.version + rev.at">
                <div class="jobs-ver-row">
                  <strong>{{ versionLabel(rev.version) }}</strong>
                  <time>{{ fmtRevTime(rev.at) }}</time>
                </div>
                <div class="jobs-ver-actions">
                  <button type="button" class="jobs-link" @click="openHistoryDiff(rev)">对比</button>
                  <button type="button" class="jobs-link" :disabled="saving" @click="activateVersion(rev)">
                    恢复此版
                  </button>
                </div>
              </li>
            </ul>
            <button
              type="button"
              class="jobs-btn ghost full"
              :disabled="saving || !sortedRevisions.length"
              @click="reset"
            >
              撤销到上一版
            </button>
          </section>

          <section class="jobs-card jobs-preview">
            <div class="jobs-side-head">
              <h3>Preview</h3>
              <button type="button" class="jobs-link" :disabled="previewing" @click="preview">
                {{ previewing ? '渲染中…' : '刷新' }}
              </button>
            </div>
            <p class="jobs-preview-hint">
              用占位 slot 渲染最终发给 LLM 的 messages，<strong>不调用模型</strong>。可直接预览未保存的草稿。
            </p>
            <pre v-if="previewText">{{ previewText }}</pre>
            <p v-else class="jobs-empty">点上方 Preview 或刷新，查看渲染结果。</p>
          </section>
        </aside>
      </div>
      <p v-else class="jobs-empty-main">选左侧一项 job</p>
    </div>

    <TextDiffDialog
      v-model:visible="diffOpen"
      :old-text="diffOldText"
      :new-text="diffNewText"
      :left-label="diffLeftLabel"
      :right-label="diffRightLabel"
      :confirm-text="diffConfirmText"
      :show-confirm="diffShowConfirm"
      :confirming="saving"
      @confirm="onDiffConfirm"
    />
  </div>
</template>

<style scoped>
.jobs-page {
  --jobs-accent: var(--mo-primary, #2563eb);
  --jobs-accent-soft: var(--mo-primary-soft, rgba(37, 99, 235, 0.1));
  --jobs-border: var(--mo-border, rgba(0, 0, 0, 0.08));
  --jobs-muted: var(--mo-muted, #64748b);
  --jobs-page-h: calc(100vh - 52px - 44px);
  display: flex;
  flex-direction: column;
  height: var(--jobs-page-h);
  min-height: 560px;
  overflow: hidden;
}

.jobs-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.85rem;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.jobs-head h1 {
  margin: 0.15rem 0 0.35rem;
  font-size: 1.5rem;
  font-weight: 650;
}

.jobs-head p {
  margin: 0;
  color: var(--jobs-muted);
  font-size: 0.9rem;
  max-width: 36rem;
}

.jobs-health {
  font-size: 0.82rem;
  padding: 0.35rem 0.85rem;
  border-radius: 999px;
  white-space: nowrap;
}

.jobs-health-ok { background: rgba(46, 160, 67, 0.12); color: #1a7f37; }
.jobs-health-warn { background: rgba(210, 80, 50, 0.12); color: #b42318; }

.jobs-shell {
  display: grid;
  grid-template-columns: 272px minmax(0, 1fr);
  gap: 0.85rem;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.jobs-nav {
  background: var(--mo-card, #fff);
  border: 1px solid var(--jobs-border);
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.jobs-nav-head {
  flex-shrink: 0;
  padding: 0.75rem 0.75rem 0.55rem;
  border-bottom: 1px solid var(--jobs-border);
  background: var(--mo-card, #fff);
}

.jobs-nav-count {
  display: block;
  margin-top: 0.45rem;
  font-size: 0.72rem;
  color: var(--jobs-muted);
  font-weight: 600;
}

.jobs-nav-list {
  list-style: none;
  margin: 0;
  padding: 0.45rem 0.55rem 0.65rem;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.jobs-nav-list li {
  padding: 0.65rem 0.7rem;
  border-radius: 10px;
  cursor: pointer;
  border: 1px solid transparent;
  margin-bottom: 0.35rem;
}

.jobs-nav-list li:hover { background: rgba(0, 0, 0, 0.03); }
.jobs-nav-list li.active {
  background: var(--jobs-accent-soft);
  border-color: rgba(37, 99, 235, 0.18);
}

.jobs-nav-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.jobs-nav-top strong {
  font-size: 0.92rem;
  line-height: 1.3;
}

.jobs-ver-pill {
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.12rem 0.45rem;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.06);
  color: var(--jobs-muted);
  flex-shrink: 0;
}

.jobs-nav-list li.active .jobs-ver-pill {
  background: rgba(37, 99, 235, 0.15);
  color: var(--jobs-accent);
}

.jobs-nav-id {
  display: block;
  font-size: 0.78rem;
  color: var(--jobs-muted);
  margin-top: 0.15rem;
}

.jobs-nav-list em {
  display: block;
  font-style: normal;
  font-size: 0.75rem;
  color: var(--jobs-muted);
  margin-top: 0.2rem;
}

.jobs-main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 272px;
  gap: 0.85rem;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.jobs-main > * {
  min-height: 0;
}

.jobs-card {
  background: var(--mo-card, #fff);
  border: 1px solid var(--jobs-border);
  border-radius: 14px;
  padding: 1rem 1.1rem;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.jobs-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.jobs-card-head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.85rem;
  flex-wrap: wrap;
  flex-shrink: 0;
  padding-bottom: 0.85rem;
  border-bottom: 1px solid var(--jobs-border);
}

.jobs-editor-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding-top: 0.15rem;
}

.jobs-title-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-wrap: wrap;
}

.jobs-title-row h2 {
  margin: 0;
  font-size: 1.15rem;
}

.jobs-active-ver {
  font-size: 0.78rem;
  font-weight: 650;
  color: var(--jobs-accent);
  background: var(--jobs-accent-soft);
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
}

.jobs-summary {
  margin: 0.35rem 0 0;
  color: var(--jobs-muted);
  font-size: 0.88rem;
}

.jobs-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem 0.85rem;
  margin-top: 0.45rem;
  font-size: 0.8rem;
  color: var(--jobs-muted);
}

.jobs-actions {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
}

.jobs-btn {
  border: 1px solid transparent;
  background: var(--jobs-accent);
  color: #fff;
  border-radius: 999px;
  padding: 0.45rem 1rem;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.jobs-btn:disabled { opacity: 0.45; cursor: not-allowed; }

.jobs-btn.ghost {
  background: transparent;
  color: var(--jobs-text, inherit);
  border-color: var(--jobs-border);
}

.jobs-btn.full { width: 100%; margin-top: 0.75rem; }

.jobs-block {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.jobs-block + .jobs-block {
  margin-top: 0.75rem;
  flex: 0 1 40%;
}

.jobs-block-label {
  display: block;
  flex-shrink: 0;
  font-size: 0.78rem;
  font-weight: 650;
  text-transform: lowercase;
  color: var(--jobs-muted);
  margin-bottom: 0.35rem;
}

.jobs-textarea {
  flex: 1;
  min-height: 0;
}

.jobs-textarea :deep(.el-textarea) {
  height: 100%;
}

.jobs-textarea :deep(textarea) {
  height: 100% !important;
  min-height: 0 !important;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.84rem;
  line-height: 1.58;
  padding: 0.85rem 0.95rem;
  background: #f8fafc;
  border-radius: 10px;
  resize: none;
  overflow-y: auto !important;
}

.jobs-textarea :deep(.el-textarea__inner:focus) {
  background: #fff;
}

.jobs-side {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  min-height: 0;
  overflow-y: auto;
}

.jobs-side-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 0.65rem;
}

.jobs-side-head h3 {
  margin: 0;
  font-size: 0.95rem;
}

.jobs-side-hint {
  font-size: 0.75rem;
  color: var(--jobs-muted);
}

.jobs-ver-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 360px;
  overflow: auto;
}

.jobs-ver-list li {
  padding: 0.55rem 0;
  border-bottom: 1px solid var(--jobs-border);
}

.jobs-ver-row {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.84rem;
}

.jobs-ver-row time {
  color: var(--jobs-muted);
  font-size: 0.75rem;
}

.jobs-link {
  margin-top: 0.25rem;
  padding: 0;
  border: 0;
  background: none;
  color: var(--jobs-accent);
  font-size: 0.78rem;
  cursor: pointer;
}

.jobs-link:disabled { opacity: 0.45; cursor: not-allowed; }

.jobs-ver-actions {
  display: flex;
  gap: 0.65rem;
  margin-top: 0.25rem;
}

.jobs-preview-hint {
  margin: 0 0 0.55rem;
  font-size: 0.76rem;
  line-height: 1.45;
  color: var(--jobs-muted);
}

.jobs-preview-hint strong {
  color: #334155;
  font-weight: 650;
}

.jobs-preview h3 {
  margin: 0 0 0.5rem;
  font-size: 0.95rem;
}

.jobs-preview pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 280px;
  overflow: auto;
  font-size: 0.75rem;
  line-height: 1.45;
  color: var(--jobs-muted);
}

.jobs-empty,
.jobs-empty-main {
  color: var(--jobs-muted);
  font-size: 0.85rem;
}

@media (max-width: 1100px) {
  .jobs-page {
    height: auto;
    min-height: 0;
    max-height: var(--jobs-page-h);
    overflow: hidden;
  }

  .jobs-shell {
    grid-template-columns: 1fr;
    overflow: visible;
  }

  .jobs-nav {
    max-height: 280px;
  }

  .jobs-main {
    grid-template-columns: 1fr;
    overflow: visible;
  }

  .jobs-editor {
    overflow: visible;
  }

  .jobs-editor-body {
    overflow: hidden;
  }
}
</style>

<style>
.admin-main:has(.jobs-page) {
  overflow: hidden;
}
</style>
