<script setup>
import DocLibraryPanel from '@/views/Catalog/panels/DocLibraryPanel.vue'
import { useCatalogAppContext } from '@/composables/useCatalogAppContext'

const { appId, projectId } = useCatalogAppContext()
</script>

<template>
  <DocLibraryPanel :app-id="appId" :project-id="projectId" embedded />
</template>
