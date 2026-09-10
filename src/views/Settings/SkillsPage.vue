<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Filter, Search } from '@element-plus/icons-vue'
import { getLayerStack, listAIRoles, listAISkills, saveAISkill, createAISkill } from '@/api/settings'
import './settings-ui.css'

const DEFAULT_SKILL_CATEGORIES = [
  { id: 'flow', label: '流程产出', desc: '读需求、写脑图和用例、出验收或发版草稿' },
  { id: 'device', label: '设备操作', desc: '真机上规划、点按、定位和断言' },
  { id: 'channel', label: '通道对话', desc: 'IM 里回答、下令、提缺陷，或问人' },
  { id: 'sync', label: '外部同步', desc: '写到 Wiki 等外部系统' },
  { id: 'prompt', label: '提示词辅件', desc: 'user 模板、厂商补丁、遗留与观察叠加' },
]

const SKILL_CATEGORY_FALLBACK = {
  'im.dialogue': 'channel',
  'im.defect': 'channel',
  'hitl-composer': 'channel',
  'goal-extract': 'device',
  'inspect-session': 'device',
  'case-scene': 'device',
  'agent-decide': 'device',
  'assert-vision': 'device',
  'plan-overview': 'device',
  'locate-vision': 'device',
  'single-step-replan': 'device',
  'persona-task': 'device',
  publish_wiki: 'sync',
  'legacy-im-dialogue': 'prompt',
  'explain-overlay': 'prompt',
  'volcengine-doubao-coord-append': 'prompt',
  'volcengine-doubao-json-append': 'prompt',
  'user-plan-overview': 'prompt',
  'user-single-step-replan': 'prompt',
  'user-locate-vision': 'prompt',
  'user-assert-vision': 'prompt',
  'user-hitl-composer': 'prompt',
  'user-persona-task': 'prompt',
  'user-goal-extract': 'prompt',
  'user-inspect-session': 'prompt',
  'user-case-scene': 'prompt',
  'user-agent-decide': 'prompt',
  'user-agent-restart': 'prompt',
  'user-ai-plan': 'prompt',
}

const ENGINE_LABEL = {
  agent_loop: '看图执行',
  qa_job: '分析',
  chat: '对话',
}
const ENGINE_PRESETS = [
  { id: 'chat', label: '对话', desc: '自己说话，或把任务派给其它角色绑定的技能。', view: 'job-timeline', category: 'flow' },
  { id: 'qa_job', label: '分析', desc: '读需求原文，出脑图、用例或验收草稿。', view: 'flow-doc', category: 'flow' },
  { id: 'agent_loop', label: '看图执行', desc: '看截图调扩展包，按前置 / 操作 / 校验推进。', view: 'case-three-column', category: 'device' },
]
const TRIGGER_LABEL = {
  qa_tick: '流程 tick',
  settings_chat: '设置页对话',
  im_chat: 'IM',
  case_run: '跑用例',
}
const INPUT_LABEL = {
  case: '用例三列',
  requirement: '需求原文',
  none: '无',
}
const POINTER_LABEL = {
  case_columns: '用例三列',
  none: '无指针',
}
const VIEW_LABEL = {
  'case-three-column': '任务详情三栏',
  'job-timeline': '调用时间线',
  'flow-doc': '脑图 / 用例草稿',
}
const PHASE_LABEL = { prep: '前置', do: '操作', check: '校验' }
const KIND_LABEL = { prep: '前置', do: '操作', check: '校验', generic: '通用', recovery: '恢复' }

const SKILL_JOB_MAP = {
  'run-case': 'agent-decide',
  analyze_req: 'analyze_req',
  draft_mindmap: 'draft_mindmap',
  draft_cases: 'draft_cases',
  propose_atlas: 'propose_atlas',
  conductor: 'conductor',
  'im-dialogue': 'im-dialogue',
  'im-defect': 'im-defect',
  'req-qa-bm': 'req-qa-bm',
  'version-qa-bm': 'version-qa-bm',
  'test-engineer-chat': 'test-engineer-chat',
  'report-writer': 'report-writer',
  'doc-keeper': 'doc-keeper',
  'knowledge-reviewer': 'knowledge-reviewer',
  'product-expert': 'product-expert',
}

const linkedJobId = (skill) => SKILL_JOB_MAP[skill?.id] || ''

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const catalog = ref({ product: [], skills: [], skill_categories: [], enums: {} })
const keyword = ref('')
const skillFilter = ref('all')
const selectedId = ref('run-case')
const promptDraft = ref('')
const skillSavingDoc = ref(false)
const createOpen = ref(false)
const creating = ref(false)
const createForm = ref({ id: '', label: '', summary: '', engine: 'chat', view_id: 'job-timeline', category: 'flow' })

