<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createRobotIntegration,
  deleteRobotIntegration,
  listRobotIntegrations,
  updateRobotIntegration,
} from '@/api/settings'
import { apiErrorMessage } from '@/utils/apiError'

const props = defineProps({
  platform: { type: String, default: '' },
})

const FIELDS = {
  lark: [
    { key: 'app_id', label: 'App ID' },
    { key: 'app_secret', label: 'App Secret', secret: true },
  ],
  wecom: [
    { key: 'webhook_url', label: 'Webhook', secret: true },
    { key: 'secret', label: '加签 Secret', secret: true },
  ],
  dingtalk: [
    { key: 'webhook_url', label: 'Webhook', secret: true },
    { key: 'secret', label: '加签 Secret', secret: true },
  ],
  slack: [
    { key: 'webhook_url', label: 'Webhook', secret: true },
  ],
}

const loading = ref(false)
const saving = ref(false)
const bots = ref([])
const dialogOpen = ref(false)
const editingId = ref('')
const form = reactive({ name: '', credentials: {} })

const fields = computed(() => FIELDS[props.platform] || FIELDS.lark)
const visible = computed(() => {
  if (!props.platform) return bots.value
  return bots.value.filter((b) => b.platform === props.platform)
})

const load = async () => {
  loading.value = true
  try {
    const res = await listRobotIntegrations()
    bots.value = res?.data?.items || res?.data?.bots || res?.data || []
    if (!Array.isArray(bots.value)) bots.value = []
  } catch (e) {
    bots.value = []
    ElMessage.error(apiErrorMessage(e, '加载机器人失败'))
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  form.name = ''
  form.credentials = {}
  editingId.value = ''
}

const openCreate = () => {
  resetForm()
  dialogOpen.value = true
}

const openEdit = (row) => {
  editingId.value = row.id
  form.name = row.name || ''
  form.credentials = { ...(row.credentials || {}) }
  dialogOpen.value = true
}

const save = async () => {
  saving.value = true
  try {
    const payload = {
      platform: props.platform,
      name: form.name.trim() || '机器人',
      credentials: { ...form.credentials },
    }
    if (editingId.value) await updateRobotIntegration(editingId.value, payload)
    else await createRobotIntegration(payload)
    dialogOpen.value = false
    await load()
    ElMessage.success('已保存')
  } catch (e) {
    ElMessage.error(apiErrorMessage(e, '保存失败'))
  } finally {
    saving.value = false
  }
}

const remove = async (row) => {
  try {
    await ElMessageBox.confirm(`删除 ${row.name || row.id}？`, '删除', { type: 'warning' })
    await deleteRobotIntegration(row.id)
    await load()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(apiErrorMessage(e, '删除失败'))
  }
}

onMounted(load)
</script>

<template>
  <section class="settings-table-card" v-loading="loading">
    <div class="robots-head">
      <div class="settings-kicker">机器人</div>
      <el-button type="primary" size="small" @click="openCreate">新增</el-button>
    </div>
    <el-table :data="visible" border stripe size="small" empty-text="暂无数据">
      <el-table-column label="名称" min-width="140">
        <template #default="{ row }">{{ row.name || row.id }}</template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">{{ row.configured ? '已连接' : '待连接' }}</template>
      </el-table-column>
      <el-table-column label="" width="140">
        <template #default="{ row }">
          <el-button text @click="openEdit(row)">编辑</el-button>
          <el-button text @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogOpen" :title="editingId ? '编辑机器人' : '新增机器人'" width="480px">
      <el-form label-position="top" class="settings-form-stack">
        <el-form-item label="名称">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item v-for="field in fields" :key="field.key" :label="field.label">
          <el-input
            v-model="form.credentials[field.key]"
            :type="field.secret ? 'password' : 'text'"
            show-password
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.robots-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
</style>
