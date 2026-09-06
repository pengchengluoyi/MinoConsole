<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getPack, setPackLifecycle, updatePack } from '@/api/packs'
import { apiErrorMessage, writeUnavailableMessage } from '@/utils/apiError'
import PackDryRunDialog from './PackDryRunDialog.vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  uid: { type: String, default: '' },
  inline: { type: Boolean, default: false },
  compact: { type: Boolean, default: false },
  row: { type: Object, default: null },
  fixture: { type: Boolean, default: false },
  writable: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'changed'])

const loading = ref(false)
const saving = ref(false)
const item = ref(null)
const form = ref(null)
const payloadErrors = ref({})
const newPayloadKey = ref('')
const dryRunOpen = ref(false)

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const PLATFORM_OPTIONS = ['android', 'ios', 'web', 'mac', 'windows']
const VISIBLE_OPTIONS = ['case', 'system']
const LIFECYCLE_OPTIONS = [
  { value: 'active', label: '生效中' },
  { value: 'draft', label: '待启用' },
  { value: 'deprecated', label: '已停用' },
]
const PAYLOAD_LABEL = {
  event_kind: 'event_kind',
  needs_vlm: 'needs_vlm',
  implementations: 'implementations',
  params: 'params',
  ui: 'ui',
  provides: 'provides',
  available_when: 'available_when',
  conditional_provides: 'conditional_provides',
  probe: 'probe',
  note: 'note',
  caller: 'caller',
  returns: 'returns',
  when: 'when',
  mode: 'mode',
  match: 'match',
  actions: 'actions',
  verify: 'verify',
  forbid: 'forbid',
  prompt_snippet: 'prompt_snippet',
  evidence_notes: 'evidence_notes',
  max_attempts: 'max_attempts',
  priority: 'priority',
  trigger_phrases: 'trigger_phrases',
}

const LIFECYCLE_LABEL = Object.fromEntries(LIFECYCLE_OPTIONS.map((o) => [o.value, o.label]))

const canWrite = computed(() => !props.fixture && props.writable && !props.compact && !!(item.value?.uid || props.uid))
const canPreview = computed(() => !props.fixture && !!(props.uid || item.value?.uid))

const itemStatus = computed(() => {
  const row = form.value || item.value || {}
  if (row.lifecycle === 'deprecated' || row.enabled === false) return 'deprecated'
  if (row.lifecycle === 'draft' || row.lifecycle === 'review' || row.lifecycle === 'pending') return 'pending'
  return 'active'
})

const classifyPayload = (value) => {
  if (typeof value === 'boolean') return { kind: 'bool', value }
  if (typeof value === 'number' && Number.isFinite(value)) return { kind: 'number', value }
  if (typeof value === 'string') {
    return {
      kind: value.length > 80 || value.includes('\n') ? 'textarea' : 'text',
      value,
    }
  }
  if (Array.isArray(value) && value.every((x) => typeof x === 'string' || typeof x === 'number')) {
    return { kind: 'tags', value: value.map((x) => String(x)) }
  }
  return { kind: 'json', value: JSON.stringify(value ?? null, null, 2) }
}

const hydrate = (row) => {
  const payload = row?.payload && typeof row.payload === 'object' ? row.payload : {}
  const cells = {}
  const order = [...Object.keys(PAYLOAD_LABEL).filter((k) => k in payload), ...Object.keys(payload).filter((k) => !(k in PAYLOAD_LABEL)).sort()]
  for (const key of order) {
    cells[key] = classifyPayload(payload[key])
  }
  form.value = {
    display_name: row?.display_name || '',
    description: row?.description || '',
    category: row?.category || '',
    enabled: row?.enabled !== false,
    lifecycle: row?.lifecycle || 'active',
    provider: row?.provider || '',
    owner: row?.owner || '',
    platforms: [...(row?.platforms || [])],
    visible_to: [...(row?.visible_to || [])],
    sort_order: Number(row?.sort_order || 0),
    payload: cells,
  }
  payloadErrors.value = {}
}

const load = async () => {
  if (!props.uid) return
  if (props.fixture) {
    item.value = props.row
    hydrate(props.row || {})
    return
  }
  loading.value = true
  try {
    const res = await getPack(props.uid)
    item.value = res?.data?.item || props.row
    hydrate(item.value || {})
  } catch (e) {
    ElMessage.error(apiErrorMessage(e, '读取条目详情失败'))
    item.value = props.row
    hydrate(props.row || {})
  } finally {
    loading.value = false
  }
}

watch(() => [props.modelValue, props.uid], ([open]) => {
  if (open) {
    item.value = props.row
    hydrate(props.row || {})
    load()
  }
}, { immediate: true })

const payloadRows = computed(() => {
  const cells = form.value?.payload || {}
  return Object.keys(cells).map((key) => ({
    key,
    label: PAYLOAD_LABEL[key] || key,
    cell: cells[key],
  }))
})

