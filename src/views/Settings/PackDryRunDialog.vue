<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { dryRunPack } from '@/api/packs'
import { apiErrorMessage } from '@/utils/apiError'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  uid: { type: String, default: '' },
  title: { type: String, default: '' },
  mode: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const pkg = ref('')
const running = ref(false)
const result = ref(null)

const run = async () => {
  if (!props.uid) {
    ElMessage.warning('没有可预演的条目')
    return
  }
  running.value = true
  try {
    const res = await dryRunPack(props.uid, {
      source: 'catalog',
      package: pkg.value.trim() || undefined,
    })
    result.value = res?.data || null
    if (!result.value) ElMessage.warning('预演没有返回结果')
  } catch (e) {
    ElMessage.error(apiErrorMessage(e, '预演失败'))
    result.value = null
  } finally {
    running.value = false
  }
}

watch(() => props.modelValue, (open) => {
  if (open) {
    result.value = null
    pkg.value = ''
  }
})
</script>

<template>
  <el-dialog v-model="visible" :title="`预演 · ${title || uid}`" width="680px" class="mo-fit-dialog">
    <div class="dr-form">
      <el-input
        v-model="pkg"
        placeholder="被测应用标识"
        class="dr-pkg"
        clearable
      />
      <el-button type="primary" :loading="running" :disabled="!uid" @click="run">预演</el-button>
    </div>

    <div v-if="!result && !running" class="dr-empty">暂无数据</div>

    <div v-else-if="result" class="dr-result">
      <div class="dr-verdict" :class="{ hit: result.matched }">
        {{ result.matched ? '命中' : '未命中' }}
        <span v-if="result.match_reasons?.length" class="dr-reasons">
          {{ result.match_reasons.join(' · ') }}
        </span>
      </div>

      <dl class="dr-dl">
        <template v-if="result.planned_actions?.length">
          <dt>会做什么</dt>
          <dd>
            <ol class="dr-actions">
              <li
                v-for="(a, i) in result.planned_actions"
                :key="i"
                :class="{ blocked: a.blocked_by_forbid }"
              >
                <code>{{ a.capability }}</code>
                <el-tag v-if="a.blocked_by_forbid" size="small" type="danger" effect="light">
                  被护栏拦下：{{ a.blocked_by_forbid }}
                </el-tag>
              </li>
            </ol>
          </dd>
        </template>
        <template v-else-if="result.matched">
          <dt>会做什么</dt>
          <dd class="dr-hint">暂无动作</dd>
        </template>
        <template v-if="result.advice">
          <dt>会注入什么</dt>
          <dd><pre class="dr-pre">{{ result.advice }}</pre></dd>
        </template>
      </dl>
    </div>
  </el-dialog>
</template>

<style scoped>
.dr-form { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.dr-pkg { width: 260px; }
.dr-empty { margin-top: 16px; font-size: 13px; color: var(--settings-muted); line-height: 1.6; }
.dr-result { margin-top: 16px; }
.dr-verdict {
  font-size: 14px; font-weight: 600; padding: 8px 10px; border-radius: 6px;
  background: var(--settings-soft); color: var(--settings-text);
}
.dr-verdict.hit { background: var(--settings-primary-soft); color: var(--settings-primary); }
.dr-reasons { margin-left: 8px; font-size: 12px; font-weight: 400; }
.dr-dl { margin: 12px 0 0; display: grid; grid-template-columns: 80px 1fr; gap: 10px 12px; }
.dr-dl dt { font-size: 12px; color: var(--settings-muted); }
.dr-dl dd { margin: 0; font-size: 13px; line-height: 1.6; }
.dr-actions { margin: 0; padding-left: 18px; }
.dr-actions li.blocked { color: var(--el-color-danger); }
.dr-hint { font-size: 12px; color: var(--settings-muted); }
.dr-pre {
  margin: 0; padding: 8px 10px; border-radius: 6px; background: var(--settings-soft);
  font-size: 12px; line-height: 1.6; white-space: pre-wrap;
}
</style>
