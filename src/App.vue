<script setup lang="ts">
import { computed, ref } from 'vue'
import AppHeader from './components/AppHeader.vue'
import { exampleDatasets, type Dataset } from './datasets'
import DatasetsView from './views/DatasetsView.vue'
import MenuView from './views/MenuView.vue'
import VisualizerView from './views/VisualizerView.vue'

type View = 'menu' | 'datasets' | 'visualizer'

const viewTitles: Record<View, string> = {
  menu: 'Bienvenido de vuelta',
  datasets: 'Administrar datasets',
  visualizer: 'Visualizar Dataset',
}

const currentView = ref<View>('menu')
const selectedDataset = ref<Dataset>(exampleDatasets[0])
const title = computed(() => viewTitles[currentView.value])
</script>

<template>
  <main class="menu-page">
    <AppHeader :title="title" @home="currentView = 'menu'" />

    <div :key="currentView" class="screen">
      <MenuView
        v-if="currentView === 'menu'"
        :dataset-name="selectedDataset.name"
        @datasets="currentView = 'datasets'"
        @visualizer="currentView = 'visualizer'"
      />
      <DatasetsView
        v-else-if="currentView === 'datasets'"
        v-model="selectedDataset"
        :datasets="exampleDatasets"
        @back="currentView = 'menu'"
      />
      <VisualizerView
        v-else
        v-model="selectedDataset"
        :datasets="exampleDatasets"
        @back="currentView = 'menu'"
      />
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
</style>
