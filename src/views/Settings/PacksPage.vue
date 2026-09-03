<script setup>
import PacksPanel from './PacksPanel.vue'
import './settings-ui.css'
</script>

<template>
  <div class="settings-panel packs-page wide-panel">
    <header class="settings-page-header">
      <div>
        <h2 class="settings-page-title">扩展包</h2>
      </div>
    </header>
    <PacksPanel />
  </div>
</template>

<style scoped>
.packs-page {
  max-width: none;
  width: 100%;
}
</style>