const buildPayload = () => {
  const out = {}
  const errors = {}
  for (const [key, cell] of Object.entries(form.value?.payload || {})) {
    if (cell.kind === 'json') {
      const raw = String(cell.value ?? '').trim()
      if (!raw) {
        out[key] = null
        continue
      }
      try {
        out[key] = JSON.parse(raw)
      } catch {
        errors[key] = 'JSON 无法解析'
      }
    } else if (cell.kind === 'number') {
      out[key] = Number(cell.value || 0)
    } else if (cell.kind === 'bool') {
      out[key] = !!cell.value
    } else if (cell.kind === 'tags') {
      out[key] = [...(cell.value || [])]
    } else {
      out[key] = cell.value
    }
  }
  payloadErrors.value = errors
  return { payload: out, ok: !Object.keys(errors).length }
}

const toggleEnabled = async () => {
  if (!canWrite.value) return
  const on = !form.value.enabled || form.value.lifecycle !== 'active'
  try {
    const res = await setPackLifecycle(props.uid, {
      lifecycle: on ? 'active' : 'deprecated',
      enabled: on,
    })
    item.value = res?.data?.item || item.value
    hydrate(item.value || {})
    ElMessage.success(on ? '已启用' : '已停用')
    emit('changed')
  } catch (e) {
    ElMessage.error(writeUnavailableMessage(e, '操作失败'))
  }
}

const addPayloadKey = () => {
  const key = newPayloadKey.value.trim()
  if (!key) return
  if (form.value.payload[key]) {
    ElMessage.warning('已有同名字段')
    return
  }
  form.value.payload[key] = { kind: 'text', value: '' }
  newPayloadKey.value = ''
}

const removePayloadKey = (key) => {
  const next = { ...form.value.payload }
  delete next[key]
  form.value.payload = next
}

