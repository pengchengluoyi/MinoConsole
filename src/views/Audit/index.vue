<script setup>
import { onMounted, ref } from 'vue'
import { clearAudit, listAudit } from '@/utils/auditLog'
import { formatCreatedAt } from '@/utils/formatTime'
import '../Settings/settings-ui.css'

const rows = ref([])
const loading = ref(true)

const load = () => {
  loading.value = true
  rows.value = listAudit()
  loading.value = false
}

onMounted(load)
</script>

<template>
  <div class="settings-panel wide-panel" v-loading="loading">
    <header class="settings-page-header">
      <div>
        <h2 class="settings-page-title">操作记录</h2>
      </div>
      <div class="settings-toolbar">
        <div class="settings-summary-pill is-muted">{{ rows.length }} 条</div>
        <el-button text :disabled="!rows.length" @click="clearAudit(); load()">清空本会话</el-button>
      </div>
    </header>

    <section class="settings-table-card">
      <el-table :data="rows" empty-text="暂无数据">
        <el-table-column label="时间" width="200">
          <template #default="{ row }">{{ formatCreatedAt(row.t) }}</template>
        </el-table-column>
        <el-table-column prop="action" label="操作" min-width="160" />
        <el-table-column prop="detail" label="对象" min-width="240" show-overflow-tooltip>
          <template #default="{ row }">{{ row.detail || '—' }}</template>
        </el-table-column>
      </el-table>
    </section>
  </div>
</template>