const engineLabel = (id) => ENGINE_LABEL[id] || id || '—'
const triggerLabel = (id) => TRIGGER_LABEL[id] || id
const inputLabel = (row) => {
  const t = row?.input?.type || row?.input_spec?.type || 'none'
  return INPUT_LABEL[t] || t
}
const pointerLabel = (id) => POINTER_LABEL[id] || id || '—'
const viewLabelOf = (id) => VIEW_LABEL[id] || id || '—'
const phaseLabel = (id) => PHASE_LABEL[id] || id
const kindLabel = (id) => KIND_LABEL[id] || id
const skillViewId = (row) => row?.view_id || row?.view?.id || 'job-timeline'
const skillEngine = (row) => String(row?.engine || 'chat')
const isChatSkill = (row) => skillEngine(row) === 'chat'
const isAgentSkill = (row) => skillEngine(row) === 'agent_loop'
const isQaSkill = (row) => skillEngine(row) === 'qa_job'

const allRoles = computed(() => catalog.value.product || [])
const allSkills = computed(() => catalog.value.skills || [])
const skillCategories = computed(() => (
  catalog.value.skill_categories?.length ? catalog.value.skill_categories : DEFAULT_SKILL_CATEGORIES
))
const enums = computed(() => catalog.value.enums || {})

const roleById = (id) => allRoles.value.find((row) => row.id === id) || null
const skillCategoryOf = (row) => (
  row?.category || SKILL_CATEGORY_FALLBACK[row?.id] || (row?.intent === 'talk' ? 'channel' : row?.intent === 'act' ? 'device' : 'flow')
)

const matchSkill = (row, q) => {
  if (!q) return true
  const roles = (row.role_ids || []).map((id) => roleById(id)?.label || id)
  return [row.label, row.summary, row.category_label, skillCategoryOf(row), ...roles].join(' ').toLowerCase().includes(q)
}

const skillGroups = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  return skillCategories.value.map((cat) => {
    const rows = allSkills.value.filter((row) => (
      skillCategoryOf(row) === cat.id && matchSkill(row, q)
    ))
    return { ...cat, rows }
  }).filter((group) => group.rows.length)
})

const visibleSkillGroups = computed(() => (
  skillFilter.value === 'all'
    ? skillGroups.value
    : skillGroups.value.filter((group) => group.id === skillFilter.value)
))

const categoryFilters = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  const matched = allSkills.value.filter((row) => matchSkill(row, q))
  return [
    { id: 'all', label: '全部', desc: '', count: matched.length },
    ...skillCategories.value.map((cat) => ({
      ...cat,
      count: matched.filter((row) => skillCategoryOf(row) === cat.id).length,
    })),
  ]
})

const selectedSkill = computed(() => allSkills.value.find((row) => row.id === selectedId.value) || null)
const selectedSkillPhases = computed(() => {
  const phases = selectedSkill.value?.sop?.phases
  return (Array.isArray(phases) && phases.length) ? phases : ['prep', 'do', 'check']
})
const selectedViewId = computed(() => skillViewId(selectedSkill.value))
const selectedOwnerRole = computed(() => {
  const row = selectedSkill.value
  if (!row) return null
  return roleById(row.role?.id || row.role_id) || (
    row.role?.id || row.role_id
      ? { id: row.role?.id || row.role_id, label: row.role?.label || row.role_label || row.role_id }
      : null
  )
})
const selectedDispatchRoles = computed(() => {
  const owner = selectedOwnerRole.value
  const seen = new Set(owner?.id ? [owner.id] : [])
  const out = []
  for (const id of owner?.related_ids || []) {
    const hit = roleById(id)
    if (!hit || seen.has(hit.id)) continue
    seen.add(hit.id)
    out.push(hit)
  }
  return out
})
const selectedTriggers = computed(() => (
  (selectedSkill.value?.triggers || []).map((id) => triggerLabel(id))
))
const skillHowSteps = computed(() => {
  const row = selectedSkill.value
  if (!row) return []
  const engine = skillEngine(row)
  const steps = ['触发', `本技能 · ${row.label}`]
  if (isAgentSkill(row)) {
    steps.push(engineLabel(engine), '扩展包', 'Scout', viewLabelOf(skillViewId(row)))
  } else if (isQaSkill(row)) {
    steps.push(engineLabel(engine), viewLabelOf(skillViewId(row)))
  } else {
    steps.push('再调其它技能')
  }
  return steps
})
const activeFilterLabel = computed(() => {
  const hit = categoryFilters.value.find((row) => row.id === skillFilter.value)
  if (!hit || hit.id === 'all') return '筛选'
  return `${hit.label} ${hit.count}`
})
const skillPromptDirty = computed(() => {
  if (!selectedSkill.value) return false
  return promptDraft.value.trim() !== String(selectedSkill.value.system_prompt || '').trim()
})
const enginePreset = (id) => ENGINE_PRESETS.find((row) => row.id === id) || ENGINE_PRESETS[0]
const selectedEngineNote = computed(() => enginePreset(skillEngine(selectedSkill.value)).desc)
const createCanSubmit = computed(() => String(createForm.value.label || '').trim().length > 0)

