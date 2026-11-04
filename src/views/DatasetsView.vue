<script setup lang="ts">
import { computed } from 'vue'
import BackToMenu from '../components/BackToMenu.vue'
import { formatCount, type Dataset } from '../datasets'

defineProps<{ datasets: readonly Dataset[] }>()
const selected = defineModel<Dataset>({ required: true })
const emit = defineEmits<{ back: [] }>()

const statistics = computed(() => [
  { label: 'Nodos', value: selected.value.nodes },
  { label: 'Aristas', value: selected.value.edges },
  { label: 'Grado promedio', value: selected.value.averageDegree },
  { label: 'Componente conectado principal', value: selected.value.largestComponent },
])
</script>

<template>
  <section class="datasets" aria-labelledby="datasets-title">
    <div class="glass-panel dataset-list">
      <BackToMenu @back="emit('back')" />
      <h1 id="datasets-title">Datasets disponibles</h1>

      <ul>
        <li v-for="dataset in datasets" :key="dataset.name">
          <button
            class="dataset-option"
            type="button"
            :aria-pressed="dataset.name === selected.name"
            @click="selected = dataset"
          >
            <span>{{ dataset.name }}</span>
            <span v-if="dataset.name === selected.name" class="selected-label" aria-hidden="true">Seleccionado</span>
          </button>
        </li>
      </ul>
    </div>

    <aside class="glass-panel dataset-card" aria-labelledby="dataset-name">
      <p class="details-label">Detalles del dataset</p>
      <h2 id="dataset-name">{{ selected.name }}</h2>
      <dl>
        <div v-for="{ label, value } in statistics" :key="label">
          <dt>{{ label }}</dt>
          <dd>{{ value === undefined ? 'Sin datos' : formatCount(value) }}</dd>
        </div>
      </dl>

      <div class="dataset-actions">
        <button type="button" disabled>Cargar nuevo dataset</button>
        <button class="delete" type="button" disabled>Eliminar dataset</button>
        <p>Datos de ejemplo</p>
      </div>
    </aside>
  </section>
</template>

<style scoped>
.datasets {
  display: grid;
  flex: 1;
  grid-template-columns: minmax(0, 2.15fr) minmax(210px, 1fr);
  gap: clamp(10px, 1.4vw, 22px);
  margin: clamp(10px, 2dvh, 20px) 0 0;
  color: #12333f;
}

.dataset-list,
.dataset-card {
  padding: clamp(12px, min(2vw, 3dvh), 26px);
}

.dataset-list h1, .dataset-card h2 { margin: 0; font-size: clamp(1.25rem, 1.65vw, 1.75rem); font-weight: 700; }
.dataset-list h1 { margin-bottom: 12px; }

.dataset-list ul {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dataset-option {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid rgb(205 240 246 / 55%);
  border-radius: 10px;
  padding: clamp(9px, 1.5dvh, 15px);
  background: linear-gradient(#cbeaf1, #addbe5);
  box-shadow: inset 0 1px 0 rgb(223 249 252 / 42%);
  color: inherit;
  cursor: pointer;
  font-size: clamp(0.95rem, 1.35vw, 1.25rem);
  text-align: left;
}

.dataset-option:hover { filter: brightness(1.05); }
.dataset-option[aria-pressed='true'] { background: linear-gradient(#28758b, #134a61); color: white; }
.dataset-option:focus-visible { outline: 2px solid #08485d; outline-offset: 3px; }
.selected-label { font-size: 0.875rem; }

.details-label { margin: 0 0 4px; color: #34535e; font-size: 0.9rem; }
.dataset-card dl { margin: 12px 0 18px; }
.dataset-card dl div { display: flex; justify-content: space-between; gap: 8px; padding: 8px 2px; border-bottom: 1px solid rgb(43 100 104 / 25%); }
.dataset-card dd { margin: 0; flex: 0 0 auto; font-weight: 700; }

.dataset-actions { display: grid; gap: 8px; }
.dataset-actions button {
  border: 1px solid rgb(255 255 255 / 35%);
  border-radius: 999px;
  padding: 9px 12px;
  background: linear-gradient(#28758b, #134a61);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 45%);
  color: white;
  font-size: 1rem;
}

.dataset-actions .delete { background: linear-gradient(#a74b5a, #782535); }
.dataset-actions button:disabled { cursor: not-allowed; opacity: 0.82; }
.dataset-actions p { margin: 2px 0 0; color: #34535e; font-size: 0.875rem; text-align: center; }

@media (max-width: 640px) {
  .datasets { grid-template-columns: 1fr; margin-left: 0; }
}
</style>
