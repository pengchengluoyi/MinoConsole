<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Promotion, Search } from '@element-plus/icons-vue'
import { chatAIRole, getLayerStack, listAIRoles, listAISkills, saveLayerStack } from '@/api/settings'
import './settings-ui.css'

const STARTERS = {
  conductor: ['执行一条用例时每一步该调谁？', '需求刚贴进来下一步做什么？', 'Plan 模式失败了该调什么能力？'],
  'req-analyst': ['入口在哪一页？新增和维持的能力分别是什么？', '文档里的运营平台要怎么测？', '上传失败有没有兜底？'],
  'mindmap-writer': ['按入口和端铺一张测试脑图', '传图定制和创意定制怎么拆开？'],
  'case-writer': ['从我的进定制模版再写步骤', '图片上传失败怎么写成用例？'],
  'req-qa-bm': ['这条需求怎么验收？', '用例覆盖够不够？', '失败了该退回还是带风险验收？'],
  'version-qa-bm': ['这一版能不能发？', '回归范围怎么圈？', '哪些需求还不该纳入？'],
  'test-engineer': ['登录失败了下一步怎么查？', '按「我要发造物秀」租一个测试账号', '没有截图时你怎么工作？'],
  'report-writer': ['根据这些结果写一份测试报告', '没有上一版本时发版报告怎么写？', '相对 1.0.0 新增和修改分别写什么？'],
  'doc-keeper': ['飞书 Wiki 我们能建哪些东西？', '测试完成后状态怎么回写？', '没有飞书插件时你输出什么？'],
  'im-qa-assistant': ['登录失败了，下令下一步怎么查', '这条需求接下来调谁、做什么', '下发一轮冒烟还缺什么'],
  'im-defect-assistant': ['提缺陷：登录页点登录没反应', '缺步骤时你会问什么？', '这是闲聊你会怎么拒绝？'],
}

const DEFAULT_STARTERS = ['用一句话介绍你自己。', '你能派出哪些技能？', '编排什么时候会选中你？']

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const sending = ref(false)
const catalog = ref({ product: [], skills: [], jobs: [] })
const keyword = ref('')
const selectedId = ref('')
const explainMode = ref(true)
const draft = ref('')
const messages = ref([])
const chatEnd = ref(null)
const tokenStats = ref({ prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, turns: 0 })
const skillSaving = ref(false)

const allRoles = computed(() => catalog.value.product || [])
const allSkills = computed(() => catalog.value.skills || [])
const allJobs = computed(() => catalog.value.jobs || [])
const currentList = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  if (!q) return allRoles.value
  return allRoles.value.filter((row) =>
    [row.label, row.summary, ...(row.used_in || []), ...(row.skill_ids || [])].join(' ').toLowerCase().includes(q),
  )
})

const skillById = (id) => allJobs.value.find((row) => row.id === id) || allSkills.value.find((row) => row.id === id) || null
const boundSkills = (row) => (row?.skill_ids || []).map(skillById).filter(Boolean)
const skillNames = (row) => boundSkills(row).map((s) => s.label).join(' · ') || '还没绑定技能'
const selected = computed(() => allRoles.value.find((row) => row.id === selectedId.value) || currentList.value[0] || null)
const selectedSkills = computed(() => boundSkills(selected.value))
const starters = computed(() => STARTERS[selected.value?.id] || DEFAULT_STARTERS)
const tokenLabel = computed(() => {
  const s = tokenStats.value
  if (!s.turns) return '本轮对话还没有 token'
  return `本轮 入 ${s.prompt_tokens} / 出 ${s.completion_tokens} · 共 ${s.total_tokens}`
})
const bindOptions = computed(() => (allJobs.value.length ? allJobs.value : allSkills.value))

const calledLabel = (row) => {
  const v = row?.called || (row?.live ? 'wired' : 'sandbox')
  if (v === 'wired') return '流程里会调'
  if (v === 'gated') return '执行时会调'
  if (v === 'unused') return '未接入'
  if (v === 'sandbox') return '仅对话'
  return v
}

const calledClass = (row) => {
  const v = row?.called || ''
  if (v === 'unused') return 'is-observe'
  return 'is-live'
}

const syncQuery = () => {
  const role = String(route.query.role || '').trim()
  if (role) selectedId.value = role
}

const pushQuery = () => {
  if (!selectedId.value) return
  if (String(route.query.role || '') === selectedId.value) return
  router.replace({ path: '/roles', query: { role: selectedId.value } })
}

