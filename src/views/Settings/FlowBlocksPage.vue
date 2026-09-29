<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import AppScopePicker from '@/components/AppScopePicker.vue'
import { useAppScopePicker } from '@/composables/useAppScopePicker'
import {
  getAppFlowBlockOverrides,
  getFlowBlockCatalog,
  listFlowBlockCatalog,
  putAppFlowBlockOverrides,
  putFlowBlockCatalog,
} from '@/api/flowBlocks'
import { getScreenKeyRefs, putScreenKeyRefs } from '@/api/navFsm'
import './settings-ui.css'

const loading = ref(false)
const loadError = ref('')
const saving = ref(false)
const channel = ref('')
const items = ref([])
const drawerOpen = ref(false)
const editBlockId = ref('')
const editForm = ref({
  display_name: '',
  description: '',
  version: 'v1',
  enabled: true,
  key_ref: '',
  steps_json_text: '[]',
})

const screenLoading = ref(false)
const screenSaving = ref(false)
const screenRows = ref([])
const screenDirty = ref([])

const activeTab = ref('catalog')
const scope = useAppScopePicker()
const overrideLoading = ref(false)
const overrideSaving = ref(false)
const overrideRows = ref([])
const overrideGlobalId = ref('fb.global.login.email_web')
const overrideMode = ref('inherit')
const overrideStepsText = ref('[]')
const overrideSkipIds = ref('')

const channelOptions = [
  { value: '', label: '全部渠道' },
  { value: 'web', label: 'Web' },
  { value: 'android', label: 'Android' },
]

const tableRows = computed(() =>
  (items.value || []).map((row) => ({
    ...row,
    step_count: Array.isArray(row.steps_json) ? row.steps_json.length : 0,
  })),
)

const parseStepsJson = (text) => {
  const raw = String(text || '').trim() || '[]'
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('steps_json 不是合法 JSON')
  }
  if (!Array.isArray(parsed)) throw new Error('steps_json 必须是数组')
  return parsed
}

const loadCatalog = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const res = await listFlowBlockCatalog(channel.value ? { channel: channel.value } : {})
    const body = res?.data ?? res
    const list = body?.items
    if (!Array.isArray(list)) {
      loadError.value =
        '接口返回异常（本地开发请确认 vite 已代理 /flow-blocks，并已重启 Nexus 执行 catalog seed）'
      items.value = []
      return
    }
    items.value = list
  } catch (e) {
    const msg = e?.response?.data?.detail || e?.message || '加载逻辑块失败'
    loadError.value = String(msg)
    ElMessage.error(msg)
  } finally {
    loading.value = false
  }
}

const openEdit = async (row) => {
  const bid = String(row?.block_id || '')
  if (!bid) return
  loading.value = true
  try {
    const res = await getFlowBlockCatalog(bid)
    const data = res?.data || row
    editBlockId.value = bid
    editForm.value = {
      display_name: data.display_name || '',
      description: data.description || '',
      version: data.version || 'v1',
      enabled: data.enabled !== false,
      key_ref: data.key_ref || '',
      steps_json_text: JSON.stringify(data.steps_json || [], null, 2),
    }
    drawerOpen.value = true
  } catch (e) {
    ElMessage.error(e?.response?.data?.detail || e?.message || '加载详情失败')
  } finally {
    loading.value = false
  }
}

const saveCatalog = async () => {
  if (!editBlockId.value || saving.value) return
  saving.value = true
  try {
    const steps_json = parseStepsJson(editForm.value.steps_json_text)
    await putFlowBlockCatalog(editBlockId.value, {
      display_name: editForm.value.display_name,
      description: editForm.value.description,
      version: editForm.value.version,
      enabled: editForm.value.enabled,
      key_ref: editForm.value.key_ref,
      steps_json,
    })
    ElMessage.success('已保存')
    drawerOpen.value = false
    await loadCatalog()
  } catch (e) {
    ElMessage.error(e?.message || e?.response?.data?.detail || '保存失败')
  } finally {
    saving.value = false
  }
}

const loadOverrides = async () => {
  const appId = scope.appId.value
  if (!appId) {
    overrideRows.value = []
    return
  }
  overrideLoading.value = true
  try {
    const res = await getAppFlowBlockOverrides(appId)
    overrideRows.value = res?.data?.overrides || []
    const first = overrideRows.value.find(
      (r) => String(r.global_block_id) === overrideGlobalId.value,
    )
    if (first) {
      overrideMode.value = first.mode || 'inherit'
      overrideStepsText.value = JSON.stringify(first.steps || [], null, 2)
      overrideSkipIds.value = (first.skip_step_ids || []).join(', ')
    } else {
      overrideMode.value = 'inherit'
      overrideStepsText.value = '[]'
      overrideSkipIds.value = ''
    }
  } catch (e) {
    ElMessage.error(e?.response?.data?.detail || e?.message || '加载覆盖失败')
  } finally {
    overrideLoading.value = false
  }
}