const applyEnginePreset = (id, target) => {
  const preset = enginePreset(id)
  target.engine = preset.id
  target.view_id = preset.view
  if (!target.category || target.category === 'flow' || target.category === 'device') {
    target.category = preset.category
  }
}

const openCreate = () => {
  createForm.value = { id: '', label: '', summary: '', engine: 'chat', view_id: 'job-timeline', category: 'flow' }
  createOpen.value = true
}

const closeCreate = () => {
  if (creating.value) return
  createOpen.value = false
}

const syncQuery = () => {
  const skill = String(route.query.skill || '').trim()
  if (skill) selectedId.value = skill
}

const pushQuery = () => {
  const next = { skill: selectedId.value }
  if (String(route.query.skill || '') === String(next.skill || '')) return
  router.replace({ path: '/skills', query: next })
}

const selectSkill = (row) => {
  if (!row?.id) return
  selectedId.value = row.id
  promptDraft.value = row.system_prompt || ''
  pushQuery()
}

const openRole = (role) => {
  if (!role?.id) return
  router.push({ path: '/roles', query: { role: role.id } })
}

const mergeStack = (rolesData, stack, skillPack) => {
  const next = {
    ...(rolesData || {}),
    product: [...(rolesData?.product || [])],
    skills: [...(skillPack?.skills || rolesData?.skills || [])],
    skill_categories: rolesData?.skill_categories || [],
    enums: skillPack?.enums || rolesData?.enums || {},
  }
  if (stack?.skill_categories?.length) next.skill_categories = stack.skill_categories
  return next
}

const load = async () => {
  loading.value = true
  try {
    const [rolesRes, stackRes, skillRes] = await Promise.all([
      listAIRoles(),
      getLayerStack().catch(() => null),
      listAISkills().catch(() => null),
    ])
    catalog.value = mergeStack(
      rolesRes?.data || { product: [], skills: [], skill_categories: [] },
      stackRes?.data,
      skillRes?.data,
    )
    if (!allSkills.value.some((row) => row.id === selectedId.value)) {
      selectedId.value = allSkills.value.find((row) => row.id === 'run-case')?.id
        || allSkills.value[0]?.id
        || ''
    }
    promptDraft.value = allSkills.value.find((row) => row.id === selectedId.value)?.system_prompt || ''
  } catch (e) {
    ElMessage.error(e?.response?.data?.detail || '加载技能失败')
  } finally {
    loading.value = false
  }
}

const saveSkillDoc = async (patch = {}) => {
  const row = selectedSkill.value
  if (!row || skillSavingDoc.value) return
  skillSavingDoc.value = true
  try {
    await saveAISkill(row.id, {
      label: row.label,
      summary: row.summary,
      engine: row.engine,
      category: row.category,
      sop: row.sop,
      view: row.view,
      view_id: row.view_id || row.view?.id,
      role: row.role,
      system_prompt: promptDraft.value.trim() || row.system_prompt,
      ...patch,
    })
    ElMessage.success('已保存技能')
    await load()
  } catch (e) {
    ElMessage.error(e?.response?.data?.detail || e?.message || '保存失败')
  } finally {
    skillSavingDoc.value = false
  }
}

const resetSkillPrompt = async () => {
  const row = selectedSkill.value
  if (!row || skillSavingDoc.value) return
  skillSavingDoc.value = true
  try {
    await saveAISkill(row.id, { reset: true })
    ElMessage.success('已恢复默认 prompt')
    await load()
  } catch (e) {
    ElMessage.error(e?.response?.data?.detail || e?.message || '恢复失败')
  } finally {
    skillSavingDoc.value = false
  }
}

const patchSop = (key, value) => {
  const row = selectedSkill.value
  if (!row) return
  row.sop = { ...(row.sop || {}), [key]: value }
  saveSkillDoc({ sop: row.sop })
}

