<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getAccountPoolTemplates, saveAccountPoolTemplates } from '@/api/settings'
import './settings-ui.css'

const loading = ref(false)
const saving = ref(false)
const categories = ref([])
const templates = ref([])
const extensionAddons = ref({})
const starterExtensions = ref([])

const editorOpen = ref(false)
const editing = ref(null)
/** 内置模板只编辑 extension_addons；自定义编辑完整 facet_extensions */
const editingAddonFields = ref([])

const customRows = computed(() => templates.value.filter((t) => !t.builtin))

const load = async () => {
  loading.value = true
  try {
    const res = await getAccountPoolTemplates()
    categories.value = res?.data?.categories || []
    templates.value = res?.data?.templates || []
    extensionAddons.value = res?.data?.extension_addons || {}
    starterExtensions.value = res?.data?.starter_extensions || []
  } catch (e) {
    ElMessage.error(e?.response?.data?.detail || e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function cloneFields(rows) {
  return JSON.parse(JSON.stringify(rows || []))
}

function newOption() {
  return { value: 'unknown', label: '未设置' }
}

function newField() {
  return {
    key: `field_${Date.now().toString(36).slice(-6)}`,
    label: '新字段',
    options: [newOption(), { value: 'yes', label: '是' }, { value: 'no', label: '否' }],
  }
}

const addCustom = () => {
  const id = `tpl_custom_${Date.now().toString(36)}`
  const row = {
    id,
    category: 'personal',
    label: '自定义模板',
    description: '',
    builtin: false,
    enabled: true,
    credential_fields: ['phone', 'email', 'password'],
    default_facets: { lifecycle: 'registered', session: 'logged_out', health: 'available' },
    facet_extensions: cloneFields(starterExtensions.value),
  }
  openEditor(row)
}

const openEditor = (row) => {
  editing.value = { ...row, facet_extensions: cloneFields(row.facet_extensions) }
  if (row.builtin) {
    editingAddonFields.value = cloneFields(extensionAddons.value[row.id] || [])
  } else {
    editingAddonFields.value = []
  }
  editorOpen.value = true
}

const editorFields = computed(() => {
  if (!editing.value) return []
  if (editing.value.builtin) {
    const baseKeys = new Set((editing.value.facet_extensions || []).map((f) => f.key))
    return editingAddonFields.value.filter((f) => !baseKeys.has(f.key))
  }
  return editing.value.facet_extensions || []
})

const setEditorFields = (fields) => {
  if (!editing.value) return
  if (editing.value.builtin) {
    editingAddonFields.value = fields
  } else {
    editing.value.facet_extensions = fields
  }
}

const addField = () => {
  setEditorFields([...editorFields.value, newField()])
}

const removeField = (idx) => {
  const next = [...editorFields.value]
  next.splice(idx, 1)
  setEditorFields(next)
}

const addOption = (field) => {
  if (!field.options) field.options = []
  field.options.push({ value: `v_${field.options.length}`, label: '选项' })
}

const removeOption = (field, idx) => {
  field.options.splice(idx, 1)
}

const applyEditor = () => {
  if (!editing.value) return
  const row = editing.value
  if (row.builtin) {
    extensionAddons.value = {
      ...extensionAddons.value,
      [row.id]: cloneFields(editingAddonFields.value),
    }
    const idx = templates.value.findIndex((t) => t.id === row.id)
    if (idx >= 0) {
      const merged = cloneFields(templates.value[idx].facet_extensions)
      const keys = new Set(merged.map((f) => f.key))
      for (const f of editingAddonFields.value) {
        if (!keys.has(f.key)) merged.push(cloneFields([f])[0])
      }
      templates.value[idx] = { ...templates.value[idx], facet_extensions: merged }
    }
  } else {
    const idx = customRows.value.findIndex((t) => t.id === row.id)
    const payload = {
      ...row,
      facet_extensions: cloneFields(row.facet_extensions),
    }
    if (idx >= 0) {
      const allIdx = templates.value.findIndex((t) => t.id === row.id)
      templates.value[allIdx] = payload
    } else {
      templates.value = [...templates.value, payload]
    }
  }
  editorOpen.value = false
}

const removeCustom = (id) => {
  templates.value = templates.value.filter((t) => t.id !== id || t.builtin)
}

const save = async () => {
  saving.value = true
  try {
    const res = await saveAccountPoolTemplates({
      templates: customRows.value,
      extension_addons: extensionAddons.value,
    })
    categories.value = res?.data?.categories || categories.value
    templates.value = res?.data?.templates || templates.value
    extensionAddons.value = res?.data?.extension_addons || extensionAddons.value
    ElMessage.success('已保存号池模板')
  } catch (e) {
    ElMessage.error(e?.response?.data?.detail || e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

const catLabel = (id) => categories.value.find((c) => c.id === id)?.label || id

onMounted(load)
</script>

<template>
  <div class="settings-panel" v-loading="loading">
    <header class="settings-page-header">
      <div>
        <h2 class="settings-page-title">号池业务模板</h2>
        <p class="page-lead">
          可<strong>新增模板</strong>；每个模板可<strong>添加自定义字段</strong>（内置模板追加字段，自定义模板可编辑全部字段）。
        </p>
      </div>
      <div class="settings-header-actions">
        <el-button @click="addCustom">新增模板</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </div>
    </header>

    <section class="settings-card">
      <el-table :data="templates" size="small" border stripe empty-text="无">
        <el-table-column prop="id" label="ID" width="148" />
        <el-table-column prop="label" label="名称" width="120" />
        <el-table-column label="类型" width="88">
          <template #default="{ row }">{{ row.builtin ? '内置' : '自定义' }}</template>
        </el-table-column>
        <el-table-column label="分类" width="100">
          <template #default="{ row }">{{ catLabel(row.category) }}</template>
        </el-table-column>
        <el-table-column prop="description" label="说明" min-width="160" show-overflow-tooltip />
        <el-table-column label="字段数" width="72" align="center">
          <template #default="{ row }">{{ (row.facet_extensions || []).length }}</template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openEditor(row)">字段</el-button>
            <el-button
              v-if="!row.builtin"
              link
              type="danger"
              size="small"
              @click="removeCustom(row.id)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <el-dialog
      v-model="editorOpen"
      :title="editing ? `模板字段 · ${editing.label}` : '模板字段'"
      width="720px"
      class="mo-fit-dialog"
      align-center
      append-to-body
      destroy-on-close
    >
      <template v-if="editing">
        <p v-if="editing.builtin" class="dlg-hint">
          内置模板的基础字段不可删改；此处添加的字段会追加到该模板，并出现在 Studio 号池编辑中。
        </p>
        <el-form label-width="88px" class="dlg-meta" v-if="!editing.builtin">
          <el-form-item label="ID">
            <el-input v-model="editing.id" />
          </el-form-item>
          <el-form-item label="名称">
            <el-input v-model="editing.label" />
          </el-form-item>
          <el-form-item label="分类">
            <el-select v-model="editing.category" style="width: 100%">
              <el-option v-for="c in categories" :key="c.id" :label="c.label" :value="c.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="说明">
            <el-input v-model="editing.description" type="textarea" :rows="2" />
          </el-form-item>
          <el-form-item label="启用">
            <el-switch v-model="editing.enabled" />
          </el-form-item>
        </el-form>

        <div class="field-toolbar">
          <strong>状态字段</strong>
          <el-button size="small" type="primary" @click="addField">添加字段</el-button>
        </div>

        <div v-for="(field, fi) in editorFields" :key="field.key + fi" class="field-card">
          <div class="field-head">
            <el-input v-model="field.key" size="small" placeholder="key" style="width: 140px" />
            <el-input v-model="field.label" size="small" placeholder="显示名" style="width: 160px" />
            <el-button
              v-if="!editing.builtin || !starterExtensions.some((s) => s.key === field.key)"
              link
              type="danger"
              size="small"
              @click="removeField(fi)"
            >
              删除字段
            </el-button>
          </div>
          <div class="opt-rows">
            <div v-for="(opt, oi) in field.options || []" :key="oi" class="opt-row">
              <el-input v-model="opt.value" size="small" placeholder="value" style="width: 120px" />
              <el-input v-model="opt.label" size="small" placeholder="标签" style="width: 140px" />
              <el-button link type="danger" size="small" @click="removeOption(field, oi)">删</el-button>
            </div>
            <el-button link type="primary" size="small" @click="addOption(field)">+ 选项</el-button>
          </div>
        </div>
      </template>
      <template #footer>
        <el-button @click="editorOpen = false">取消</el-button>
        <el-button type="primary" @click="applyEditor">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.dlg-hint {
  margin: 0 0 12px;
  font-size: 12px;
  color: #6b7280;
}
.field-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 12px 0 8px;
}
.field-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 10px;
}
.field-head {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}
.opt-rows {
  padding-left: 4px;
}
.opt-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 4px;
}
</style>
