<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { createPack, listPackRoots } from '@/api/packs'
import { writeUnavailableMessage } from '@/utils/apiError'

const ID_RE = /^[A-Za-z][A-Za-z0-9_-]{1,63}$/

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  kind: { type: String, default: 'recovery' },
  appId: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue', 'created'])

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const roots = ref([])
const form = ref({ root: 'team', pack_id: 'adhoc', id: '', owner: '', app_id: '' })
const saving = ref(false)

const writableRoots = computed(() => roots.value.filter((r) => r.writable))

const load = async () => {
  try {
    const res = await listPackRoots({ app_id: props.appId || undefined })
    roots.value = res?.data?.roots || []
    if (!writableRoots.value.some((r) => r.root === form.value.root)) {
      form.value.root = writableRoots.value[0]?.root || ''
    }
  } catch (e) {
    ElMessage.error(writeUnavailableMessage(e, '读取可写位置失败'))
  }
}

const submit = async () => {
  const id = form.value.id.trim()
  if (!id) {
    ElMessage.warning('先填条目标识')
    return
  }
  if (!ID_RE.test(id)) {
    ElMessage.warning('标识用字母开头，2–64 位，可含数字、下划线或短横线')
    return
  }
  if (!form.value.root || !writableRoots.value.length) {
    ElMessage.warning('没有可写位置，不能新建')
    return
  }
  if (form.value.root === 'app' && !(form.value.app_id || props.appId).trim()) {
    ElMessage.warning('应用私有位置需要填写应用标识')
    return
  }
  saving.value = true
  try {
    const res = await createPack({
      kind: props.kind,
      root: form.value.root,
      app_id: (form.value.app_id || props.appId || '').trim(),
      pack_id: form.value.pack_id.trim() || 'adhoc',
      id,
      owner: form.value.owner.trim(),
    })
    ElMessage.success('已创建')
    emit('created', res?.data?.item || null)
    visible.value = false
  } catch (e) {
    ElMessage.error(writeUnavailableMessage(e, '创建失败'))
  } finally {
    saving.value = false
  }
}

watch(() => props.modelValue, (open) => {
  if (open) {
    form.value = { root: 'team', pack_id: 'adhoc', id: '', owner: '', app_id: props.appId || '' }
    load()
  }
})
</script>

<template>
  <el-dialog v-model="visible" title="新建条目" width="560px" class="mo-fit-dialog" destroy-on-close>
    <el-form label-width="88px" class="pc-form" @submit.prevent="submit">
      <el-form-item label="落在哪里">
        <el-select v-if="writableRoots.length" v-model="form.root" class="pc-full">
          <el-option
            v-for="r in writableRoots"
            :key="r.root"
            :value="r.root"
            :label="`${r.label}（优先级 ${r.rank + 1}，现有 ${r.count} 条）`"
          />
        </el-select>
        <p v-else class="pc-hint">没有可写位置</p>
      </el-form-item>
      <el-form-item v-if="form.root === 'app'" label="应用标识">
        <el-input v-model="form.app_id" />
      </el-form-item>
      <el-form-item label="分组">
        <el-input v-model="form.pack_id" placeholder="adhoc" />
      </el-form-item>
      <el-form-item label="条目标识" required>
        <el-input v-model="form.id" />
      </el-form-item>
      <el-form-item label="负责人">
        <el-input v-model="form.owner" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" :disabled="!writableRoots.length" @click="submit">
        创建
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.pc-form { margin-bottom: 8px; }
.pc-full { width: 100%; }
.pc-hint { margin: 4px 0 0; font-size: 12px; color: var(--settings-muted); line-height: 1.5; }
</style>
