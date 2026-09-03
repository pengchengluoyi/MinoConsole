<script setup>
import SkillsPanel from './SkillsPanel.vue'
import './settings-ui.css'
</script>

<template>
  <div class="settings-panel skills-page wide-panel">
    <header class="settings-page-header">
      <div>
        <h2 class="settings-page-title">能力目录</h2>
      </div>
    </header>
    <SkillsPanel />
  </div>
</template>

<style scoped>
.skills-page {
  max-width: none;
  width: 100%;
}
</style>
