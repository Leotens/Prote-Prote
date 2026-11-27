<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useGeneAnnotation } from '../composables/useGeneAnnotation'

const props = withDefaults(defineProps<{ id?: string, compact?: boolean }>(), { compact: false })
const geneId = computed(() => props.id)
const { annotation, loadingAnnotation, annotationError, retryAnnotation } = useGeneAnnotation(geneId)
const showFullSummary = ref(false)

watch(geneId, () => { showFullSummary.value = false })

const summaryPreview = computed(() => {
  const summary = annotation.value?.summary ?? ''
  return summary.length > 280 ? `${summary.slice(0, 280).replace(/\s+\S*$/, '')}…` : summary
})
</script>

<template>
  <section class="gene-summary-card" :class="{ compact }" aria-label="Información del gen">
    <p v-if="loadingAnnotation" class="gene-status" role="status">{{ compact ? 'Consultando nombre…' : 'Consultando información del gen…' }}</p>
    <div v-else-if="annotationError" class="gene-message">
      <p class="gene-status" role="status">{{ annotationError }}</p>
      <button type="button" class="gene-action" @click="retryAnnotation">Reintentar</button>
    </div>
    <template v-else-if="annotation">
      <div class="gene-heading">
        <strong v-if="annotation.symbol" class="gene-symbol">{{ annotation.symbol }}</strong>
        <span v-if="annotation.name" class="gene-name">{{ annotation.name }}</span>
      </div>
      <template v-if="!compact && annotation.summary">
        <h3>Resumen del gen</h3>
        <p class="gene-summary">{{ showFullSummary ? annotation.summary : summaryPreview }}</p>
        <button v-if="annotation.summary.length > 280" type="button" class="gene-action" :aria-expanded="showFullSummary" @click="showFullSummary = !showFullSummary">{{ showFullSummary ? 'Ver menos' : 'Leer más' }}</button>
      </template>
      <p v-else-if="!compact" class="gene-status">No hay un resumen disponible para este gen.</p>
      <a v-if="!compact" class="gene-source" :href="`https://mygene.info/v3/gene/${encodeURIComponent(annotation.id)}?fields=symbol,name,summary`" target="_blank" rel="noopener noreferrer">Fuente: MyGene.info · texto original</a>
    </template>
    <p v-else class="gene-status">{{ compact ? 'Información biológica no disponible.' : 'No se encontró información del gen para este ID.' }}</p>
  </section>
</template>

<style scoped>
.gene-summary-card { margin: 4px 0 7px; padding-bottom: 8px; border-bottom: 1px solid rgb(43 100 104 / 25%); }
.gene-heading { display: grid; min-width: 0; gap: 4px; }
.gene-symbol { width: fit-content; padding: 2px 7px; border-radius: 999px; background: #16566d; color: #fff; font-size: 0.72rem; }
.gene-name { color: #173f4c; font-size: 0.75rem; font-weight: 600; line-height: 1.3; overflow-wrap: anywhere; }
.gene-summary-card h3 { margin: 7px 0 3px; color: #173f4c; font-size: 0.75rem; }
.gene-summary, .gene-status { margin: 0; color: #34535e; font-size: 0.7rem; line-height: 1.42; overflow-wrap: anywhere; }
.gene-summary { max-height: 125px; overflow-y: auto; }
.gene-message { display: grid; gap: 3px; }
.gene-action { width: fit-content; border: 0; padding: 2px 0; background: transparent; color: #16566d; font: inherit; font-size: 0.7rem; text-decoration: underline; cursor: pointer; }
.gene-source { display: inline-block; margin-top: 7px; color: #16566d; font-size: 0.66rem; }
.gene-summary-card.compact { margin: 0; padding: 0; border: 0; }
.compact .gene-heading { display: flex; flex-wrap: wrap; align-items: center; gap: 5px 8px; }
.compact .gene-symbol { font-size: 0.7rem; }
.compact .gene-name { max-width: 30ch; overflow: hidden; font-size: 0.74rem; text-overflow: ellipsis; white-space: nowrap; }
.compact .gene-status { font-size: 0.74rem; }
:global(.summary-panel:fullscreen) .compact .gene-symbol { padding: 3px 9px; font-size: 0.92rem; }
:global(.summary-panel:fullscreen) .compact .gene-name { max-width: none; font-size: 0.92rem; font-weight: 700; white-space: normal; }
:global(.summary-panel:fullscreen) .compact .gene-status { font-size: 0.9rem; }
</style>
