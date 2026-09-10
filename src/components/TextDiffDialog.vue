<script setup>
import { computed } from 'vue'
import { buildSideBySideDiff } from '@/utils/promptDiff'

const props = defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, default: '内容比较' },
  leftLabel: { type: String, default: '旧版本' },
  rightLabel: { type: String, default: '新版本' },
  oldText: { type: String, default: '' },
  newText: { type: String, default: '' },
  confirmText: { type: String, default: '确认' },
  confirming: { type: Boolean, default: false },
  showConfirm: { type: Boolean, default: true },
})

const emit = defineEmits(['update:visible', 'confirm', 'close'])

const diff = computed(() => buildSideBySideDiff(props.oldText, props.newText))

const hasChanges = computed(() =>
  diff.value.stats.changed + diff.value.stats.added + diff.value.stats.removed > 0,
)

const summary = computed(() => {
  const s = diff.value.stats
  if (!hasChanges.value) return '内容一致，无差异'
  const parts = []
  if (s.changed) parts.push(`${s.changed} 行修改`)
  if (s.added) parts.push(`${s.added} 行新增`)
  if (s.removed) parts.push(`${s.removed} 行删除`)
  return parts.join(' · ')
})

const close = () => {
  emit('update:visible', false)
  emit('close')
}

const confirm = () => {
  emit('confirm')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="td-overlay" @click.self="close">
      <div class="td-dialog" role="dialog" aria-modal="true">
        <header class="td-head">
          <div>
            <h2>{{ title }}</h2>
            <p>{{ summary }}</p>
          </div>
          <button type="button" class="td-close" aria-label="关闭" @click="close">×</button>
        </header>

        <div class="td-label-row">
          <div class="td-pane-label">{{ leftLabel }}</div>
          <div class="td-pane-label">{{ rightLabel }}</div>
        </div>

        <div class="td-scroll">
          <div
            v-for="(row, i) in diff.rows"
            :key="i"
            class="td-row"
            :class="{
              'is-change': row.kind === 'change',
              'is-remove': row.kind === 'remove',
              'is-add': row.kind === 'add',
            }"
          >
            <div class="td-line td-line-left">
              <span class="td-no">{{ row.leftNo ?? '' }}</span>
              <code class="td-code">
                <template v-if="row.leftParts?.length">
                  <span
                    v-for="(p, j) in row.leftParts"
                    :key="j"
                    :class="{ 'hl-del': p.kind === 'del', 'hl-same': p.kind === 'same' }"
                  >{{ p.text }}</span>
                </template>
                <template v-else>{{ row.left }}</template>
              </code>
            </div>
            <div class="td-line td-line-right">
              <span class="td-no">{{ row.rightNo ?? '' }}</span>
              <code class="td-code">
                <template v-if="row.rightParts?.length">
                  <span
                    v-for="(p, j) in row.rightParts"
                    :key="j"
                    :class="{ 'hl-add': p.kind === 'add', 'hl-same': p.kind === 'same' }"
                  >{{ p.text }}</span>
                </template>
                <template v-else>{{ row.right }}</template>
              </code>
            </div>
          </div>
        </div>

        <footer class="td-foot">
          <button type="button" class="td-btn ghost" @click="close">取消</button>
          <button
            v-if="showConfirm"
            type="button"
            class="td-btn primary"
            :disabled="confirming"
            @click="confirm"
          >
            {{ confirming ? '处理中…' : confirmText }}
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.td-overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
  background: rgba(15, 23, 42, 0.45);
  display: grid;
  place-items: center;
  padding: 24px;
}

.td-dialog {
  width: min(1120px, 96vw);
  height: min(88vh, 900px);
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 24px 64px rgba(15, 23, 42, 0.22);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.td-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.15rem 0.85rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  flex-shrink: 0;
}

.td-head h2 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
}

.td-head p {
  margin: 0.25rem 0 0;
  font-size: 0.82rem;
  color: #64748b;
}

.td-close {
  border: 0;
  background: transparent;
  font-size: 1.5rem;
  line-height: 1;
  color: #64748b;
  cursor: pointer;
  padding: 0 0.2rem;
}

.td-label-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.td-pane-label {
  padding: 0.55rem 0.85rem;
  font-size: 0.78rem;
  font-weight: 700;
  color: #475569;
  background: #f8fafc;
}

.td-pane-label + .td-pane-label {
  border-left: 1px solid rgba(0, 0, 0, 0.08);
}

.td-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  background: #fff;
}

.td-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-bottom: 1px solid rgba(0, 0, 0, 0.03);
}

.td-row.is-change {
  background: #fffbeb;
}

.td-row.is-remove {
  background: #fef2f2;
}

.td-row.is-add {
  background: #ecfdf5;
}

.td-line {
  display: flex;
  gap: 0.55rem;
  padding: 0.12rem 0.65rem 0.12rem 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.78rem;
  line-height: 1.55;
  min-height: 1.55em;
}

.td-line-right {
  border-left: 1px solid rgba(0, 0, 0, 0.08);
}

.td-no {
  flex-shrink: 0;
  width: 2.4rem;
  text-align: right;
  color: #94a3b8;
  user-select: none;
  padding-top: 0.05rem;
}

.td-code {
  flex: 1;
  min-width: 0;
  white-space: pre-wrap;
  word-break: break-word;
  color: #0f172a;
}

.hl-del {
  background: #fecaca;
  border-radius: 2px;
}

.hl-add {
  background: #bbf7d0;
  border-radius: 2px;
}

.td-foot {
  display: flex;
  justify-content: flex-end;
  gap: 0.55rem;
  padding: 0.85rem 1.15rem;
  flex-shrink: 0;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
}

.td-btn {
  border-radius: 999px;
  padding: 0.45rem 1.1rem;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
}

.td-btn.ghost {
  background: #fff;
  border-color: rgba(0, 0, 0, 0.12);
  color: #334155;
}

.td-btn.primary {
  background: #2563eb;
  color: #fff;
}

.td-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 800px) {
  .td-label-row,
  .td-row {
    grid-template-columns: 1fr;
  }

  .td-line-right {
    border-left: 0;
    border-top: 1px solid rgba(0, 0, 0, 0.06);
  }
}
</style>
