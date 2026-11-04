import { onMounted, ref } from 'vue'
import type { Dataset } from '../datasets'
import { uploadDataset } from '../infrastructure/datasetsApi'
import { deleteStoredDataset, listStoredDatasets, saveStoredDataset } from '../infrastructure/datasetsStorage'

export function useDatasets() {
  const datasets = ref<Dataset[]>([])
  const selectedDataset = ref<Dataset | null>(null)
  const loadingDatasets = ref(true)
  const storageError = ref('')
  const savingDataset = ref(false)

  onMounted(async () => {
    try {
      datasets.value = await listStoredDatasets()
      selectedDataset.value = datasets.value[0] ?? null
    } catch {
      storageError.value = 'No se pudieron recuperar los datasets guardados en este navegador.'
    } finally {
      loadingDatasets.value = false
    }
  })

  async function importDataset(file: File, hasHeader: boolean) {
    savingDataset.value = true
    try {
      const result = await uploadDataset(file, hasHeader)
      const dataset: Dataset = {
        name: result.filename,
        sizeBytes: result.size_bytes ?? file.size,
        rows: result.rows,
        nodes: result.nodes,
        edges: result.edges,
      }

      try {
        await saveStoredDataset({ dataset, file, hasHeader })
      } catch {
        throw new Error('El archivo se leyó, pero no se pudo guardar en este navegador.')
      }

      addDataset(dataset)
      return dataset
    } finally {
      savingDataset.value = false
    }
  }

  function addDataset(dataset: Dataset) {
    const index = datasets.value.findIndex((item) => item.name === dataset.name)
    if (index === -1) {
      datasets.value.push(dataset)
    } else {
      datasets.value[index] = dataset
    }
    selectedDataset.value = dataset
  }

  async function removeDataset(dataset: Dataset) {
    savingDataset.value = true
    try {
      await deleteStoredDataset(dataset.name)
      datasets.value = datasets.value.filter((item) => item.name !== dataset.name)
      if (selectedDataset.value?.name === dataset.name) {
        selectedDataset.value = datasets.value[0] ?? null
      }
    } finally {
      savingDataset.value = false
    }
  }

  return {
    datasets,
    selectedDataset,
    loadingDatasets,
    storageError,
    savingDataset,
    importDataset,
    removeDataset,
  }
}