const patchInputType = (type) => {
  const row = selectedSkill.value
  if (!row) return
  const input = { ...(row.input || row.input_spec || {}), type }
  row.input = input
  saveSkillDoc({ input })
}

const setSkillEngine = (id) => {
  const row = selectedSkill.value
  if (!row || skillEngine(row) === id) return
  const preset = enginePreset(id)
  row.engine = preset.id
  saveSkillDoc({
    engine: preset.id,
    view_id: preset.view,
    view: { id: preset.view },
    category: row.category || preset.category,
  })
}

const createSkill = async () => {
  const label = String(createForm.value.label || '').trim()
  if (!label || creating.value) return
  creating.value = true
  const preset = enginePreset(createForm.value.engine)
  try {
    const data = await createAISkill({
      id: createForm.value.id,
      label,
      summary: String(createForm.value.summary || '').trim(),
      engine: preset.id,
      view_id: createForm.value.view_id || preset.view,
      category: createForm.value.category || preset.category,
      system_prompt: `你是 Mino 的「${label}」。按用户给出的输入完成这项技能，不要假装已经操作了真机。`,
    })
    ElMessage.success('已新建技能')
    createOpen.value = false
    await load()
    const id = data?.data?.id
    if (id) {
      selectedId.value = id
      pushQuery()
    }
  } catch (e) {
    ElMessage.error(e?.response?.data?.detail || e?.message || '新建失败')
  } finally {
    creating.value = false
  }
}

watch(() => selectedSkill.value?.id, (id) => {
  if (!id) return
  promptDraft.value = selectedSkill.value?.system_prompt || ''
})
watch(() => route.query.skill, syncQuery)
const onCreateKey = (e) => {
  if (e.key === 'Escape') closeCreate()
}
watch(createOpen, (open) => {
  if (open) window.addEventListener('keydown', onCreateKey)
  else window.removeEventListener('keydown', onCreateKey)
})

onMounted(async () => {
  syncQuery()
  await load()
  pushQuery()
})

onUnmounted(() => {
  window.removeEventListener('keydown', onCreateKey)
})
</script>

