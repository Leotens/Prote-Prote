import { onBeforeUnmount, ref, watch, type Ref } from 'vue'
import type { Dataset } from '../datasets'
import { requestDatasetProteins, requestProteinComparison, type ProteinComparison } from '../infrastructure/datasetsApi'
import { getStoredDataset, saveDatasetProteins } from '../infrastructure/datasetsStorage'

export function useProteinComparison(dataset: Ref<Dataset>) {
  const proteins = ref<string[]>([])
  const result = ref<ProteinComparison | null>(null)
  const loadingProteins = ref(false)
  const comparing = ref(false)
  const error = ref('')
  let pendingList: AbortController | undefined
  let pendingComparison: AbortController | undefined

  async function storedFile(name: string) {
    const record = await getStoredDataset(name)
    if (!record) throw new Error('No se pudo recuperar el dataset guardado en este navegador.')
    return record
  }

  async function loadProteins() {
    pendingList?.abort()
    pendingComparison?.abort()
    const controller = new AbortController()
    pendingList = controller
    proteins.value = []
    result.value = null
    error.value = ''
    loadingProteins.value = true
    comparing.value = false
    try {
      const record = await storedFile(dataset.value.name)
      if (controller.signal.aborted) return
      if (record.proteins) {
        proteins.value = record.proteins
        return
      }
      const response = await requestDatasetProteins(record.file, record.hasHeader, controller.signal)
      if (controller.signal.aborted) return
      proteins.value = response.proteins
      try {
        await saveDatasetProteins(record, response.proteins)
      } catch {
        if (!controller.signal.aborted) error.value = 'Las proteínas se cargaron, pero no se pudo guardar su lista en este navegador.'
      }
    } catch (cause) {
      if (!controller.signal.aborted) error.value = cause instanceof Error ? cause.message : 'No se pudieron cargar las proteínas.'
    } finally {
      if (pendingList === controller) loadingProteins.value = false
    }
  }

  async function compare(proteinA: string, proteinB: string) {
    if (comparing.value || loadingProteins.value) return false
    const a = proteinA.trim()
    const b = proteinB.trim()
    error.value = ''
    if (!a || !b) {
      error.value = 'Ingresa las dos proteínas que deseas comparar.'
      return false
    }
    if (a === b) {
      error.value = 'Selecciona dos proteínas diferentes.'
      return false
    }
    if (!proteins.value.includes(a) || !proteins.value.includes(b)) {
      error.value = 'Selecciona identificadores que existan en el dataset actual.'
      return false
    }
    const controller = new AbortController()
    pendingComparison = controller
    comparing.value = true
    try {
      const record = await storedFile(dataset.value.name)
      if (controller.signal.aborted) return false
      const response = await requestProteinComparison(record.file, record.hasHeader, a, b, controller.signal)
      if (controller.signal.aborted) return false
      result.value = response
      return true
    } catch (cause) {
      if (!controller.signal.aborted) error.value = cause instanceof Error ? cause.message : 'No se pudieron comparar las proteínas.'
      return false
    } finally {
      if (pendingComparison === controller) comparing.value = false
    }
  }

  watch(() => dataset.value.name, loadProteins, { immediate: true })
  onBeforeUnmount(() => {
    pendingList?.abort()
    pendingComparison?.abort()
  })

  return { proteins, result, loadingProteins, comparing, error, compare, loadProteins }
}