const resetTokens = () => {
  tokenStats.value = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, turns: 0 }
}

const addUsage = (usage) => {
  const u = usage || {}
  tokenStats.value = {
    prompt_tokens: tokenStats.value.prompt_tokens + Number(u.prompt_tokens || 0),
    completion_tokens: tokenStats.value.completion_tokens + Number(u.completion_tokens || 0),
    total_tokens: tokenStats.value.total_tokens + Number(u.total_tokens || 0),
    turns: tokenStats.value.turns + 1,
  }
}

const selectRole = (row) => {
  if (!row?.id) return
  if (selectedId.value !== row.id) {
    selectedId.value = row.id
    messages.value = []
    draft.value = ''
    resetTokens()
  }
  pushQuery()
}

const openSkill = (skill) => {
  if (!skill?.id) return
  router.push({ path: '/skills', query: { skill: skill.id } })
}

const scrollChat = async () => {
  await nextTick()
  chatEnd.value?.scrollIntoView({ behavior: 'smooth', block: 'end' })
}

const send = async (text) => {
  const content = String(text || draft.value || '').trim()
  const role = selected.value
  if (!content || !role || sending.value) return
  draft.value = ''
  messages.value = [...messages.value, { role: 'user', content }]
  sending.value = true
  await scrollChat()
  try {
    const res = await chatAIRole({
      role_id: role.id,
      messages: messages.value.map((item) => ({ role: item.role, content: item.content })),
      explain_mode: explainMode.value,
    })
    const reply = res?.data?.reply || ''
    if (!reply) throw new Error(res?.msg || '模型没有返回内容')
    addUsage(res?.data?.usage)
    messages.value = [...messages.value, { role: 'assistant', content: reply }]
    await scrollChat()
  } catch (e) {
    const detail = e?.response?.data?.detail || e?.message || '对话失败'
    ElMessage.error(detail)
    messages.value = messages.value.slice(0, -1)
    draft.value = content
  } finally {
    sending.value = false
  }
}

const mergeStack = (rolesData, stack, skillPack) => {
  const next = {
    ...(rolesData || {}),
    product: [...(rolesData?.product || [])],
    skills: [...(skillPack?.skills || rolesData?.skills || [])],
    jobs: [...(rolesData?.jobs || [])],
  }
  const byRole = Object.fromEntries((stack?.roles || []).map((row) => [row.id, row.skill_ids || []]))
  next.product = next.product.map((row) => ({
    ...row,
    skill_ids: byRole[row.id] || row.skill_ids || [],
  }))
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
      rolesRes?.data || { product: [], skills: [] },
      stackRes?.data,
      skillRes?.data,
    )
    if (!allRoles.value.some((row) => row.id === selectedId.value)) {
      selectedId.value = allRoles.value[0]?.id || ''
    }
  } catch (e) {
    ElMessage.error(e?.response?.data?.detail || '加载角色失败')
  } finally {
    loading.value = false
  }
}

const persistSkills = async (roleId, skillIds) => {
  if (!roleId || skillSaving.value) return
  skillSaving.value = true
  try {
    const role_skills = Object.fromEntries(
      allRoles.value.map((row) => [row.id, row.id === roleId ? skillIds : [...(row.skill_ids || [])]]),
    )
    await saveLayerStack({ role_skills })
    ElMessage.success('技能绑定已保存')
    await load()
  } catch (e) {
    ElMessage.error(e?.response?.data?.detail || e?.message || '保存绑定失败')
  } finally {
    skillSaving.value = false
  }
}

watch(() => route.query.role, syncQuery)

onMounted(async () => {
  syncQuery()
  await load()
  pushQuery()
})
</script>