<template>
  <div class="settings-panel roles-page wide-panel" v-loading="loading">
    <header class="settings-page-header">
      <div>
        <h2 class="settings-page-title">技能</h2>
        <p class="settings-page-desc">
          技能是「做什么」：prompt、怎么跑、结果怎么画。真正执行任务读的是这里。
          <router-link to="/roles">角色</router-link>
          决定谁能派出这条技能，
          <router-link to="/stack">编排</router-link>
          决定哪个入口会选中那个角色。设备 function 在
          <router-link to="/packs">扩展包</router-link>。
        </p>
      </div>
      <div class="settings-summary-pill">{{ allSkills.length }} 项技能</div>
    </header>

    <p class="relation-map">
      <router-link to="/stack">入口</router-link>
      <span>→</span>
      <router-link to="/roles">角色 · 谁出面</router-link>
      <span>→</span>
      <em>技能 · 做什么</em>
      <span>→</span>
      <router-link to="/packs">扩展包</router-link>
    </p>

    <div class="skills-workspace">
      <div class="settings-toolbar skill-toolbar">
        <el-input
          v-model="keyword"
          class="skill-search"
          clearable
          :prefix-icon="Search"
          placeholder="搜索技能"
        />
        <el-popover placement="bottom-start" :width="240" trigger="click">
          <template #reference>
            <button type="button" class="cat-filter" :class="{ active: skillFilter !== 'all' }">
              <el-icon><Filter /></el-icon>
              {{ activeFilterLabel }}
            </button>
          </template>
          <div class="filter-menu">
            <button
              v-for="cat in categoryFilters"
              :key="cat.id"
              type="button"
              class="filter-menu-item"
              :class="{ active: skillFilter === cat.id }"
              @click="skillFilter = cat.id"
            >
              <span>{{ cat.label }}</span>
              <em>{{ cat.count }}</em>
            </button>
          </div>
        </el-popover>
        <button type="button" class="settings-action-pill" @click="openCreate">
          新建技能<span class="settings-action-arrow">→</span>
        </button>
      </div>

      <div class="skills-split">
        <aside class="settings-card skills-list">
          <p v-if="!visibleSkillGroups.length" class="empty-hint">暂无数据</p>
          <template v-for="group in visibleSkillGroups" :key="group.id">
            <div class="settings-kicker">{{ group.label }}</div>
            <button
              v-for="row in group.rows"
              :key="row.id"
              type="button"
              class="skill-item"
              :class="{ active: selectedSkill?.id === row.id }"
              @click="selectSkill(row)"
            >
              <strong>{{ row.label }}</strong>
              <span class="skill-type">{{ engineLabel(row.engine) }}</span>
            </button>
          </template>
        </aside>

        <div v-if="selectedSkill" class="skill-doc">
          <header class="skill-doc-head">
            <div>
              <h3>{{ selectedSkill.label }}</h3>
              <p>{{ selectedSkill.summary || '改身份和 prompt。' }}</p>
            </div>
            <span class="role-tag is-live">{{ engineLabel(selectedSkill.engine) }}</span>
          </header>

          <div class="skill-meta-row">
            <span v-if="selectedOwnerRole">
              归属角色
              <button type="button" class="inline-link" @click="openRole(selectedOwnerRole)">
                {{ selectedOwnerRole.label }}
              </button>
            </span>
            <span v-if="selectedTriggers.length">触发 {{ selectedTriggers.join(' · ') }}</span>
            <span>输入 {{ inputLabel(selectedSkill) }}</span>
          </div>

          <section class="settings-card skill-block">
            <div class="settings-kicker">怎么跑</div>
            <p class="skill-block-note">{{ selectedEngineNote }}</p>
            <div class="engine-picks">
              <button
                v-for="row in ENGINE_PRESETS"
                :key="row.id"
                type="button"
                class="engine-pick"
                :class="{ active: skillEngine(selectedSkill) === row.id }"
                @click="setSkillEngine(row.id)"
              >
                <strong>{{ row.label }}</strong>
                <span>{{ row.desc }}</span>
              </button>
            </div>
            <ol v-if="skillHowSteps.length" class="skill-flow">
              <li v-for="(step, idx) in skillHowSteps" :key="step" :class="{ on: idx === 1 }">{{ step }}</li>
            </ol>

            <div v-if="isChatSkill(selectedSkill) && selectedDispatchRoles.length" class="related is-inline">
              <span>会派给谁</span>
              <button
                v-for="role in selectedDispatchRoles"
                :key="role.id"
                type="button"
                class="cap-chip"
                @click="openRole(role)"
              >
                {{ role.label }}
              </button>
            </div>

            <div v-if="isQaSkill(selectedSkill)" class="skill-sop-grid">
              <label>
                <span>读什么</span>
                <el-select :model-value="selectedSkill.input?.type || selectedSkill.input_spec?.type || 'requirement'" size="small" @change="patchInputType">
                  <el-option v-for="id in (enums.input_types || ['requirement', 'case', 'instruction', 'none'])" :key="id" :label="INPUT_LABEL[id] || id" :value="id" />
                </el-select>
              </label>
              <label>
                <span>结果怎么画</span>
                <el-select :model-value="selectedViewId" size="small" @change="(v) => saveSkillDoc({ view_id: v, view: { id: v } })">
                  <el-option v-for="id in (enums.views || ['case-three-column', 'job-timeline', 'flow-doc'])" :key="id" :label="viewLabelOf(id)" :value="id" />
                </el-select>
              </label>
            </div>

            <template v-if="isAgentSkill(selectedSkill)">
              <div class="sop-pipe">
                <template v-for="(id, idx) in selectedSkillPhases" :key="id">
                  <span v-if="idx" class="sop-arrow">→</span>
                  <em>{{ phaseLabel(id) }}</em>
                </template>
              </div>
              <div class="skill-sop-grid">
                <label>
                  <span>阶段</span>
                  <el-select :model-value="selectedSkill.sop?.phases" multiple collapse-tags size="small" @change="(v) => patchSop('phases', v)">
                    <el-option v-for="id in ['prep', 'do', 'check']" :key="id" :label="phaseLabel(id)" :value="id" />
                  </el-select>
                </label>
                <label>
                  <span>指针</span>
                  <el-select :model-value="selectedSkill.sop?.pointer" size="small" @change="(v) => patchSop('pointer', v)">
                    <el-option v-for="id in (enums.pointers || ['case_columns', 'none'])" :key="id" :label="pointerLabel(id)" :value="id" />
                  </el-select>
                </label>
                <label>
                  <span>工具范围</span>
                  <el-select :model-value="selectedSkill.sop?.tool_kinds" multiple collapse-tags size="small" @change="(v) => patchSop('tool_kinds', v)">
                    <el-option v-for="id in (enums.tool_kinds || ['prep', 'do', 'check', 'generic', 'recovery'])" :key="id" :label="kindLabel(id)" :value="id" />
                  </el-select>
                </label>
                <label>
                  <span>最大步数</span>
                  <el-input-number
                    :model-value="selectedSkill.sop?.max_steps || 24"
                    :min="1"
                    :max="80"
                    size="small"
                    @change="(v) => patchSop('max_steps', v)"
                  />
                </label>
                <label>
                  <span>结果怎么画</span>
                  <el-select :model-value="selectedViewId" size="small" @change="(v) => saveSkillDoc({ view_id: v, view: { id: v } })">
                    <el-option v-for="id in (enums.views || ['case-three-column', 'job-timeline', 'flow-doc'])" :key="id" :label="viewLabelOf(id)" :value="id" />
                  </el-select>
                </label>
              </div>
            </template>

            <div v-if="isChatSkill(selectedSkill)" class="skill-sop-grid">
              <label>
                <span>结果怎么画</span>
                <el-select :model-value="selectedViewId" size="small" @change="(v) => saveSkillDoc({ view_id: v, view: { id: v } })">
                  <el-option v-for="id in (enums.views || ['case-three-column', 'job-timeline', 'flow-doc'])" :key="id" :label="viewLabelOf(id)" :value="id" />
                </el-select>
              </label>
            </div>
          </section>

          <section class="settings-card skill-block skill-prompt">
            <div v-if="linkedJobId(selectedSkill)" class="job-link-banner">
              <p>此技能的 prompt 在 <strong>Jobs</strong> 里维护（{{ linkedJobId(selectedSkill) }}）。</p>
              <router-link :to="{ path: '/jobs', query: { job: linkedJobId(selectedSkill) } }" class="settings-action-pill">
                打开 Jobs<span class="settings-action-arrow">→</span>
              </router-link>
            </div>
            <template v-else>
            <div class="prompt-edit-head">
              <div class="settings-kicker">Prompt</div>
              <div class="prompt-edit-actions">
                <button type="button" class="settings-action-pill" :disabled="skillSavingDoc || !skillPromptDirty" @click="saveSkillDoc()">
                  {{ skillSavingDoc ? '保存中' : '保存' }}<span class="settings-action-arrow">→</span>
                </button>
                <button type="button" class="settings-action-pill" :disabled="skillSavingDoc || !selectedSkill.builtin" @click="resetSkillPrompt">
                  恢复默认<span class="settings-action-arrow">→</span>
                </button>
              </div>
            </div>
            <el-input v-model="promptDraft" type="textarea" :rows="isChatSkill(selectedSkill) ? 16 : 12" placeholder="这个技能的 system prompt" />
            </template>
          </section>

        </div>
        <p v-else class="empty-hint">选左边一项技能</p>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="createOpen" class="create-scrim" @click.self="closeCreate">
        <section class="create-sheet" role="dialog" aria-labelledby="create-skill-title">
          <header class="create-sheet-head">
            <div>
              <div class="settings-kicker">新技能</div>
              <h3 id="create-skill-title">先定怎么跑</h3>
              <p>三种跑法。选完再起名字；prompt 建好后在右边改。</p>
            </div>
            <button type="button" class="create-close" :disabled="creating" @click="closeCreate">关闭</button>
          </header>

          <div class="engine-picks">
            <button
              v-for="row in ENGINE_PRESETS"
              :key="row.id"
              type="button"
              class="engine-pick"
              :class="{ active: createForm.engine === row.id }"
              @click="applyEnginePreset(row.id, createForm)"
            >
              <strong>{{ row.label }}</strong>
              <span>{{ row.desc }}</span>
            </button>
          </div>

          <label class="create-field">
            <span>叫什么</span>
            <input v-model="createForm.label" type="text" placeholder="例如：巡检登录页" />
          </label>
          <label class="create-field">
            <span>一句话</span>
            <input v-model="createForm.summary" type="text" :placeholder="enginePreset(createForm.engine).desc" />
          </label>

          <div class="create-cats">
            <span>放哪一类</span>
            <div class="create-cat-row">
              <button
                v-for="cat in skillCategories"
                :key="cat.id"
                type="button"
                class="create-cat"
                :class="{ active: createForm.category === cat.id }"
                @click="createForm.category = cat.id"
              >
                {{ cat.label }}
              </button>
            </div>
          </div>

          <details class="create-more">
            <summary>标识和结果视图（可空）</summary>
            <label class="create-field">
              <span>id</span>
              <input v-model="createForm.id" type="text" placeholder="空着则按名称生成" />
            </label>
            <label class="create-field">
              <span>Studio 怎么画</span>
              <el-select v-model="createForm.view_id">
                <el-option v-for="id in (enums.views || ['case-three-column', 'job-timeline', 'flow-doc'])" :key="id" :label="viewLabelOf(id)" :value="id" />
              </el-select>
            </label>
          </details>

          <footer class="create-sheet-foot">
            <button type="button" class="settings-action-pill" :disabled="creating" @click="closeCreate">取消</button>
            <button type="button" class="settings-action-pill" :disabled="creating || !createCanSubmit" @click="createSkill">
              {{ creating ? '创建中' : '创建并去写 prompt' }}<span class="settings-action-arrow">→</span>
            </button>
          </footer>
        </section>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.job-link-banner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 10px;
  background: rgba(64, 158, 255, 0.08);
}
.job-link-banner p { margin: 0; font-size: 13px; }

