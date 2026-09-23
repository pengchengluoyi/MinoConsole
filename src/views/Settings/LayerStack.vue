<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getLayerStack, saveLayerStack } from '@/api/settings'
import './settings-ui.css'

const loading = ref(false)
const saving = ref(false)
const stack = ref({ drivers: [], skills: [], roles: [], triggers: [] })

const findBy = (layer, id) => (stack.value[layer] || []).find((row) => row.id === id) || null
const roleLabel = (id) => findBy('roles', id)?.label || '未指定角色'
const skillLabel = (id) => findBy('skills', id)?.label || '未指定技能'
const driverLabel = (id) => findBy('drivers', id)?.label || id

const allSkills = computed(() => stack.value.skills || [])

const apply = (data) => {
  if (data) stack.value = data
}

const load = async () => {
  loading.value = true
  try {
    const res = await getLayerStack()
    apply(res?.data)
  } catch (e) {
    ElMessage.error(e?.response?.data?.detail || e?.message || '加载编排失败')
  } finally {
    loading.value = false
  }
}

const persist = async (patch) => {
  if (saving.value) return
  saving.value = true
  try {
    const res = await saveLayerStack(patch)
    apply(res?.data)
    ElMessage.success('已保存')
  } catch (e) {
    ElMessage.error(e?.response?.data?.detail || e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

const roleSkillsMap = () => Object.fromEntries((stack.value.roles || []).map((row) => [row.id, [...(row.skill_ids || [])]]))
const skillDriversMap = () => Object.fromEntries((stack.value.skills || []).map((row) => [row.id, [...(row.driver_ids || [])]]))
const triggerRolesMap = () => Object.fromEntries((stack.value.triggers || []).map((row) => [row.id, { ...(row.roles || {}) }]))
const triggerSkillsMap = () => Object.fromEntries((stack.value.triggers || []).map((row) => [row.id, { ...(row.skills || {}) }]))

const pathsOf = (trigger) => {
  if (Array.isArray(trigger?.paths) && trigger.paths.length) return trigger.paths
  const intents = trigger?.intents?.length ? trigger.intents : Object.keys(trigger?.roles || { default: '' })
  const keys = intents.length ? intents : ['default']
  const labels = trigger?.intent_labels || {}
  return keys.map((intent) => {
    const roleId = (trigger?.roles || {})[intent] || ''
    const skillId = (trigger?.skills || {})[intent] || ''
    const skill = findBy('skills', skillId)
    return {
      intent,
      intent_label: labels[intent] || (intent === 'default' ? '默认' : intent),
      role_id: roleId,
      skill_id: skillId,
      driver_ids: skill?.driver_ids || [],
    }
  })
}

const setPathRole = (trigger, path, roleId) => {
  const trigger_roles = triggerRolesMap()
  trigger_roles[trigger.id] = { ...(trigger_roles[trigger.id] || {}), [path.intent]: roleId }
  const role_skills = roleSkillsMap()
  const owned = role_skills[roleId] || []
  let skillId = path.skill_id
  if (!owned.includes(skillId)) {
    skillId = owned[0] || skillId
    if (skillId && !owned.includes(skillId)) {
      role_skills[roleId] = [...owned, skillId]
    }
  }
  const trigger_skills = triggerSkillsMap()
  trigger_skills[trigger.id] = { ...(trigger_skills[trigger.id] || {}), [path.intent]: skillId }
  persist({ trigger_roles, trigger_skills, role_skills })
}

const setPathSkill = (trigger, path, skillId) => {
  const trigger_skills = triggerSkillsMap()
  trigger_skills[trigger.id] = { ...(trigger_skills[trigger.id] || {}), [path.intent]: skillId }
  const role_skills = roleSkillsMap()
  const roleId = path.role_id
  if (roleId && skillId && !(role_skills[roleId] || []).includes(skillId)) {
    role_skills[roleId] = [...(role_skills[roleId] || []), skillId]
  }
  persist({ trigger_skills, role_skills })
}

const togglePathDriver = (skillId, driverId) => {
  if (!skillId) return
  const skill_drivers = skillDriversMap()
  const cur = new Set(skill_drivers[skillId] || [])
  if (cur.has(driverId)) cur.delete(driverId)
  else cur.add(driverId)
  skill_drivers[skillId] = [...cur]
  persist({ skill_drivers })
}

const reset = async () => {
  if (saving.value) return
  saving.value = true
  try {
    const res = await saveLayerStack({ reset: true })
    apply(res?.data)
    ElMessage.success('已恢复默认')
  } catch (e) {
    ElMessage.error(e?.response?.data?.detail || e?.message || '恢复失败')
  } finally {
    saving.value = false
  }
}

const impactText = (path) => {
  const role = roleLabel(path.role_id)
  const skill = skillLabel(path.skill_id)
  const hands = (path.driver_ids || []).map(driverLabel)
  if (!path.role_id) return '还没指定谁来处理。'
  if (!path.skill_id) return `交给「${role}」，但还没指定做什么。`
  if (!hands.length) return `交给「${role}」做「${skill}」，只回文本或落库，不调外部系统。`
  return `交给「${role}」做「${skill}」，用手：${hands.join('、')}。`
}

const pathSentence = (path) => {
  const hands = (path.driver_ids || []).map(driverLabel)
  return [
    roleLabel(path.role_id),
    skillLabel(path.skill_id),
    hands.length ? hands.join('、') : '不调驱动',
  ].join(' → ')
}

onMounted(load)
</script>

<template>
  <div class="settings-panel wide-panel" v-loading="loading">
    <header class="settings-page-header">
      <div>
        <h2 class="settings-page-title">编排</h2>
        <p class="settings-page-desc">
          入口来了走哪条路：选哪个
          <router-link to="/roles">角色</router-link>、去做哪条
          <router-link to="/skills">技能</router-link>、能用哪只手。
          不写 prompt，也不改技能怎么跑。
        </p>
      </div>
      <button type="button" class="settings-action-pill" :disabled="saving" @click="reset">
        恢复默认
        <span class="settings-action-arrow">→</span>
      </button>
    </header>

    <p class="relation-map">
      <em>入口</em>
      <span>→</span>
      <router-link to="/roles">角色 · 谁出面</router-link>
      <span>→</span>
      <router-link to="/skills">技能 · 做什么</router-link>
      <span>→</span>
      <span>扩展包 / 手（Studio）</span>
    </p>

    <p v-if="!loading && !(stack.triggers || []).length" class="settings-page-desc">暂无数据</p>

    <div class="stack-paths">
    <article
      v-for="trigger in stack.triggers"
      :key="trigger.id"
      class="settings-card stack-entry"
    >
      <div class="stack-entry-head">
        <div>
          <div class="settings-kicker">入口</div>
          <h3>{{ trigger.label }}</h3>
          <p>{{ trigger.summary }}</p>
        </div>
        <span class="settings-summary-pill" :class="trigger.live ? '' : 'is-muted'">
          {{ trigger.live ? '已接通' : '还没接通' }}
        </span>
      </div>

      <div v-for="path in pathsOf(trigger)" :key="`${trigger.id}-${path.intent}`" class="stack-path">
        <div class="settings-kicker">{{ path.intent_label }}</div>

        <template v-if="trigger.live">
          <el-form label-position="top" class="settings-form-stack">
            <el-form-item label="交给谁（角色）">
              <el-select
                :model-value="path.role_id"
                placeholder="选择角色"
                style="width: 100%"
                :disabled="saving"
                @change="setPathRole(trigger, path, $event)"
              >
                <el-option
                  v-for="row in stack.roles"
                  :key="row.id"
                  :label="row.label"
                  :value="row.id"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="去做哪件事（技能）">
              <el-select
                :model-value="path.skill_id"
                placeholder="选择技能"
                style="width: 100%"
                :disabled="saving || !path.role_id"
                @change="setPathSkill(trigger, path, $event)"
              >
                <el-option
                  v-for="row in allSkills"
                  :key="row.id"
                  :label="row.label"
                  :value="row.id"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="用哪只手">
              <div class="stack-hands">
                <label v-for="row in stack.drivers" :key="row.id" class="stack-hand">
                  <el-checkbox
                    :model-value="(path.driver_ids || []).includes(row.id)"
                    :disabled="saving || !path.skill_id"
                    @change="togglePathDriver(path.skill_id, row.id)"
                  />
                  <span>{{ row.label }}</span>
                  <small>{{ row.ready ? row.hint : (row.hint || row.summary || '未连接') }}</small>
                </label>
              </div>
            </el-form-item>
          </el-form>
          <p>{{ impactText(path) }}</p>
        </template>

        <p v-else>{{ pathSentence(path) }}</p>
      </div>
    </article>
    </div>
  </div>
</template>

<style scoped>
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
</style>
