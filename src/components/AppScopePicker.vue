<script setup>
const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  options: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  showCatalogLink: { type: Boolean, default: true },
  catalogTab: { type: String, default: 'overview' },
})

const emit = defineEmits(['update:modelValue', 'open-catalog'])

const onOpenCatalog = () => emit('open-catalog')
</script>

<template>
  <div class="app-scope-picker">
    <el-cascader
      :model-value="modelValue"
      :options="options"
      :props="{ expandTrigger: 'hover' }"
      filterable
      clearable
      placeholder="选择项目 / 应用"
      class="scope-cascader"
      :loading="loading"
      @update:model-value="emit('update:modelValue', $event)"
    />
    <el-button
      v-if="showCatalogLink && modelValue?.length === 2"
      link
      type="primary"
      size="small"
      @click="onOpenCatalog"
    >
      在应用目录中打开
    </el-button>
  </div>
</template>

<style scoped>
.app-scope-picker {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.scope-cascader {
  min-width: 280px;
}
</style>