const saveOverrides = async () => {
  const appId = scope.appId.value
  if (!appId || overrideSaving.value) return
  overrideSaving.value = true
  try {
    const skip = overrideSkipIds.value
      .split(/[,，\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    let steps = []
    if (overrideMode.value === 'replace') {
      steps = parseStepsJson(overrideStepsText.value)
    }
    const others = (overrideRows.value || []).filter(
      (r) => String(r.global_block_id) !== overrideGlobalId.value,
    )
    const row = {
      global_block_id: overrideGlobalId.value,
      mode: overrideMode.value,
      steps,
      skip_step_ids: skip,
    }
    await putAppFlowBlockOverrides(appId, [...others, row])
    ElMessage.success('应用覆盖已保存（写入导航 draft）')
    await loadOverrides()
  } catch (e) {
    ElMessage.error(e?.message || e?.response?.data?.detail || '保存失败')
  } finally {
    overrideSaving.value = false
  }
}

watch(channel, () => loadCatalog())
const loadScreenKeys = async () => {
  const appId = scope.appId.value
  if (!appId) {
    screenRows.value = []
    return
  }
  screenLoading.value = true
  try {
    const res = await getScreenKeyRefs(appId)
    screenRows.value = (res?.data?.items || []).map((r) => ({ ...r }))
    screenDirty.value = []
  } catch (e) {
    ElMessage.error(e?.response?.data?.detail || e?.message || '加载屏幕密钥失败')
  } finally {
    screenLoading.value = false
  }
}

const markScreenDirty = (row) => {
  const sid = String(row?.state_id || '')
  if (!sid) return
  if (!screenDirty.value.includes(sid)) screenDirty.value.push(sid)
}

const saveScreenKeys = async () => {
  const appId = scope.appId.value
  if (!appId || screenSaving.value) return
  const dirty = new Set(screenDirty.value)
  const items = screenRows.value
    .filter((r) => dirty.has(String(r.state_id)))
    .map((r) => ({ state_id: r.state_id, key_ref: r.key_ref || '' }))
  if (!items.length) {
    ElMessage.info('无修改')
    return
  }
  screenSaving.value = true
  try {
    const res = await putScreenKeyRefs(appId, items)
    screenRows.value = res?.data?.items || screenRows.value
    screenDirty.value = []
    ElMessage.success('屏幕密钥已保存到 NavFSM')
  } catch (e) {
    ElMessage.error(e?.response?.data?.detail || e?.message || '保存失败')
  } finally {
    screenSaving.value = false
  }
}

const copyDsl = async (text) => {
  const t = String(text || '').trim()
  if (!t) return
  try {
    await navigator.clipboard.writeText(t)
    ElMessage.success('已复制')
  } catch {
    ElMessageBox.alert(t, 'DSL')
  }
}

watch(() => scope.appId.value, () => {
  if (activeTab.value === 'overrides') loadOverrides()
  if (activeTab.value === 'screens') loadScreenKeys()
})

watch(activeTab, (tab) => {
  if (tab === 'screens') loadScreenKeys()
  if (tab === 'overrides') loadOverrides()
})

onMounted(async () => {
  await scope.loadProjects()
  await loadCatalog()
})
</script>

<template>
  <div class="settings-panel flow-blocks-page wide-panel" v-loading="loading">
    <header class="settings-page-header">
      <div>
        <h2 class="settings-page-title">FSM 逻辑块</h2>
        <p class="settings-page-desc">
          全局登录/弹窗编排（<code>fb.global.*</code>），对应 Nexus
          <code>nav_flow_block_catalog</code>。执行时展开为单步里程碑，与导航图页面跳转分离。
        </p>
      </div>
      <el-button size="small" @click="loadCatalog">刷新</el-button>
    </header>

    <el-tabs v-model="activeTab" class="fb-tabs">
      <el-tab-pane label="全局库" name="catalog">
        <div class="fb-toolbar">
          <el-select v-model="channel" size="small" style="width: 140px">
            <el-option
              v-for="opt in channelOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </div>
        <el-alert
          v-if="loadError"
          type="error"
          :closable="false"
          show-icon
          :title="loadError"
          class="fb-alert"
        />
        <el-empty
          v-else-if="!loading && !tableRows.length"
          description="库中暂无全局逻辑块。重启 Nexus 后 bootstrap 会 seed fb.global.*；也可在此新建。"
        />
        <el-table v-else :data="tableRows" size="small" border stripe>
          <el-table-column prop="block_id" label="block_id" min-width="200" show-overflow-tooltip />
          <el-table-column prop="key_ref" label="key_ref" min-width="200" show-overflow-tooltip />
          <el-table-column label="用例 DSL" width="100">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="copyDsl(row.dsl || `【块:${row.block_id}】`)">
                复制
              </el-button>
            </template>
          </el-table-column>
          <el-table-column prop="display_name" label="名称" min-width="160" />
          <el-table-column prop="version" label="版本" width="72" />
          <el-table-column prop="step_count" label="步数" width="64" align="center" />
          <el-table-column label="操作" width="88" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="应用覆盖" name="overrides" lazy>
        <p class="case-key-meta">
          覆盖写入应用导航 <strong>draft</strong>（<code>meta.flow_block_overrides</code>），promote 前可在 Studio 校准。
        </p>
        <div class="fb-toolbar">
          <AppScopePicker
            v-model="scope.cascaderValue"
            :options="scope.cascaderOptions"
            :loading="scope.loading"
          />
          <el-select v-model="overrideGlobalId" size="small" style="width: 260px; margin-left: 12px">
            <el-option
              v-for="row in items"
              :key="row.block_id"
              :label="`${row.display_name || row.block_id}`"
              :value="row.block_id"
            />
          </el-select>
          <el-button size="small" :disabled="!scope.appId" @click="loadOverrides">加载</el-button>
        </div>
        <div v-loading="overrideLoading" class="settings-card case-key-block">
          <el-form label-width="120px" size="small">
            <el-form-item label="模式">
              <el-radio-group v-model="overrideMode">
                <el-radio label="inherit">inherit（用全局步序）</el-radio>
                <el-radio label="replace">replace（整段替换 steps）</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item v-if="overrideMode === 'replace'" label="steps JSON">
              <el-input
                v-model="overrideStepsText"
                type="textarea"
                :rows="14"
                class="mono-textarea"
              />
            </el-form-item>
            <el-form-item label="跳过步 id">
              <el-input
                v-model="overrideSkipIds"
                placeholder="逗号分隔，如 legal_consent,otp_fill"
              />
            </el-form-item>
            <el-form-item>
              <el-button
                type="primary"
                :loading="overrideSaving"
                :disabled="!scope.appId"
                @click="saveOverrides"
              >
                保存覆盖
              </el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-tab-pane>

      <el-tab-pane label="屏幕密钥" name="screens" lazy>
        <p class="case-key-meta">
          绑定 NavFSM <code>state.meta.key_ref</code>，用例操作行可写 <code>【导航:state_id】</code>。
          需先选应用（该应用已配置 NavFSM）。
        </p>
        <div class="fb-toolbar">
          <AppScopePicker
            v-model="scope.cascaderValue"
            :options="scope.cascaderOptions"
            :loading="scope.loading"
          />
          <el-button size="small" :disabled="!scope.appId" @click="loadScreenKeys">刷新</el-button>
          <el-button
            type="primary"
            size="small"
            :loading="screenSaving"
            :disabled="!scope.appId"
            @click="saveScreenKeys"
          >
            保存修改
          </el-button>
        </div>
        <el-table v-loading="screenLoading" :data="screenRows" size="small" border stripe empty-text="请选择应用或配置 NavFSM">
          <el-table-column prop="state_id" label="state_id" min-width="160" show-overflow-tooltip />
          <el-table-column prop="label" label="标签" min-width="140" show-overflow-tooltip />
          <el-table-column label="key_ref" min-width="220">
            <template #default="{ row }">
              <el-input
                v-model="row.key_ref"
                size="small"
                @change="markScreenDirty(row)"
              />
            </template>
          </el-table-column>
          <el-table-column label="DSL" width="100">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="copyDsl(row.dsl)">复制</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <el-drawer v-model="drawerOpen" :title="editBlockId" size="52%" destroy-on-close>
      <el-form label-position="top" size="small">
        <el-form-item label="显示名">
          <el-input v-model="editForm.display_name" />
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="editForm.description" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="key_ref（操作层密钥）">
          <el-input v-model="editForm.key_ref" placeholder="operation.block.xxx" />
          <p class="case-key-meta">用例步骤可写：【块:{{ editBlockId }}】</p>
        </el-form-item>
        <el-form-item label="version">
          <el-input v-model="editForm.version" style="max-width: 120px" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="editForm.enabled" />
        </el-form-item>
        <el-form-item label="steps_json">
          <p class="case-key-meta">
            字段：<code>id</code>、<code>kind</code>（visual_tap/hook）、<code>cap</code>、<code>hook_cap</code>、
            <code>guards</code>、<code>fuse</code>、<code>skip_policy</code>。见 Nexus
            <code>docs/基础框架/FLOW_BLOCKS.md</code>。
          </p>
          <el-input v-model="editForm.steps_json_text" type="textarea" :rows="22" class="mono-textarea" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="drawerOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveCatalog">保存</el-button>
      </template>
    </el-drawer>
  </div>
</template>

<style scoped>
.flow-blocks-page {
  max-width: none;
  width: 100%;
}
.fb-tabs {
  margin-top: 8px;
}
.fb-alert {
  margin-bottom: 12px;
}
.fb-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.mono-textarea :deep(textarea) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
}
</style>
