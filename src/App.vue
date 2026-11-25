<script setup lang="ts">
import { watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from './components/AppHeader.vue'
import { useDatasets } from './composables/useDatasets'

const route = useRoute()
const router = useRouter()

const {
  datasets,
  selectedDataset,
  loadingDatasets,
  storageError,
  savingDataset,
  importDataset,
  removeDataset,
} = useDatasets()

function goHome() {
  return router.push({ name: 'menu' })
}

watchEffect(() => {
  if (
    (route.name === 'visualizer' || route.name === 'compare') &&
    !loadingDatasets.value &&
    !storageError.value &&
    !selectedDataset.value
  ) {
    void router.replace({ name: 'datasets' })
  }
})
</script>

<template>
  <main class="menu-page">
    <AppHeader :title="route.meta.title ?? 'Bienvenido de vuelta'" @home="goHome" />

    <div
      :key="route.name"
      class="screen"
      :class="{ 'compare-screen': route.name === 'compare' }"
    >
      <p v-if="loadingDatasets" role="status">Recuperando datasets…</p>
      <p v-else-if="storageError" role="alert">{{ storageError }}</p>
      <RouterView v-else v-slot="{ Component, route: viewRoute }">
        <component
          :is="Component"
          v-if="viewRoute.name === 'menu'"
          :dataset-name="selectedDataset?.name"
          @datasets="router.push({ name: 'datasets' })"
          @visualizer="router.push({ name: selectedDataset ? 'visualizer' : 'datasets' })"
          @compare="router.push({ name: selectedDataset ? 'compare' : 'datasets' })"
          @credits="router.push({ name: 'credits' })"
        />
        <component
          :is="Component"
          v-else-if="viewRoute.name === 'datasets'"
          v-model="selectedDataset"
          :datasets="datasets"
          :saving="savingDataset"
          :import-dataset="importDataset"
          :remove-dataset="removeDataset"
          @back="goHome"
        />
        <component
          :is="Component"
          v-else-if="viewRoute.name === 'visualizer' && selectedDataset"
          v-model="selectedDataset"
          :datasets="datasets"
          @back="goHome"
        />
        <component
          :is="Component"
          v-else-if="viewRoute.name === 'compare' && selectedDataset"
          v-model="selectedDataset"
          :datasets="datasets"
          @back="goHome"
        />
        <component
          :is="Component"
          v-else-if="viewRoute.name === 'credits'"
          @back="goHome"
        />
      </RouterView>
    </div>
  </main>
</template>

<style scoped>
.screen {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  overflow: auto;
}

.compare-screen {
  scrollbar-color: rgb(64 112 124 / 72%) transparent;
  scrollbar-width: thin;
}

.compare-screen::-webkit-scrollbar { width: 8px; }
.compare-screen::-webkit-scrollbar-track { background: transparent; }
.compare-screen::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgb(64 112 124 / 72%);
}
</style>
