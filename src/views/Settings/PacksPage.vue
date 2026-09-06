<script setup>
import PacksPanel from './PacksPanel.vue'
import './settings-ui.css'
</script>

<template>
  <div class="settings-panel packs-page wide-panel">
    <header class="settings-page-header">
      <div>
        <h2 class="settings-page-title">扩展包</h2>
        <p class="settings-page-desc">设备 / 本地能调用的 function。<router-link to="/skills">技能</router-link>决定什么时候用这些包，<router-link to="/stack">编排</router-link>决定哪条入口能用哪只手。</p>
      </div>
    </header>
    <PacksPanel />
  </div>
</template>

<style scoped>
.packs-page {
  max-width: none;
  width: 100%;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.settings-page-desc a {
  color: var(--settings-primary);
  font-weight: 700;
}
.packs-page :deep(.settings-page-header) {
  flex-shrink: 0;
}
.packs-page :deep(.packs-panel) {
  flex: 1;
  min-height: 0;
}
</style>
