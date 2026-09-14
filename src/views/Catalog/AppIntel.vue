<script setup>
import AppIntelPanel from '@/views/Catalog/panels/AppIntelPanel.vue'
import { useCatalogAppContext } from '@/composables/useCatalogAppContext'

const { appId, projectId } = useCatalogAppContext()
</script>

<template>
  <AppIntelPanel :app-id="appId" :project-id="projectId" embedded />
</template>
