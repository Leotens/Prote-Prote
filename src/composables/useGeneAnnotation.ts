import { ref, watch, type Ref } from 'vue'
import { requestGeneAnnotation, type GeneAnnotation } from '../infrastructure/datasetsApi'

const cache = new Map<string, GeneAnnotation | null>()

export function useGeneAnnotation(id: Ref<string | undefined>) {
  const annotation = ref<GeneAnnotation | null>(null)
  const loadingAnnotation = ref(false)
  const annotationError = ref('')
  const retry = ref(0)

  watch([id, retry], async ([geneId], _, onCleanup) => {
    annotation.value = null
    annotationError.value = ''
    loadingAnnotation.value = false
    if (!geneId) return
    if (cache.has(geneId)) {
      annotation.value = cache.get(geneId) ?? null
      return
    }
    const controller = new AbortController()
    let cancelled = false
    const timeout = window.setTimeout(() => controller.abort(), 12_000)
    onCleanup(() => {
      cancelled = true
      controller.abort()
      window.clearTimeout(timeout)
    })
    loadingAnnotation.value = true
    try {
      const result = await requestGeneAnnotation(geneId, controller.signal)
      if (cancelled) return
      annotation.value = result
      if (cache.size >= 200) cache.delete(cache.keys().next().value!)
      cache.set(geneId, result)
    } catch {
      if (!cancelled) annotationError.value = 'No se pudo consultar MyGene.info. Puedes volver a intentarlo.'
    } finally {
      window.clearTimeout(timeout)
      if (!cancelled) loadingAnnotation.value = false
    }
  }, { immediate: true })

  return { annotation, loadingAnnotation, annotationError, retryAnnotation: () => { retry.value++ } }
}
