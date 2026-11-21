import { onBeforeUnmount, ref } from 'vue'
import type { Dataset } from '../datasets'
import { requestComparisonSubgraph, requestProteinComparison, type ProteinComparisonResult } from '../infrastructure/datasetsApi'
import { getStoredDataset } from '../infrastructure/datasetsStorage'

export function useProteinComparison() {
  const comparisonResult = ref<ProteinComparisonResult | null>(null)
  const comparisonError = ref('')
  const comparing = ref(false)
  const comparisonSubgraphHtml = ref('')
  const comparisonSubgraphError = ref('')
  const generatingComparisonSubgraph = ref(false)
  const downloadingComparisonSubgraph = ref(false)
  const comparisonSubgraphCounts = ref<{ nodes: number, edges: number } | null>(null)
  const comparisonGraphMode = ref<'comparison' | 'expanded'>('comparison')
  let pendingComparison: AbortController | undefined

  function clearComparison() {
    pendingComparison?.abort()
    pendingComparison = undefined
    comparisonResult.value = null
    comparisonError.value = ''
    comparisonSubgraphHtml.value = ''
    comparisonSubgraphError.value = ''
    comparisonSubgraphCounts.value = null
    comparisonGraphMode.value = 'comparison'
    comparing.value = false
    generatingComparisonSubgraph.value = false
  }

  async function generateComparisonSubgraph(
    dataset: Dataset,
    proteinA: string,
    proteinB: string,
    viewMode: 'comparison' | 'expanded' = 'comparison',
    distance = 1,
    nodeLimit = 300,
  ) {
    if (generatingComparisonSubgraph.value) return false
    generatingComparisonSubgraph.value = true
    comparisonSubgraphError.value = ''
    const controller = new AbortController()
    pendingComparison = controller

    try {
      const record = await getStoredDataset(dataset.name)
      if (!record) throw new Error('No se pudo recuperar el dataset guardado en este navegador.')
      const result = await requestComparisonSubgraph(
        record.file, record.hasHeader, proteinA, proteinB,
        distance, nodeLimit, true, viewMode, controller.signal,
      )
      if (controller.signal.aborted) return false
      comparisonSubgraphHtml.value = result.html ?? ''
      comparisonSubgraphCounts.value = { nodes: result.node_count, edges: result.edge_count }
      comparisonGraphMode.value = viewMode
      return !!result.html
    } catch (error) {
      if (!controller.signal.aborted) {
        comparisonSubgraphError.value = error instanceof Error ? error.message : 'Error al generar el subgrafo conjunto.'
      }
      return false
    } finally {
      if (pendingComparison === controller) pendingComparison = undefined
      if (!controller.signal.aborted) generatingComparisonSubgraph.value = false
    }
  }

  async function downloadComparisonSubgraph(
    dataset: Dataset,
    proteinA: string,
    proteinB: string,
    distance = 1,
    nodeLimit = 300,
  ) {
    if (downloadingComparisonSubgraph.value) return
    downloadingComparisonSubgraph.value = true
    comparisonSubgraphError.value = ''
    const controller = new AbortController()
    try {
      const record = await getStoredDataset(dataset.name)
      if (!record) throw new Error('No se pudo recuperar el dataset guardado en este navegador.')
      const result = await requestComparisonSubgraph(
        record.file, record.hasHeader, proteinA, proteinB,
        distance, nodeLimit, false, comparisonGraphMode.value, controller.signal,
      )
      if (!result.image_base64) throw new Error('No se pudo preparar la imagen PNG.')
      const anchor = document.createElement('a')
      anchor.href = `data:image/png;base64,${result.image_base64}`
      anchor.download = `comparacion-${proteinA}-${proteinB}.png`
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
    } catch (error) {
      comparisonSubgraphError.value = error instanceof Error ? error.message : 'Error al descargar el subgrafo conjunto.'
    } finally {
      downloadingComparisonSubgraph.value = false
    }
  }

  async function compare(dataset: Dataset, proteinA: string, proteinB: string) {
    if (comparing.value) return

    comparing.value = true
    comparisonResult.value = null
    comparisonError.value = ''
    comparisonSubgraphHtml.value = ''
    comparisonSubgraphError.value = ''
    comparisonSubgraphCounts.value = null
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
    comparisonSubgraphHtml,
    comparisonSubgraphError,
    comparisonSubgraphCounts,
    comparisonGraphMode,
    generatingComparisonSubgraph,
    downloadingComparisonSubgraph,
    compare,
    generateComparisonSubgraph,
    downloadComparisonSubgraph,
    clearComparison,
  }
}