<template>
  <div class="settings-panel roles-page wide-panel" v-loading="loading">
    <header class="settings-page-header">
      <div>
        <h2 class="settings-page-title">角色</h2>
        <p class="settings-page-desc">
          角色是「谁出面」。
          <router-link to="/stack">编排</router-link>
          在入口选角色，角色再派出绑定的
          <router-link to="/skills">技能</router-link>。
          干活的 prompt 在技能页；这里只绑定技能，并可用这个身份试对话。
        </p>
      </div>
      <div class="settings-summary-pill">{{ allRoles.length }} 个角色</div>
    </header>

    <p class="relation-map">
      <router-link to="/stack">入口</router-link>
      <span>→</span>
      <em>角色 · 谁出面</em>
      <span>→</span>
      <router-link to="/skills">技能 · 做什么</router-link>
      <span>→</span>
      <span>扩展包（Studio）</span>
    </p>

    <div class="roles-split">
      <aside class="settings-card roles-list">
        <el-input
          v-model="keyword"
          clearable
          :prefix-icon="Search"
          placeholder="搜索角色"
        />
        <button
          v-for="row in currentList"
          :key="row.id"
          type="button"
          class="role-item"
          :class="{ active: selected?.id === row.id }"
          @click="selectRole(row)"
        >
          <div class="role-item-head">
            <strong>{{ row.label }}</strong>
            <span class="role-tag" :class="calledClass(row)">
              {{ (row.skill_ids || []).length }} 项技能
            </span>
          </div>
          <p>{{ skillNames(row) }}</p>
        </button>
        <p v-if="!currentList.length" class="empty-hint">没有匹配的角色</p>
      </aside>

      <section class="roles-detail" v-if="selected">
        <section class="settings-card role-meta">
          <div class="role-meta-head">
            <div>
              <div class="settings-kicker">{{ selected.group === 'abstract' ? '调度角色' : '角色' }}</div>
              <h3>{{ selected.label }}</h3>
              <p>{{ selected.summary }}</p>
            </div>
            <span class="role-tag" :class="calledClass(selected)">
              {{ calledLabel(selected) }}
            </span>
          </div>
          <dl class="role-facts">
            <div>
              <dt>何时被选中</dt>
              <dd>{{ (selected.triggers || []).join('；') || '设置页试对话' }}</dd>
            </div>
            <div>
              <dt>会派出</dt>
              <dd>{{ selectedSkills.length ? selectedSkills.map((s) => s.label).join(' · ') : '还没绑定技能' }}</dd>
            </div>
            <div>
              <dt>用途</dt>
              <dd>{{ (selected.used_in || []).join(' · ') || '—' }}</dd>
            </div>
          </dl>

          <div class="related">
            <span>绑定的技能 · 点进去改 prompt</span>
            <button
              v-for="skill in selectedSkills"
              :key="skill.id"
              type="button"
              class="cap-chip"
              @click="openSkill(skill)"
            >
              {{ skill.label }}
            </button>
            <span v-if="!selectedSkills.length" class="empty-hint">未绑定。编排选中这个角色后将无技能可跑。</span>
            <el-select
              class="skill-picker"
              :model-value="selected.skill_ids || []"
              multiple
              collapse-tags
              collapse-tags-tooltip
              filterable
              :disabled="skillSaving"
              placeholder="添加或移除技能"
              @change="(ids) => persistSkills(selected.id, ids)"
            >
              <el-option v-for="skill in bindOptions" :key="skill.id" :label="skill.label" :value="skill.id" />
            </el-select>
          </div>
        </section>

        <section class="settings-card chat-card">
          <div class="chat-toolbar">
            <div>
              <div class="settings-kicker">用这个身份试对话</div>
              <p>只验证角色怎么说话，不会跑绑定技能，也不会点真机。</p>
              <p>{{ tokenLabel }}</p>
            </div>
            <label class="mode-toggle">
              <input v-model="explainMode" type="checkbox" />
              讲解模式
            </label>
          </div>

          <div class="chat-log">
            <div v-if="!messages.length" class="chat-empty">
              <p>暂无对话</p>
              <div class="starter-row">
                <button
                  v-for="item in starters"
                  :key="item"
                  type="button"
                  class="settings-action-pill"
                  @click="send(item)"
                >
                  {{ item }}
                </button>
              </div>
            </div>
            <div v-for="(item, idx) in messages" :key="idx" class="bubble" :class="item.role">
              <span>{{ item.role === 'user' ? '你' : selected.label }}</span>
              <pre>{{ item.content }}</pre>
            </div>
            <div v-if="sending" class="bubble assistant pending">
              <span>{{ selected.label }}</span>
              <p>正在回复…</p>
            </div>
            <div ref="chatEnd" />
          </div>

          <div class="chat-composer">
            <el-input
              v-model="draft"
              type="textarea"
              :rows="2"
              resize="none"
              placeholder="用这个角色的身份提问…"
              @keydown.enter.exact.prevent="send()"
            />
            <button
              type="button"
              class="settings-action-pill send-pill"
              :disabled="sending || !draft.trim()"
              @click="send()"
            >
              发送
              <span class="settings-action-arrow">
                <el-icon><Promotion /></el-icon>
              </span>
            </button>
          </div>
        </section>
      </section>
    </div>
  </div>
