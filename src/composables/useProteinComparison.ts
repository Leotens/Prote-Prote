import { onBeforeUnmount, ref, watch, type Ref } from 'vue'
import type { Dataset } from '../datasets'
import {
  requestComparisonSubgraph,
  requestDatasetProteins,
  requestProteinComparison,
  requestProteinMstComparison,
  type ProteinComparisonMst,
  type ProteinComparisonResult,
} from '../infrastructure/datasetsApi'
import { getStoredDataset, saveDatasetProteins } from '../infrastructure/datasetsStorage'

export function useProteinComparison(dataset: Ref<Dataset>) {
  const proteins = ref<string[]>([])
  const loadingProteins = ref(false)
  const proteinListError = ref('')
  const comparisonResult = ref<ProteinComparisonResult | null>(null)
  const comparisonError = ref('')
  const comparing = ref(false)
  const comparisonSubgraphHtml = ref('')
  const comparisonSubgraphError = ref('')
  const generatingComparisonSubgraph = ref(false)
  const downloadingComparisonSubgraph = ref(false)
  const comparisonSubgraphCounts = ref<{ nodes: number, edges: number } | null>(null)
  const mstComparisonResult = ref<ProteinComparisonMst | null>(null)
  const comparisonGraphMode = ref<'comparison' | 'expanded' | 'mst'>('comparison')
  let pendingComparison: AbortController | undefined
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

  function clearComparison() {
    pendingComparison?.abort()
    pendingComparison = undefined
    comparisonResult.value = null
    comparisonError.value = ''
    comparisonSubgraphHtml.value = ''
    comparisonSubgraphError.value = ''
    comparisonSubgraphCounts.value = null
    mstComparisonResult.value = null
    comparisonGraphMode.value = 'comparison'
    comparing.value = false
    generatingComparisonSubgraph.value = false
  }

  async function generateComparisonSubgraph(
    dataset: Dataset,
    proteinA: string,
    proteinB: string,
    viewMode: 'comparison' | 'expanded' | 'mst' = 'comparison',
    distance = 1,
    nodeLimit = 300,
  ) {
    if (generatingComparisonSubgraph.value) return false
    generatingComparisonSubgraph.value = true
    comparisonSubgraphError.value = ''
    comparisonGraphMode.value = viewMode
    const controller = new AbortController()
    pendingComparison = controller

    try {
      const record = await getStoredDataset(dataset.name)
      if (!record) throw new Error('No se pudo recuperar el dataset guardado en este navegador.')
      if (viewMode === 'mst') {
        const result = await requestProteinMstComparison(
          record.file, record.hasHeader, proteinA, proteinB, controller.signal,
        )
        if (controller.signal.aborted) return false
        mstComparisonResult.value = result
        comparisonSubgraphHtml.value = ''
        const nodes = new Set([...result.graph_a.nodes, ...result.graph_b.nodes])
        const edges = new Set(
          [...result.graph_a.edges, ...result.graph_b.edges]
            .map(([source, target]) => [source, target].sort().join('\u0000')),
        )
        comparisonSubgraphCounts.value = { nodes: nodes.size, edges: edges.size }
        return true
      }
      mstComparisonResult.value = null
      const result = await requestComparisonSubgraph(
        record.file, record.hasHeader, proteinA, proteinB,
        distance, nodeLimit, true, viewMode, controller.signal,
      )
      if (controller.signal.aborted) return false
      comparisonSubgraphHtml.value = result.html ?? ''
      comparisonSubgraphCounts.value = { nodes: result.node_count, edges: result.edge_count }
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
    if (comparing.value || loadingProteins.value) return

    comparing.value = true
    comparisonResult.value = null
    comparisonError.value = ''
    comparisonSubgraphHtml.value = ''
    comparisonSubgraphError.value = ''
    comparisonSubgraphCounts.value = null
    mstComparisonResult.value = null
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

  watch(() => dataset.value.name, loadProteins, { immediate: true })
  onBeforeUnmount(() => {
    pendingList?.abort()
    clearComparison()
  })

  return {
    comparisonResult,
    proteins,
    loadingProteins,
    proteinListError,
    comparisonError,
    comparing,
    comparisonSubgraphHtml,
    comparisonSubgraphError,
    comparisonSubgraphCounts,
    mstComparisonResult,
    comparisonGraphMode,
    generatingComparisonSubgraph,
    downloadingComparisonSubgraph,
    compare,
    generateComparisonSubgraph,
    downloadComparisonSubgraph,
    clearComparison,
    loadProteins,
  }
}
