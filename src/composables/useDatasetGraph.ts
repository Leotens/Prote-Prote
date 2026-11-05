import { onBeforeUnmount, ref } from 'vue'
import type { Dataset } from '../datasets'
import { requestDatasetGraph } from '../infrastructure/datasetsApi'
import { getStoredDataset } from '../infrastructure/datasetsStorage'

export function useDatasetGraph() {
  const graphHtml = ref('')
  const graphImageUrl = ref('')
  const graphError = ref('')
  const generatingGraph = ref(false)
  let pendingGraph: AbortController | undefined

  function clearGraph() {
    graphHtml.value = ''
    graphError.value = ''
    if (graphImageUrl.value) URL.revokeObjectURL(graphImageUrl.value)
    graphImageUrl.value = ''
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
        graphHtml.value = result.html
      } else {
        graphImageUrl.value = URL.createObjectURL(result.image)
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        graphError.value = error instanceof Error ? error.message : 'Error al generar el grafo.'
      }
    } finally {
      pendingGraph = undefined
      generatingGraph.value = false
    }
  }

  return { graphHtml, graphImageUrl, graphError, generatingGraph, generateGraph, clearGraph }
}
