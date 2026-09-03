<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { createAuthUser, deleteAuthUser, getAuthStatus, listAuthUsers } from '@/api/auth'
import { ACCOUNT_ROLES, roleLabel } from '@/utils/iam'
import { apiErrorMessage } from '@/utils/apiError'
import { formatCreatedAt } from '@/utils/formatTime'
import './settings-ui.css'

const USER_RE = /^[A-Za-z][A-Za-z0-9._-]{1,31}$/
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

const loading = ref(false)
const saving = ref(false)
const users = ref([])
const meId = ref('')
const keyword = ref('')
const roleFilter = ref('')
const dialogOpen = ref(false)
const form = reactive({
  username: '',
  name: '',
  email: '',
  password: '',
  role: 'user',
})

const filtered = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  return users.value.filter((row) => {
    if (roleFilter.value && row.role !== roleFilter.value) return false
    if (!q) return true
    return [row.username, row.name, row.email, row.role, roleLabel(row.role)]
      .join(' ')
      .toLowerCase()
      .includes(q)
  })
})

const statusText = (row) => {
  if (row.user_id === meId.value) return '当前登录'
  if (!row.email) return '可用'
  if (row.email_verified === false) return '邮箱未验证'
  return '正常'
}

const load = async () => {
  loading.value = true
  try {
    const [listRes, meRes] = await Promise.all([listAuthUsers(), getAuthStatus()])
    users.value = listRes?.data?.users || []
    meId.value = String(meRes?.data?.user_id || '')
  } catch (e) {
    ElMessage.error(apiErrorMessage(e, '加载账号失败'))
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  form.username = ''
  form.name = ''
  form.email = ''
  form.password = ''
  form.role = 'user'
}

const openCreate = () => {
  resetForm()
  dialogOpen.value = true
}

const addUser = async () => {
  const username = form.username.trim()
  if (!username) {
    ElMessage.warning('请填写账号')
    return
  }
  if (!USER_RE.test(username)) {
    ElMessage.warning('账号用 2–32 位字母开头，可含数字、点、下划线或短横线')
    return
  }
  if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) {
    ElMessage.warning('邮箱格式不对')
    return
  }
  if (form.password.length < 8) {
    ElMessage.warning('密码至少 8 位')
    return
  }
  saving.value = true
  try {
    await createAuthUser({
      username,
      password: form.password,
      name: form.name.trim(),
      email: form.email.trim(),
      role: form.role,
    })
    ElMessage.success('已添加账号')
    dialogOpen.value = false
    resetForm()
    await load()
  } catch (e) {
    ElMessage.error(apiErrorMessage(e, '添加失败'))
  } finally {
    saving.value = false
  }
}

const removeUser = async (row) => {
  if (row.user_id === meId.value) {
    ElMessage.warning('不能删当前登录的账号')
    return
  }
  try {
    await ElMessageBox.confirm(`删除账号「${row.username || row.name}」？`, '删除账号', { type: 'warning' })
  } catch {
    return
  }
  try {
    await deleteAuthUser(row.user_id, row.username || row.name || row.user_id)
    ElMessage.success('已删除')
    await load()
  } catch (e) {
    ElMessage.error(apiErrorMessage(e, '删除失败'))
  }
}

onMounted(load)
</script>

<template>
  <div class="settings-panel accounts-page wide-panel" v-loading="loading">
    <header class="settings-page-header">
      <div>
        <h2 class="settings-page-title">成员</h2>
      </div>
      <div class="settings-toolbar">
        <div class="settings-summary-pill">{{ users.length }} 个账号</div>
        <button type="button" class="settings-action-pill" @click="openCreate">
          添加成员<span class="settings-action-arrow">→</span>
        </button>
      </div>
    </header>

    <div class="settings-toolbar">
      <el-input
        v-model="keyword"
        class="toolbar-search"
        clearable
        :prefix-icon="Search"
        placeholder="搜索账号 / 名称 / 邮箱"
      />
      <el-select v-model="roleFilter" class="filter-item" clearable placeholder="账号角色">
        <el-option v-for="row in ACCOUNT_ROLES" :key="row.id" :label="row.label" :value="row.id" />
      </el-select>
    </div>

    <section class="settings-table-card">
      <el-table :data="filtered" empty-text="暂无数据">
        <el-table-column label="账号" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.username || '—' }}</template>
        </el-table-column>
        <el-table-column label="名称" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.name || '—' }}</template>
        </el-table-column>
        <el-table-column label="邮箱" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.email || '—' }}</template>
        </el-table-column>
        <el-table-column label="账号角色" min-width="120">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ roleLabel(row.role) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">{{ statusText(row) }}</template>
        </el-table-column>
        <el-table-column label="创建时间" min-width="170">
          <template #default="{ row }">{{ formatCreatedAt(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button
              link
              type="danger"
              :disabled="row.user_id === meId"
              @click="removeUser(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <el-dialog v-model="dialogOpen" title="添加成员" width="480px" class="mo-fit-dialog" destroy-on-close>
      <form class="settings-form-stack" @submit.prevent="addUser">
        <label>
          账号
          <input v-model="form.username" type="text" autocomplete="off" placeholder="字母开头，如 admin" />
        </label>
        <label>
          名称
          <input v-model="form.name" type="text" autocomplete="off" placeholder="可选" />
        </label>
        <label>
          邮箱
          <input v-model="form.email" type="email" autocomplete="off" placeholder="可选，Studio 邮箱登录用" />
        </label>
        <label>
          账号角色
          <el-select v-model="form.role" style="width: 100%">
            <el-option v-for="row in ACCOUNT_ROLES" :key="row.id" :label="row.label" :value="row.id" />
          </el-select>
        </label>
        <label>
          密码
          <input v-model="form.password" type="password" autocomplete="new-password" placeholder="至少 8 位" />
        </label>
      </form>
      <template #footer>
        <el-button @click="dialogOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="addUser">添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.settings-form-stack label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--settings-text);
}
.settings-form-stack input {
  height: 40px;
  border: 1px solid var(--settings-border);
  border-radius: 10px;
  padding: 0 12px;
  font-size: 14px;
  color: var(--settings-text);
  background: var(--settings-card);
}
.settings-form-stack input:focus {
  outline: none;
  border-color: var(--settings-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--settings-primary) 18%, transparent);
}
</style>
