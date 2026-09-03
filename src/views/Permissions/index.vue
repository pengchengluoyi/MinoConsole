<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useSessionStore } from '@/store/session'
import { getStudioNav, saveStudioNav } from '@/api/me'
import { apiErrorMessage } from '@/utils/apiError'
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

const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const currentRole = computed(() => normalizeRole(session.role || ''))

const tab = ref('studio-nav')
const loading = ref(false)
const navEntries = ref([])
const navAllowed = ref([])
const navSaving = ref(false)
const navError = ref('')

const applyTab = () => {
  const q = String(route.query.tab || '')
  tab.value = q === 'matrix' || q === '说明' ? 'matrix' : 'studio-nav'
}

watch(() => route.query.tab, applyTab, { immediate: true })

const setTab = (id) => {
  tab.value = id
  router.replace({ path: '/permissions', query: { tab: id === 'matrix' ? 'matrix' : 'studio-nav' } })
}

const navOn = (id) => navAllowed.value.includes(id)

const toggleNav = async (id, on) => {
  const next = on
    ? [...new Set([...navAllowed.value, id])]
    : navAllowed.value.filter((x) => x !== id)
  navSaving.value = true
  try {
    const res = await saveStudioNav(next)
    navAllowed.value = [...(res?.data?.allowed || next)]
  } catch (e) {
    ElMessage.error(apiErrorMessage(e, '保存 Studio 入口失败'))
  } finally {
    navSaving.value = false
  }
}

const cellClass = (value) => {
  if (value === 'yes') return 'is-yes'
  if (value === 'read') return 'is-read'
  return 'is-no'
}

onMounted(async () => {
  applyTab()
  loading.value = true
  navError.value = ''
  try {
    const nav = await getStudioNav()
    navEntries.value = nav?.data?.entries || []
    navAllowed.value = [...(nav?.data?.allowed || [])]
  } catch (e) {
    navError.value = e?.response?.data?.detail || e?.message || '读取失败'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="settings-panel permissions-page wide-panel" v-loading="loading">
    <header class="settings-page-header">
      <div>
        <h2 class="settings-page-title">权限配置</h2>
      </div>
      <div class="settings-summary-pill">当前：{{ roleLabel(currentRole) }}</div>
    </header>

    <div class="settings-tabbar">
      <button type="button" class="settings-tab" :class="{ active: tab === 'studio-nav' }" @click="setTab('studio-nav')">
        <strong>Studio 入口</strong>
        <span>控制 Studio 侧栏显示哪些模块</span>
      </button>
      <button type="button" class="settings-tab" :class="{ active: tab === 'matrix' }" @click="setTab('matrix')">
        <strong>权限说明</strong>
        <span>管理员 / 用户能力矩阵</span>
      </button>
    </div>

    <section v-if="tab === 'studio-nav'" class="settings-table-card">
      <el-table v-if="navEntries.length" :data="navEntries" empty-text="暂无数据">
        <el-table-column label="入口" min-width="160">
          <template #default="{ row }">{{ row.label }}</template>
        </el-table-column>
        <el-table-column label="ID" min-width="120">
          <template #default="{ row }">{{ row.id }}</template>
        </el-table-column>
        <el-table-column label="分组" width="100">
          <template #default="{ row }">{{ row.group === 'settings' ? '设置' : '工作台' }}</template>
        </el-table-column>
        <el-table-column label="显示" width="100">
          <template #default="{ row }">
            <el-switch
              :model-value="navOn(row.id)"
              :loading="navSaving"
              @change="(on) => toggleNav(row.id, on)"
            />
          </template>
        </el-table-column>
      </el-table>
      <p v-else class="settings-page-desc sys-empty">{{ navError || '暂无数据' }}</p>
    </section>

    <template v-else>
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
    </template>
  </div>
</template>

<style scoped>
.sys-empty {
  padding: 8px 0 4px;
}
.access-card {
  margin-top: 12px;
}
.access-card .settings-kicker {
  margin-bottom: 10px;
}
.cell {
  font-size: 12px;
  font-weight: 700;
}
.cell.is-yes { color: #047857; }
.cell.is-read { color: #1d4ed8; }
.cell.is-no { color: #9ca3af; }
.me-tag {
  margin-left: 6px;
  font-size: 11px;
  color: var(--settings-primary, var(--mo-primary));
  font-weight: 700;
}
:deep(.is-me) {
  background: color-mix(in srgb, var(--settings-primary, #6366f1) 6%, transparent);
}
</style>
