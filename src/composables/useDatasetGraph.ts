import { computed, onBeforeUnmount, ref } from 'vue'
import type { Dataset } from '../datasets'
import { requestDatasetGraph, requestDatasetSubgraph } from '../infrastructure/datasetsApi'
import { getStoredDataset } from '../infrastructure/datasetsStorage'

export function useDatasetGraph() {
  const fullGraphHtml = ref('')
  const fullGraphImageUrl = ref('')
  const subgraphHtml = ref('')
  const subgraphImageUrl = ref('')
  const activeGraph = ref<'full' | 'subgraph'>('full')
  const graphHtml = computed(() => activeGraph.value === 'subgraph' ? subgraphHtml.value : fullGraphHtml.value)
  const graphImageUrl = computed(() => activeGraph.value === 'subgraph' ? subgraphImageUrl.value : fullGraphImageUrl.value)
  const hasFullGraph = computed(() => !!fullGraphHtml.value || !!fullGraphImageUrl.value)
  const hasSubgraph = computed(() => !!subgraphHtml.value || !!subgraphImageUrl.value)
  const graphError = ref('')
  const generatingGraph = ref(false)
  let pendingGraph: AbortController | undefined

  function clearGraph() {
    fullGraphHtml.value = ''
    subgraphHtml.value = ''
    graphError.value = ''
    if (fullGraphImageUrl.value) URL.revokeObjectURL(fullGraphImageUrl.value)
    if (subgraphImageUrl.value) URL.revokeObjectURL(subgraphImageUrl.value)
    fullGraphImageUrl.value = ''
    subgraphImageUrl.value = ''
    activeGraph.value = 'full'
  }

  function showGraph(graph: 'full' | 'subgraph') {
    if (graph === 'full' || hasSubgraph.value) activeGraph.value = graph
  }

  onBeforeUnmount(() => {
    pendingGraph?.abort()
    clearGraph()
  })

  async function generateGraph(dataset: Dataset, nodeLimit: number, interactive: boolean) {
    if (generatingGraph.value) return

    generatingGraph.value = true
    clearGraph()
    const controller = new AbortController()
    pendingGraph = controller

    try {
      const record = await getStoredDataset(dataset.name)
      if (!record) {
        throw new Error('No se pudo recuperar el dataset guardado en este navegador.')
      }

      const result = await requestDatasetGraph(
        record.file,
        record.hasHeader,
        nodeLimit,
        interactive,
        controller.signal,
      )
      if (controller.signal.aborted) return

      if ('html' in result) {
        fullGraphHtml.value = result.html
      } else {
        fullGraphImageUrl.value = URL.createObjectURL(result.image)
      }
      activeGraph.value = 'full'
    } catch (error) {
      if (!controller.signal.aborted) {
        graphError.value = error instanceof Error ? error.message : 'Error al generar el grafo.'
      }
    } finally {
      pendingGraph = undefined
      generatingGraph.value = false
    }
  }

  async function generateSubgraph(dataset: Dataset, proteinId: string, distance: number, nodeLimit: number, interactive: boolean) {
    if (generatingGraph.value) return

    generatingGraph.value = true
    graphError.value = ''
    subgraphHtml.value = ''
    if (subgraphImageUrl.value) URL.revokeObjectURL(subgraphImageUrl.value)
    subgraphImageUrl.value = ''
    const controller = new AbortController()
    pendingGraph = controller

    try {
      const record = await getStoredDataset(dataset.name)
      if (!record) throw new Error('No se pudo recuperar el dataset guardado en este navegador.')

      const result = await requestDatasetSubgraph(
        record.file,
        record.hasHeader,
        proteinId,
        distance,
        nodeLimit,
        interactive,
        controller.signal,
      )
      if (controller.signal.aborted) return

      if ('html' in result) subgraphHtml.value = result.html
      else subgraphImageUrl.value = URL.createObjectURL(result.image)
      activeGraph.value = 'subgraph'
    } catch (error) {
      if (!controller.signal.aborted) {
        graphError.value = error instanceof Error ? error.message : 'Error al generar el subgrafo.'
      }
    } finally {
      pendingGraph = undefined
      generatingGraph.value = false
    }
  }

  return {
    graphHtml,
    graphImageUrl,
    graphError,
    generatingGraph,
    hasFullGraph,
    hasSubgraph,
    activeGraph,
    generateGraph,
    generateSubgraph,
    showGraph,
    clearGraph,
  }
}