.roles-page {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.relation-map {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 0 0 16px;
  color: var(--settings-muted);
  font-size: 12px;
  font-weight: 650;
}

.relation-map a,
.relation-map em {
  color: var(--settings-primary);
  font-style: normal;
  font-weight: 750;
  text-decoration: none;
}

.relation-map em {
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--settings-primary-soft);
}

.settings-page-desc a {
  color: var(--settings-primary);
  font-weight: 700;
}

.skill-search {
  width: 220px;
}

.skill-toolbar .settings-action-pill {
  margin-left: auto;
}

.cat-filter {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  padding: 0 12px;
  border: 1px solid var(--settings-border);
  border-radius: 999px;
  background: #fff;
  color: var(--settings-muted);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.cat-filter.active {
  border-color: color-mix(in srgb, var(--settings-primary) 45%, white);
  background: var(--settings-primary-soft);
  color: #4338ca;
}

.empty-hint {
  margin: 8px 4px;
  color: var(--settings-muted);
  font-size: 12px;
}

.role-tag {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
}

.role-tag.is-live {
  background: #ecfdf5;
  color: #047857;
}

.prompt-edit-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.prompt-edit-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.prompt-edit-actions .settings-action-pill:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.skill-prompt :deep(.el-textarea__inner) {
  border-radius: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  line-height: 1.55;
}

.inline-link {
  padding: 0;
  border: 0;
  background: none;
  color: var(--settings-primary);
  font: inherit;
  font-weight: 750;
  cursor: pointer;
}

.related {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.cap-chip {
  max-width: 100%;
  padding: 4px 10px;
  border: 1px solid color-mix(in srgb, var(--settings-primary) 22%, white);
  border-radius: 999px;
  background: var(--settings-primary-soft);
  color: #4338ca;
  font-size: 12px;
  font-weight: 650;
  line-height: 1.4;
  text-align: left;
  cursor: pointer;
}

.skill-flow {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  margin: 0 0 12px;
  padding: 0;
  list-style: none;
  font-size: 12px;
  color: var(--settings-muted);
}

.skill-flow li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--settings-soft);
}

