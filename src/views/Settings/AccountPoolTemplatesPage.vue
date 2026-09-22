<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  deleteAccountPoolCustomTemplate,
  getAccountPoolTemplates,
  saveAccountPoolBuiltinFields,
  saveAccountPoolCustomTemplate,
} from '@/api/settings'
import TemplateFieldsEditorDialog from '@/components/accountPool/TemplateFieldsEditorDialog.vue'
import { cloneFields, fieldSummary, listFieldSummaries } from '@/utils/accountPoolFieldEditor'
import './settings-ui.css'

const loading = ref(false)
const saving = ref(false)
const categories = ref([])
const templates = ref([])
const extensionAddons = ref({})
const starterExtensions = ref([])
const templateGuide = ref('')
const accountCoreFacets = ref([])
const facetDataKinds = ref({})

const editorOpen = ref(false)
const editing = ref(null)
const editorMode = ref('custom')
const editorBaseFields = ref([])
const editorLockedKeys = ref([])

const customRows = computed(() => templates.value.filter((t) => !t.builtin))

const load = async () => {
  loading.value = true
  try {
    const res = await getAccountPoolTemplates()
    categories.value = res?.data?.categories || []
    templates.value = res?.data?.templates || []
    extensionAddons.value = res?.data?.extension_addons || {}
    starterExtensions.value = res?.data?.starter_extensions || []
    templateGuide.value = String(res?.data?.guide || '').trim()
    accountCoreFacets.value = res?.data?.account_core_facets || []
    facetDataKinds.value = res?.data?.facet_data_kinds || {}
  } catch (e) {
    ElMessage.error(e?.response?.data?.detail || e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

const applyCatalog = (res) => {
  categories.value = res?.data?.categories || categories.value
  templates.value = res?.data?.templates || templates.value
  extensionAddons.value = res?.data?.extension_addons || extensionAddons.value
}

const addonFieldsFor = (row) => {
  const baseKeys = new Set((row.facet_extensions || []).map((f) => f.key))
  const addons = cloneFields(extensionAddons.value[row.id] || [])
  return addons.filter((f) => !baseKeys.has(f.key))
}

const allCustomFieldsFor = (row) => {
  if (row.builtin) return addonFieldsFor(row)
  return row.facet_extensions || []
}

const addCustom = () => {
  const id = `tpl_custom_${Date.now().toString(36)}`
  openEditor({
    id,
    category: 'personal',
    label: '自定义模板',
    description: '',
    builtin: false,
    enabled: true,
    credential_fields: ['phone', 'email', 'password'],
    default_facets: { lifecycle: 'registered', session: 'logged_out', health: 'available' },
    facet_extensions: cloneFields(starterExtensions.value),
  })
}

const openEditor = (row) => {
  if (row.builtin) {
    editorMode.value = 'builtin'
    editorBaseFields.value = cloneFields(row.builtin_facet_extensions || row.facet_extensions || [])
    editorLockedKeys.value = editorBaseFields.value.map((f) => f.key)
    editing.value = {
      ...row,
      builtin_facet_extensions: cloneFields(row.builtin_facet_extensions || editorBaseFields.value),
    }
  } else {
    editorMode.value = 'custom'
    editorBaseFields.value = []
    editorLockedKeys.value = new Set()
    editing.value = { ...row, facet_extensions: cloneFields(row.facet_extensions) }
  }
  editorOpen.value = true
}

const onEditorSave = async ({ template, fields }) => {
  if (!editing.value) return
  saving.value = true
  try {
    if (editing.value.builtin) {
      const res = await saveAccountPoolBuiltinFields(editing.value.id, fields)
      applyCatalog(res)
      ElMessage.success('已保存该内置模板字段')
    } else {
      const payload = {
        ...template,
        facet_extensions: fields,
        builtin: false,
      }
      const res = await saveAccountPoolCustomTemplate(payload.id, payload)
      applyCatalog(res)
      ElMessage.success('已保存该自定义模板')
    }
    editorOpen.value = false
  } catch (e) {
    ElMessage.error(e?.response?.data?.detail || e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

const removeCustom = async (row) => {
  try {
    await ElMessageBox.confirm(`删除自定义模板「${row.label}」？`, '确认', { type: 'warning' })
  } catch {
    return
  }
  saving.value = true
  try {
    const res = await deleteAccountPoolCustomTemplate(row.id)
    applyCatalog(res)
    ElMessage.success('已删除')
  } catch (e) {
    ElMessage.error(e?.response?.data?.detail || e?.message || '删除失败')
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
          {{ templateGuide || '业务模板是同一测试账号在不同业务线的侧写；注册/登录/健康在账号级维护，不在模板上重复配置。' }}
          每个模板在「字段」弹窗内<strong>单独保存</strong>，不会覆盖其它模板配置。
        </p>
      </div>
      <div class="settings-header-actions">
        <el-button type="primary" @click="addCustom">新增模板</el-button>
      </div>
    </header>

    <section v-if="Object.keys(facetDataKinds).length" class="settings-card account-core-card">
      <h3 class="account-core-title">字段类型</h3>
      <div class="kind-grid">
        <div v-for="(meta, kind) in facetDataKinds" :key="kind" class="kind-card">
          <strong>{{ meta.label || kind }}</strong>
          <p>{{ meta.help }}</p>
        </div>
      </div>
    </section>

    <section v-if="accountCoreFacets.length" class="settings-card account-core-card">
      <h3 class="account-core-title">账号级状态（不在业务模板里配置）</h3>
      <div class="field-tags">
        <el-tag
          v-for="f in accountCoreFacets"
          :key="f.key"
          size="small"
          type="info"
          effect="plain"
          class="field-tag"
        >
          {{ fieldSummary(f) }}
        </el-tag>
      </div>
      <p class="page-lead account-core-hint">
        此处为<strong>字段定义</strong>（选项文案），不是具体账号的取值；单个账号的状态在 Studio「账号管理」编辑。
        入库时间见 Studio 副标题（<code>registered_at</code>）。
      </p>
    </section>

    <section class="settings-card">
      <el-table :data="templates" size="small" border stripe empty-text="无">
        <el-table-column prop="id" label="ID" width="148" show-overflow-tooltip />
        <el-table-column prop="label" label="名称" width="120" />
        <el-table-column label="类型" width="88">
          <template #default="{ row }">{{ row.builtin ? '内置' : '自定义' }}</template>
        </el-table-column>
        <el-table-column label="分类" width="100">
          <template #default="{ row }">{{ catLabel(row.category) }}</template>
        </el-table-column>
        <el-table-column prop="description" label="说明" min-width="140" show-overflow-tooltip />
        <el-table-column label="已有字段" min-width="220">
          <template #default="{ row }">
            <div class="field-tags">
              <el-tag
                v-for="(txt, i) in listFieldSummaries(row.builtin ? row.facet_extensions : allCustomFieldsFor(row)).slice(0, 4)"
                :key="i"
                size="small"
                effect="plain"
                class="field-tag"
              >
                {{ txt }}
              </el-tag>
              <el-tag
                v-for="(txt, i) in listFieldSummaries(row.builtin ? allCustomFieldsFor(row) : []).slice(0, 3)"
                :key="'a' + i"
                size="small"
                type="success"
                effect="plain"
                class="field-tag"
              >
                + {{ txt }}
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openEditor(row)">字段</el-button>
            <el-button
              v-if="!row.builtin"
              link
              type="danger"
              size="small"
              @click="removeCustom(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <TemplateFieldsEditorDialog
      v-model="editorOpen"
      :template="editing"
      :mode="editorMode"
      :base-fields="editorBaseFields"
      :locked-keys="[...editorLockedKeys]"
      :starter-keys="starterExtensions.map((s) => s.key)"
      :categories="categories"
      :saving="saving"
      @save="onEditorSave"
    />
  </div>
</template>

<style scoped>
.field-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.field-tag {
  max-width: 100%;
}
.account-core-title {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
}
.account-core-hint {
  margin: 10px 0 0;
  font-size: 13px;
}
.account-core-card {
  margin-bottom: 12px;
}
.kind-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
}
.kind-card {
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  font-size: 13px;
}
.kind-card p {
  margin: 6px 0 0;
  color: var(--el-text-color-secondary);
}
</style>
