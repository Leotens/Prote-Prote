<script setup lang="ts">
import { computed, ref } from 'vue'
import BackToMenu from '../components/BackToMenu.vue'
import { formatCount, formatFileSize, type Dataset } from '../datasets'

const props = defineProps<{
  datasets: readonly Dataset[]
  saving: boolean
  importDataset: (file: File, hasHeader: boolean) => Promise<Dataset>
  removeDataset: (dataset: Dataset) => Promise<void>
}>()
const selected = defineModel<Dataset | null>({ required: true })
const emit = defineEmits<{ back: [] }>()

const statistics = computed(() => [
  { label: 'Tamaño del archivo', value: selected.value?.sizeBytes, format: formatFileSize },
  { label: 'Filas de datos', value: selected.value?.rows, format: formatCount },
  { label: 'Proteínas únicas', value: selected.value?.nodes, format: formatCount },
  { label: 'Interacciones únicas', value: selected.value?.edges, format: formatCount },
])

const fileInput = ref<HTMLInputElement | null>(null)
const headerDialog = ref<HTMLDialogElement | null>(null)
const pendingFile = ref<File | null>(null)
const uploadStatus = ref('')

function selectFile(event: Event) {
  const input = event.currentTarget as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  input.value = ''
  pendingFile.value = file
  headerDialog.value?.showModal()
}

function closeHeaderDialog() {
  pendingFile.value = null
  headerDialog.value?.close()
}

async function confirmUpload(hasHeader: boolean) {
  const file = pendingFile.value
  if (!file || props.saving) return

  closeHeaderDialog()
  uploadStatus.value = `Enviando ${file.name}…`

  try {
    const dataset = await props.importDataset(file, hasHeader)
    uploadStatus.value = `Dataset guardado: ${dataset.name}`
  } catch (error) {
    uploadStatus.value = error instanceof Error
      ? error.message
      : 'No se pudo enviar el archivo.'
  }
}

async function removeSelectedDataset() {
  const dataset = selected.value
  if (!dataset || props.saving || !window.confirm(`¿Eliminar «${dataset.name}» de la lista?`)) return

  try {
    await props.removeDataset(dataset)
    uploadStatus.value = `Dataset eliminado: ${dataset.name}`
  } catch {
    uploadStatus.value = 'No se pudo eliminar el dataset de este navegador.'
  }
}
</script>

<template>
  <section class="datasets" aria-labelledby="datasets-title">
    <div class="glass-panel dataset-list">
      <BackToMenu @back="emit('back')" />
      <h1 id="datasets-title">Datasets disponibles</h1>

      <p v-if="!datasets.length">Carga un CSV para empezar.</p>
      <ul v-else>
        <li v-for="dataset in datasets" :key="dataset.name">
          <button
            class="dataset-option"
            type="button"
            :aria-pressed="dataset.name === selected?.name"
            @click="selected = dataset"
          >
            <span>{{ dataset.name }}</span>
            <span v-if="dataset.name === selected?.name" class="selected-label" aria-hidden="true">Seleccionado</span>
          </button>
        </li>
      </ul>
    </div>

    <aside class="glass-panel dataset-card" aria-labelledby="dataset-name">
      <p class="details-label">Detalles del dataset</p>
      <h2 id="dataset-name">{{ selected?.name ?? 'Sin dataset seleccionado' }}</h2>
      <dl v-if="selected">
        <div v-for="{ label, value, format } in statistics" :key="label">
          <dt>{{ label }}</dt>
          <dd>{{ value === undefined ? 'Sin datos' : format(value) }}</dd>
        </div>
      </dl>

      <div class="dataset-actions">
        <input
          ref="fileInput"
          type="file"
          accept=".csv,.csv.gz"
          hidden
          @change="selectFile"
        />
        <p v-if="uploadStatus" role="status">{{ uploadStatus }}</p>
        <button type="button" :disabled="saving" @click="fileInput?.click()">
          Cargar nuevo dataset
        </button>
        <button class="delete" type="button" :disabled="!selected || saving" @click="removeSelectedDataset">
          Eliminar dataset
        </button>
      </div>
    </aside>

    <dialog
      ref="headerDialog"
      class="header-dialog"
      aria-labelledby="header-dialog-title"
      aria-describedby="header-dialog-description"
      @cancel="pendingFile = null"
    >
      <h2 id="header-dialog-title">¿Tu archivo tiene encabezado?</h2>
      <p v-if="pendingFile" class="dialog-filename">{{ pendingFile.name }}</p>
      <p id="header-dialog-description">Elige «Sí» si la primera fila contiene los nombres de las columnas.</p>
      <div class="dataset-actions dialog-actions">
        <button type="button" @click="confirmUpload(true)">Sí, tiene encabezado</button>
        <button type="button" @click="confirmUpload(false)">No, empieza con datos</button>
        <button class="dialog-cancel" type="button" @click="closeHeaderDialog">Cancelar</button>
      </div>
    </dialog>
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
.dataset-card { display: flex; flex-direction: column; }
.dataset-card dl { margin: 12px 0 18px; }
.dataset-card dl div { display: flex; justify-content: space-between; gap: 8px; padding: 8px 2px; border-bottom: 1px solid rgb(43 100 104 / 25%); }
.dataset-card dd { margin: 0; flex: 0 0 auto; font-weight: 700; }

.dataset-actions { display: grid; gap: 8px; margin-top: auto; }
.dataset-actions button {
  border: 1px solid rgb(255 255 255 / 35%);
  border-radius: 999px;
  padding: 9px 12px;
  background: linear-gradient(#28758b, #134a61);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 45%);
  color: white;
  font-size: 1rem;
  transition: filter 150ms ease, transform 150ms ease, box-shadow 150ms ease;
}

.dataset-actions .delete { background: linear-gradient(#a74b5a, #782535); }
.dataset-actions button:enabled { cursor: pointer; }
.dataset-actions button:enabled:hover { filter: brightness(1.12); }
.dataset-actions button:enabled:active {
  transform: translateY(1px);
  filter: brightness(0.9);
  box-shadow: inset 0 2px 5px rgb(7 39 51 / 40%);
}
.dataset-actions button:focus-visible { outline: 2px solid #08485d; outline-offset: 3px; }
.dataset-actions button:disabled { cursor: not-allowed; opacity: 0.82; }
.dataset-actions p { margin: 2px 0 0; color: #34535e; font-size: 0.875rem; overflow-wrap: anywhere; text-align: center; }

.header-dialog {
  width: min(420px, calc(100% - 32px));
  padding: 24px;
  border: 1px solid #c5ebf2;
  border-radius: 20px;
  background: linear-gradient(#d4eef3, #a9dce5);
  box-shadow: 0 12px 36px rgb(8 53 73 / 32%);
  color: #12333f;
}

.header-dialog::backdrop { background: rgb(8 43 63 / 50%); }
.header-dialog h2 { margin: 0; font-size: 1.3rem; }
.dialog-filename { font-weight: 700; overflow-wrap: anywhere; }
.dialog-actions .dialog-cancel { background: transparent; color: inherit; border-color: #7aafbd; }

@media (max-width: 640px) {
  .datasets { grid-template-columns: 1fr; margin-left: 0; }
}
</style>
