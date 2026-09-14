<script setup>
import KnowledgePanel from '@/views/Catalog/panels/KnowledgePanel.vue'
import { useCatalogAppContext } from '@/composables/useCatalogAppContext'

const { appId, projectId } = useCatalogAppContext()
</script>

<template>
  <KnowledgePanel :app-id="appId" :project-id="projectId" embedded />
</template>
