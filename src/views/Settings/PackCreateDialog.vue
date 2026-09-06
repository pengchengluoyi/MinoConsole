<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { createPack } from '@/api/packs'
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

const form = ref({ pack_id: 'adhoc', id: '' })
const saving = ref(false)

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
  saving.value = true
  try {
    const res = await createPack({
      kind: props.kind,
      pack_id: form.value.pack_id.trim() || 'adhoc',
      id,
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
    form.value = { pack_id: 'adhoc', id: '' }
  }
})
</script>

<template>
  <el-dialog v-model="visible" title="新建条目" width="560px" class="mo-fit-dialog" destroy-on-close>
    <el-form label-width="88px" class="pc-form" @submit.prevent="submit">
      <el-form-item label="分组">
        <el-input v-model="form.pack_id" placeholder="adhoc" />
      </el-form-item>
      <el-form-item label="条目标识" required>
        <el-input v-model="form.id" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">创建</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.pc-form { margin-bottom: 8px; }
</style>
