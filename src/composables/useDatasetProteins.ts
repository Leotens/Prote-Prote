import { onBeforeUnmount, ref, watch, type Ref } from 'vue'
import type { Dataset } from '../datasets'
import { requestDatasetProteins } from '../infrastructure/datasetsApi'
import { getStoredDataset, saveDatasetProteins } from '../infrastructure/datasetsStorage'

export function useDatasetProteins(dataset: Ref<Dataset>) {
  const proteins = ref<string[]>([])
  const loadingProteins = ref(false)
  const proteinListError = ref('')
  let pendingList: AbortController | undefined

  async function loadProteins() {
    pendingList?.abort()
    const controller = new AbortController()
    pendingList = controller
    proteins.value = []
    proteinListError.value = ''
    loadingProteins.value = true
    try {
      const record = await getStoredDataset(dataset.value.name)
      if (!record) throw new Error('No se pudo recuperar el dataset guardado en este navegador.')
      if (controller.signal.aborted) return
      if (record.proteins) {
        proteins.value = record.proteins
        return
      }
      const response = await requestDatasetProteins(record.file, record.hasHeader, controller.signal)
      if (controller.signal.aborted) return
      proteins.value = response.proteins
      await saveDatasetProteins(record, response.proteins)
    } catch (error) {
      if (!controller.signal.aborted) {
        proteinListError.value = error instanceof Error ? error.message : 'No se pudieron cargar las proteínas.'
      }
    } finally {
      if (pendingList === controller) loadingProteins.value = false
    }
  }

  watch(() => dataset.value.name, loadProteins, { immediate: true })
  onBeforeUnmount(() => pendingList?.abort())
  return { proteins, loadingProteins, proteinListError }
}