.skill-flow li + li::before {
  content: '→';
  margin-right: 2px;
  color: #94a3b8;
}

.skill-flow li.on {
  background: var(--settings-primary-soft);
  color: var(--settings-primary);
  font-weight: 700;
}

.skills-workspace {
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
}

.skills-split {
  display: grid;
  grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
  min-width: 0;
}

.skills-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  max-height: min(72vh, 820px);
  overflow: auto;
}

.skills-list .settings-kicker {
  margin: 10px 0 4px;
}

.skills-list .settings-kicker:first-child {
  margin-top: 0;
}

.skill-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.skill-type {
  font-size: 11px;
  color: var(--settings-muted);
  font-weight: 650;
}

.skill-how {
  margin: 0;
  padding: 8px 12px;
  border: 1px solid var(--settings-border);
  border-radius: 12px;
  background: #fff;
}

.skill-how summary {
  cursor: pointer;
  color: var(--settings-muted);
  font-size: 12px;
  font-weight: 700;
}

.skill-how .skill-flow {
  margin: 10px 0 0;
}

.skill-meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  color: var(--settings-muted);
  font-size: 12px;
  line-height: 1.5;
}

.skill-block.is-compact {
  padding: 12px 14px;
}

.skill-block-note {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--settings-muted);
}

.skill-prompt .prompt-edit-head {
  margin-bottom: 10px;
}

.skill-prompt .prompt-edit-actions {
  margin-top: 0;
}

.skill-advanced {
  padding: 10px 12px;
  border: 1px solid var(--settings-border);
  border-radius: 12px;
  background: #fff;
}

.skill-advanced summary {
  cursor: pointer;
  color: var(--settings-muted);
  font-size: 12px;
  font-weight: 700;
}

.skill-advanced-body {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 12px;
}

.filter-menu {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.filter-menu-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--settings-text);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}

.filter-menu-item em {
  font-style: normal;
  color: var(--settings-muted);
}

