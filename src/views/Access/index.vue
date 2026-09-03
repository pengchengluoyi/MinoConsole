<script setup>
import { computed } from 'vue'
import { useSessionStore } from '@/store/session'
import {
  ACCOUNT_ROLES,
  CONSOLE_FEATURES,
  STUDIO_FEATURES,
  RBAC_MATRIX,
  cellLabel,
  roleLabel,
  normalizeRole,
} from '@/utils/iam'
import '../Settings/settings-ui.css'

const session = useSessionStore()
const currentRole = computed(() => normalizeRole(session.role || ''))

const cellClass = (value) => {
  if (value === 'yes') return 'is-yes'
  if (value === 'read') return 'is-read'
  return 'is-no'
}
</script>

<template>
  <div class="settings-panel wide-panel">
    <header class="settings-page-header">
      <div>
        <h2 class="settings-page-title">权限说明</h2>
        <p class="settings-page-desc">管理员可进 Console；用户仅 Studio。Console 登录仅账号密码。</p>
      </div>
      <div class="settings-summary-pill">当前：{{ roleLabel(currentRole) }}</div>
    </header>

    <section class="settings-table-card access-card">
      <div class="settings-kicker">Console</div>
      <el-table :data="ACCOUNT_ROLES" row-key="id" :row-class-name="({ row }) => row.id === currentRole ? 'is-me' : ''">
        <el-table-column label="账号角色" min-width="140" fixed>
          <template #default="{ row }">
            {{ row.label }}
            <span v-if="row.id === currentRole" class="me-tag">当前</span>
          </template>
        </el-table-column>
        <el-table-column v-for="feat in CONSOLE_FEATURES" :key="feat.id" :label="feat.label" min-width="108">
          <template #default="{ row }">
            <span class="cell" :class="cellClass(RBAC_MATRIX[row.id].console[feat.id])">
              {{ cellLabel(RBAC_MATRIX[row.id].console[feat.id]) }}
            </span>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <section class="settings-table-card access-card">
      <div class="settings-kicker">Studio</div>
      <el-table :data="ACCOUNT_ROLES" row-key="id" :row-class-name="({ row }) => row.id === currentRole ? 'is-me' : ''">
        <el-table-column label="账号角色" min-width="140" fixed>
          <template #default="{ row }">
            {{ row.label }}
            <span v-if="row.id === currentRole" class="me-tag">当前</span>
          </template>
        </el-table-column>
        <el-table-column v-for="feat in STUDIO_FEATURES" :key="feat.id" :label="feat.label" min-width="120">
          <template #default="{ row }">
            <span class="cell" :class="cellClass(RBAC_MATRIX[row.id].studio[feat.id])">
              {{ cellLabel(RBAC_MATRIX[row.id].studio[feat.id]) }}
            </span>
          </template>
        </el-table-column>
      </el-table>
    </section>
  </div>
</template>

<style scoped>
.access-card {
  margin-top: 12px;
}

.access-card .settings-kicker {
  margin-bottom: 8px;
}

.cell {
  display: inline-flex;
  min-width: 40px;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
}

.cell.is-yes { color: #047857; }
.cell.is-read { color: var(--settings-primary); }
.cell.is-no { color: var(--settings-muted); }

.me-tag {
  margin-left: 6px;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--settings-primary-soft);
  color: var(--settings-primary);
  font-size: 11px;
  font-weight: 700;
}

:deep(.is-me) {
  background: var(--settings-primary-soft) !important;
}
</style>
