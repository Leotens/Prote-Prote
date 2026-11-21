import { onBeforeUnmount, ref } from 'vue'
import type { Dataset } from '../datasets'
import { requestProteinComparison, type ProteinComparisonResult } from '../infrastructure/datasetsApi'
import { getStoredDataset } from '../infrastructure/datasetsStorage'

export function useProteinComparison() {
  const comparisonResult = ref<ProteinComparisonResult | null>(null)
  const comparisonError = ref('')
  const comparing = ref(false)
  let pendingComparison: AbortController | undefined

  function clearComparison() {
    pendingComparison?.abort()
    pendingComparison = undefined
    comparisonResult.value = null
    comparisonError.value = ''
    comparing.value = false
  }

  async function compare(dataset: Dataset, proteinA: string, proteinB: string) {
    if (comparing.value) return

    comparing.value = true
    comparisonResult.value = null
    comparisonError.value = ''
    const controller = new AbortController()
    pendingComparison = controller

    try {
      const record = await getStoredDataset(dataset.name)
      if (!record) throw new Error('No se pudo recuperar el dataset guardado en este navegador.')

      const result = await requestProteinComparison(
        record.file,
        record.hasHeader,
        proteinA,
        proteinB,
        controller.signal,
      )
      if (!controller.signal.aborted) comparisonResult.value = result
    } catch (error) {
      if (!controller.signal.aborted) {
        comparisonError.value = error instanceof Error ? error.message : 'Error al comparar las proteínas.'
      }
    } finally {
      if (pendingComparison === controller) pendingComparison = undefined
      if (!controller.signal.aborted) comparing.value = false
    }
  }

  onBeforeUnmount(clearComparison)

  return {
    comparisonResult,
    comparisonError,
    comparing,
    compare,
    clearComparison,
  }
}