.filter-menu-item.active {
  background: var(--settings-primary-soft);
  color: #4338ca;
  font-weight: 700;
}

.skill-item.active {
  background: var(--settings-primary-soft);
}

.skill-doc {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.skill-doc-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.skill-doc-head h3 {
  margin: 4px 0;
  font-size: 18px;
}

.skill-doc-head p {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--settings-muted);
}

.sop-pipe {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.sop-pipe em {
  font-style: normal;
  font-weight: 800;
  padding: 6px 12px;
  border-radius: 10px;
  background: #ecfdf5;
  color: #047857;
}

.sop-arrow {
  color: #94a3b8;
  font-weight: 700;
}

.view-pick {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 280px;
  margin-bottom: 12px;
  font-size: 12px;
  color: var(--settings-muted);
}

.view-preview {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  min-height: 88px;
}

.view-preview[data-view='job-timeline'],
.view-preview[data-view='flow-doc'] {
  grid-template-columns: 1fr;
}

.view-col,
.view-line,
.view-doc {
  border: 1px solid var(--settings-border);
  border-radius: 10px;
  padding: 8px;
  background: #fff;
}

.view-col b,
.view-line b,
.view-doc b {
  display: block;
  margin-bottom: 8px;
  font-size: 12px;
}

.view-col i,
.view-doc i {
  display: block;
  height: 8px;
  margin-top: 6px;
  border-radius: 99px;
  background: #e2e8f0;
}

.view-col.is-bad {
  border-color: #fecaca;
  background: #fef2f2;
}

.skill-sop-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  margin: 12px 0 16px;
}

.skill-sop-grid label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: var(--settings-muted);
}

.engine-picks {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin: 12px 0 14px;
}

.engine-pick {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  min-height: 96px;
  padding: 12px 14px;
  border: 1px solid var(--settings-border);
  border-radius: 14px;
  background: #fff;
  text-align: left;
  cursor: pointer;
}

.engine-pick strong {
  font-size: 14px;
  font-weight: 800;
  color: var(--settings-text);
}

.engine-pick span {
  color: var(--settings-muted);
  font-size: 12px;
  line-height: 1.45;
}

.engine-pick.active {
  border-color: color-mix(in srgb, var(--settings-primary) 50%, white);
  background: var(--settings-primary-soft);
}

.engine-pick.active strong {
  color: #4338ca;
}

.create-scrim {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(20, 16, 40, 0.42);
  backdrop-filter: blur(8px);
}

.create-sheet {
  width: min(720px, 100%);
  max-height: calc(100vh - 48px);
  overflow: auto;
  padding: 22px 24px 18px;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 22px 60px rgba(28, 22, 50, 0.22);
}

.create-sheet-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.create-sheet-head h3 {
  margin: 4px 0 6px;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.03em;
}

.create-sheet-head p {
  margin: 0;
  color: var(--settings-muted);
  font-size: 13px;
  line-height: 1.55;
}

.create-close {
  flex-shrink: 0;
  padding: 6px 10px;
  border: 0;
  border-radius: 999px;
  background: var(--settings-soft);
  color: var(--settings-muted);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.create-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
  color: var(--settings-muted);
  font-size: 12px;
  font-weight: 700;
}

.create-field input {
  width: 100%;
  min-height: 40px;
  padding: 8px 12px;
  border: 1px solid var(--settings-border);
  border-radius: 12px;
  background: #fff;
  color: var(--settings-text);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
}

.create-field input:focus {
  outline: 2px solid color-mix(in srgb, var(--settings-primary) 35%, white);
  outline-offset: 1px;
}

.create-cats {
  margin: 4px 0 14px;
  color: var(--settings-muted);
  font-size: 12px;
  font-weight: 700;
}

.create-cat-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.create-cat {
  min-height: 30px;
  padding: 0 12px;
  border: 1px solid var(--settings-border);
  border-radius: 999px;
  background: #fff;
  color: var(--settings-muted);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.create-cat.active {
  border-color: color-mix(in srgb, var(--settings-primary) 45%, white);
  background: var(--settings-primary-soft);
  color: #4338ca;
}

.create-more {
  margin: 4px 0 16px;
  color: var(--settings-muted);
  font-size: 12px;
  font-weight: 700;
}

.create-more summary {
  cursor: pointer;
}

.create-more .create-field {
  margin-top: 12px;
}

.create-sheet-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.create-sheet-foot .settings-action-pill:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

@media (max-width: 960px) {
  .skills-split {
    grid-template-columns: 1fr;
  }

  .skills-list {
    max-height: 280px;
  }

  .engine-picks {
    grid-template-columns: 1fr;
  }
}
</style>