</template>

<style scoped>
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

.roles-split {
  display: grid;
  grid-template-columns: minmax(220px, 300px) minmax(0, 1fr);
  gap: 16px;
  align-items: stretch;
  min-height: min(62vh, 640px);
}

.roles-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  max-height: min(70vh, 760px);
  overflow: auto;
}

.skill-picker {
  flex: 1 1 220px;
  min-width: 200px;
}

.roles-list :deep(.el-input) {
  margin-bottom: 4px;
}

.role-item {
  display: block;
  width: 100%;
  padding: 12px 12px 10px;
  border: 1px solid var(--settings-border);
  border-radius: 12px;
  background: var(--settings-soft);
  text-align: left;
  cursor: pointer;
}

.role-item p {
  margin: 6px 0 0;
  color: var(--settings-muted);
  font-size: 12px;
  line-height: 1.5;
}

.role-item.active {
  border-color: color-mix(in srgb, var(--settings-primary) 45%, white);
  background: var(--settings-primary-soft);
}

.role-item-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.role-item-head strong {
  font-size: 13px;
  font-weight: 750;
  color: var(--settings-text);
  overflow-wrap: anywhere;
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

.role-tag.is-observe {
  background: #eef2ff;
  color: #4338ca;
}

.empty-hint {
  margin: 8px 4px;
  color: var(--settings-muted);
  font-size: 12px;
}

.roles-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  min-height: 0;
}

.role-meta h3 {
  margin: 4px 0 6px;
  font-size: 18px;
  font-weight: 800;
}

.role-meta p {
  margin: 0;
  color: var(--settings-muted);
  font-size: 13px;
  line-height: 1.6;
}

.role-meta-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.role-facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 16px 0 0;
}

.role-facts dt {
  color: var(--settings-muted);
  font-size: 11px;
  font-weight: 700;
}

.role-facts dd {
  margin: 4px 0 0;
  color: var(--settings-text);
  font-size: 12px;
  line-height: 1.5;
  word-break: break-all;
}

.related {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
}

.related > span {
  flex: 0 0 100%;
  color: var(--settings-muted);
  font-size: 12px;
  font-weight: 700;
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

.chat-card {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 280px;
}

.chat-toolbar {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 12px;
}

.chat-toolbar p {
  margin: 4px 0 0;
  color: var(--settings-muted);
  font-size: 12px;
}

.mode-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--settings-muted);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  user-select: none;
}

.mode-toggle input {
  accent-color: var(--settings-primary);
}

.chat-log {
  flex: 1;
  min-height: 180px;
  overflow: auto;
  padding: 12px;
  border: 1px solid var(--settings-border);
  border-radius: 12px;
  background: #f8fafc;
}

.chat-empty p {
  margin: 0 0 10px;
  color: var(--settings-muted);
  font-size: 13px;
}

.starter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.bubble {
  margin-bottom: 12px;
}

.bubble span {
  display: block;
  margin-bottom: 4px;
  color: var(--settings-muted);
  font-size: 11px;
  font-weight: 700;
}

.bubble pre,
.bubble p {
  margin: 0;
  padding: 10px 12px;
  border-radius: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 13px;
  line-height: 1.6;
  font-family: inherit;
}

.bubble.user pre {
  background: #eef2ff;
  color: #312e81;
}

.bubble.assistant pre,
.bubble.assistant p {
  background: #fff;
  border: 1px solid var(--settings-border);
  color: var(--settings-text);
}

.bubble.pending p {
  color: var(--settings-muted);
}

.chat-composer {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  margin-top: 12px;
}

.chat-composer :deep(.el-textarea) {
  min-width: 0;
  flex: 1;
}

.chat-composer :deep(.el-textarea__inner) {
  border-radius: 12px;
}

.send-pill {
  flex-shrink: 0;
  min-height: 36px;
}

.send-pill:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

@media (max-width: 960px) {
  .roles-split {
    grid-template-columns: 1fr;
    min-height: 0;
  }

  .roles-list {
    max-height: 280px;
  }

  .role-facts {
    grid-template-columns: 1fr;
  }
}
</style>
