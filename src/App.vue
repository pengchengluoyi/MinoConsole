<template>
  <div class="app-root">
    <div class="content-area is-settings">
      <router-view />
    </div>
    <GlobalAlert />
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import GlobalAlert from './components/GlobalAlert.vue'
import { bootstrapRealtime } from '@/utils/realtime'

onMounted(() => {
  bootstrapRealtime()
})
</script>

<style>
.app-root {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.content-area.is-settings {
  width: 100%;
  height: 100%;
}

.content-area.is-settings > * {
  height: 100%;
  min-height: 0;
}
</style>