const save = async () => {
  if (!canWrite.value || !item.value) return
  const { payload, ok } = buildPayload()
  if (!ok) {
    ElMessage.error('payload 里有无法解析的 JSON')
    return
  }
  saving.value = true
  try {
    const res = await updatePack(props.uid, {
      root: 'builtin',
      kind: item.value.kind,
      id: item.value.id,
      display_name: form.value.display_name,
      title: form.value.display_name,
      description: form.value.description,
      enabled: form.value.enabled,
      lifecycle: form.value.lifecycle,
      provider: form.value.provider,
      owner: form.value.owner,
      platforms: form.value.platforms,
      visible_to: form.value.visible_to,
      category: form.value.category,
      sort_order: form.value.sort_order,
      payload,
    })
    item.value = res?.data?.item || item.value
    hydrate(item.value || {})
    ElMessage.success(res?.msg || '已保存')
    emit('changed')
  } catch (e) {
    ElMessage.error(writeUnavailableMessage(e, '保存失败'))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <el-drawer v-if="!props.inline" v-model="visible" :size="760" :with-header="false" class="pack-drawer">
    <div v-loading="loading" class="pd-wrap">
      <header v-if="item && form" class="pd-head">
        <div class="pd-title-row">
          <h3 class="pd-title">{{ form.display_name || item.title || item.id }}</h3>
          <el-tag size="small" :type="itemStatus === 'active' ? 'success' : 'info'" effect="light">
            {{ LIFECYCLE_LABEL[form.lifecycle] || form.lifecycle }}
          </el-tag>
        </div>
        <div class="pd-actions-bar">
          <el-button v-if="canPreview" size="small" type="primary" plain @click="dryRunOpen = true">预演</el-button>
          <el-button
            v-if="canWrite" size="small"
            :type="form.lifecycle === 'active' ? 'danger' : 'success'"
            plain
            @click="toggleEnabled"
          >
            {{ form.lifecycle === 'active' ? '停用' : '启用' }}
          </el-button>
          <el-button v-if="canWrite" size="small" type="primary" :loading="saving" @click="save">保存</el-button>
        </div>
        <div class="pd-meta">
          <code class="pd-id">{{ item.uid || item.id }}</code>
        </div>
      </header>

      <div v-if="form" class="pd-form">
        <dl class="pd-dl">
          <dt>kind</dt>
          <dd><el-input :model-value="item?.kind" disabled /></dd>
          <dt>标识</dt>
          <dd><el-input :model-value="item?.id" disabled /></dd>
          <dt>显示名</dt>
          <dd><el-input v-model="form.display_name" :disabled="!canWrite" /></dd>
          <dt>描述</dt>
          <dd><el-input v-model="form.description" type="textarea" :autosize="{ minRows: 2, maxRows: 8 }" :disabled="!canWrite" /></dd>
          <dt>类别</dt>
          <dd><el-input v-model="form.category" :disabled="!canWrite" /></dd>
          <dt>启用</dt>
          <dd><el-switch v-model="form.enabled" :disabled="!canWrite" /></dd>
          <dt>生命周期</dt>
          <dd>
            <el-select v-model="form.lifecycle" :disabled="!canWrite" style="width: 100%">
              <el-option v-for="o in LIFECYCLE_OPTIONS" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
          </dd>
          <dt>提供方</dt>
          <dd><el-input v-model="form.provider" :disabled="!canWrite" /></dd>
          <dt>所有者</dt>
          <dd><el-input v-model="form.owner" :disabled="!canWrite" /></dd>
          <dt>平台</dt>
          <dd>
            <el-select v-model="form.platforms" multiple filterable allow-create default-first-option :disabled="!canWrite" style="width: 100%">
              <el-option v-for="p in PLATFORM_OPTIONS" :key="p" :label="p" :value="p" />
            </el-select>
          </dd>
          <dt>可见范围</dt>
          <dd>
            <el-select v-model="form.visible_to" multiple filterable allow-create default-first-option :disabled="!canWrite" style="width: 100%">
              <el-option v-for="p in VISIBLE_OPTIONS" :key="p" :label="p" :value="p" />
            </el-select>
          </dd>
          <dt>排序</dt>
          <dd><el-input-number v-model="form.sort_order" :disabled="!canWrite" :step="1" controls-position="right" /></dd>
        </dl>

        <h4 class="pd-sub">payload</h4>
        <dl class="pd-dl">
          <template v-for="row in payloadRows" :key="row.key">
            <dt>
              {{ row.label }}
              <el-button v-if="canWrite" link type="danger" size="small" @click="removePayloadKey(row.key)">删</el-button>
            </dt>
            <dd>
              <el-switch v-if="row.cell.kind === 'bool'" v-model="row.cell.value" :disabled="!canWrite" />
              <el-input-number
                v-else-if="row.cell.kind === 'number'"
                v-model="row.cell.value"
                :disabled="!canWrite"
                controls-position="right"
              />
              <el-select
                v-else-if="row.cell.kind === 'tags'"
                v-model="row.cell.value"
                multiple
                filterable
                allow-create
                default-first-option
                :disabled="!canWrite"
                style="width: 100%"
              />
              <el-input
                v-else-if="row.cell.kind === 'textarea' || row.cell.kind === 'json'"
                v-model="row.cell.value"
                type="textarea"
                :autosize="{ minRows: row.cell.kind === 'json' ? 6 : 2, maxRows: 18 }"
                :disabled="!canWrite"
                class="pd-json"
              />
              <el-input v-else v-model="row.cell.value" :disabled="!canWrite" />
              <p v-if="payloadErrors[row.key]" class="pd-err">{{ payloadErrors[row.key] }}</p>
            </dd>
          </template>
        </dl>
        <div v-if="canWrite" class="pd-add">
          <el-input v-model="newPayloadKey" placeholder="新增 payload 字段名" @keyup.enter="addPayloadKey" />
          <el-button @click="addPayloadKey">添加字段</el-button>
        </div>
        <div v-if="canWrite" class="pd-foot">
          <el-button type="primary" :loading="saving" @click="save">保存</el-button>
        </div>
      </div>
    </div>

    <PackDryRunDialog
      v-model="dryRunOpen"
      :uid="uid"
      :title="form?.display_name || item?.title || item?.id || ''"
      :mode="item?.payload?.mode || ''"
    />
  </el-drawer>

  <div v-else v-if="visible" v-loading="loading" class="pd-wrap pd-inline" :class="{ compact }">
    <p v-if="item" class="pd-id">{{ item.uid || item.id }}</p>
    <p class="pd-empty">请在抽屉中编辑</p>
  </div>
</template>

<style scoped>
.pd-wrap { padding: 4px 4px 24px; }
.pd-inline { width: 100%; }
.pd-head { padding: 8px 4px 12px; border-bottom: 1px solid var(--el-border-color-lighter); }
.pd-title-row { display: flex; align-items: center; gap: 8px; }
.pd-title { margin: 0; font-size: 17px; font-weight: 600; }
.pd-meta { display: flex; align-items: center; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
.pd-id { font-size: 12px; color: var(--el-text-color-placeholder); }
.pd-actions-bar { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
.pd-form { margin-top: 12px; }
.pd-sub { margin: 20px 0 10px; font-size: 13px; font-weight: 600; color: var(--el-text-color-regular); }
.pd-dl { margin: 0; display: grid; grid-template-columns: 132px 1fr; gap: 12px 14px; align-items: start; }
.pd-dl dt { font-size: 12px; color: var(--el-text-color-secondary); padding-top: 8px; display: flex; align-items: center; gap: 6px; }
.pd-dl dd { margin: 0; min-width: 0; }
.pd-json :deep(textarea) { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
.pd-err { margin: 4px 0 0; font-size: 12px; color: var(--el-color-danger); }
.pd-add { display: flex; gap: 8px; margin-top: 16px; }
.pd-foot { margin-top: 20px; }
.pd-empty { color: var(--el-text-color-placeholder); font-size: 13px; }
</style>
