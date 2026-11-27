<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGeneAnnotation } from '../composables/useGeneAnnotation'

const props = defineProps<{
  proteinA: string
  proteinB: string
  degreeA: number
  degreeB: number
  sharedNeighbors: number
  sameComponent: boolean
}>()
const panel = ref<HTMLDialogElement | null>(null)
const idA = computed(() => props.proteinA)
const idB = computed(() => props.proteinB)
const a = useGeneAnnotation(idA)
const b = useGeneAnnotation(idB)

const labelA = computed(() => a.annotation.value?.symbol ?? `Proteína ${props.proteinA}`)
const labelB = computed(() => b.annotation.value?.symbol ?? `Proteína ${props.proteinB}`)
const loading = computed(() => a.loadingAnnotation.value || b.loadingAnnotation.value)
const neighborUnion = computed(() => Math.max(0, props.degreeA + props.degreeB - props.sharedNeighbors))
const jaccardSimilarity = computed(() => neighborUnion.value
  ? (props.sharedNeighbors / neighborUnion.value) * 100
  : 0)
const comparisonMeaning = computed(() => {
  if (props.sharedNeighbors) {
    return `${labelA.value} y ${labelB.value} comparten conexiones con algunas de las mismas proteínas. Estas coincidencias pueden servir como puntos de unión entre sus entornos y conviene investigar sus funciones.`
  }
  if (props.sameComponent) {
    return `${labelA.value} y ${labelB.value} no comparten conexiones directas con las mismas proteínas. Sin embargo, forman parte del mismo grupo conectado, por lo que existe una ruta indirecta entre ellas mediante otras proteínas.`
  }
  return `${labelA.value} y ${labelB.value} no comparten conexiones con las mismas proteínas y pertenecen a grupos separados dentro de este dataset.`
})

function sourceUrl(id: string) {
  return `https://www.ncbi.nlm.nih.gov/gene/${encodeURIComponent(id)}`
}

function pubChemUrl(id: string) {
  return `https://pubchem.ncbi.nlm.nih.gov/gene/${encodeURIComponent(id)}`
}

function closePanel() {
  panel.value?.close()
}

function openPanel() {
  panel.value?.showModal()
}
</script>

<template>
  <button class="science-trigger" type="button" @click="openPanel">Ver análisis científico</button>
  <Teleport to="body">
    <dialog ref="panel" class="science-dialog" aria-labelledby="science-dialog-title" @click.self="closePanel">
      <header class="science-heading">
        <h2 id="science-dialog-title"><span class="material-symbols-outlined" aria-hidden="true">analytics</span>Análisis de vecindad: {{ labelA }} vs. {{ labelB }}</h2>
        <button type="button" aria-label="Cerrar análisis científico" @click="closePanel"><span class="material-symbols-outlined" aria-hidden="true">close</span></button>
      </header>
      <div class="science-content">
        <p v-if="loading" class="science-status" role="status">Consultando contexto científico…</p>
        <template v-else>
          <fieldset class="science-section interpretation-section">
            <legend>¿Qué significa esta comparación?</legend>
            <p>{{ comparisonMeaning }}</p>
          </fieldset>

          <fieldset class="science-section jaccard-card">
            <legend>Similitud de vecinos</legend>
            <div>
              <label for="jaccard-output">Porcentaje de coincidencia</label>
              <small>Índice de Jaccard</small>
            </div>
            <output id="jaccard-output" title="Proporción de vecinos compartidos respecto del conjunto total de vecinos diferentes.">{{ jaccardSimilarity.toFixed(2) }} %</output>
            <p>{{ jaccardSimilarity === 0 ? 'Un 0 % significa que no comparten vecinos.' : 'Cuanto mayor sea el porcentaje, más conexiones en común tienen ambas proteínas.' }}</p>
          </fieldset>

          <aside class="evidence-note">
            <span class="material-symbols-outlined" aria-hidden="true">warning</span>
            <p><strong>Nota:</strong> Este resultado permite plantear relaciones para investigar, pero no confirma que las proteínas tengan la misma función, enfermedad asociada o tratamiento.</p>
          </aside>

          <fieldset class="science-section sources-section">
            <legend>Fuentes externas</legend>
            <div class="source-grid">
              <article>
                <strong>{{ labelA }}</strong>
                <a :href="pubChemUrl(proteinA)" target="_blank" rel="noopener noreferrer">Enfermedades y fármacos</a>
                <a :href="sourceUrl(proteinA)" target="_blank" rel="noopener noreferrer">Ficha del gen en NCBI</a>
              </article>
              <article>
                <strong>{{ labelB }}</strong>
                <a :href="pubChemUrl(proteinB)" target="_blank" rel="noopener noreferrer">Enfermedades y fármacos</a>
                <a :href="sourceUrl(proteinB)" target="_blank" rel="noopener noreferrer">Ficha del gen en NCBI</a>
              </article>
            </div>
          </fieldset>
        </template>
      </div>
    </dialog>
  </Teleport>
</template>

<style scoped>
.science-trigger { width: fit-content; margin-top: 10px; border: 0; padding: 2px 0; background: transparent; color: #155f78; cursor: pointer; font: inherit; font-size: 0.78rem; font-weight: 900; text-decoration: underline; text-underline-offset: 3px; }
.science-trigger::before { content: '◆'; margin-right: 6px; font-size: 0.58rem; text-decoration: none; }
.science-dialog { width: min(620px, calc(100vw - 24px)); max-height: min(620px, calc(100vh - 24px)); margin: auto; border: 1px solid #16566d; border-radius: 7px; padding: 0; overflow: hidden; background: #fff; color: #102e38; box-shadow: 0 18px 52px rgb(5 47 63 / 38%); font-family: 'Jura', 'Segoe UI', sans-serif; font-size: 0.78rem; }
.science-dialog::backdrop { background: rgb(3 34 48 / 42%); backdrop-filter: blur(2px); }
.science-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 12px; border: 0; background: #16566d; }
.science-heading h2 { display: flex; min-width: 0; align-items: center; gap: 7px; margin: 0; color: white; font-size: 0.92rem; font-weight: 700; line-height: 1.25; overflow-wrap: anywhere; }
.science-heading h2 > .material-symbols-outlined { display: grid; width: 22px; height: 22px; flex: none; place-items: center; border: 0; background: transparent; color: white; font-family: 'Material Symbols Outlined'; font-size: 19px; font-variation-settings: 'FILL' 0, 'wght' 500, 'GRAD' 0, 'opsz' 24; }
.science-heading button { display: grid; width: 27px; height: 27px; flex: none; place-items: center; border: 0; border-radius: 3px; padding: 0; background: transparent; color: white; cursor: pointer; font: 800 1.1rem/1 'Jura', sans-serif; }
.science-heading button .material-symbols-outlined { font-family: 'Material Symbols Outlined'; font-size: 19px; font-variation-settings: 'FILL' 0, 'wght' 550, 'GRAD' 0, 'opsz' 24; }
.science-heading button:hover { background: rgb(255 255 255 / 18%); }
.science-content { display: grid; max-height: calc(min(620px, 100vh - 24px) - 40px); gap: 8px; padding: 9px 10px 10px; overflow-y: auto; }
.science-content p { margin: 0; font-size: 12px; line-height: 1.3; }
.science-section { min-width: 0; margin: 0; border: 1px solid #76a8b5; border-radius: 3px; padding: 9px 10px 10px; background: transparent; }
.science-section legend { padding: 0 5px; color: #123d4b; font-size: 12px; font-weight: 700; }
.interpretation-section p { font-weight: 400; }
.jaccard-card { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 7px 10px; }
.jaccard-card label { font-size: 12px; font-weight: 700; }
.jaccard-card div { display: grid; gap: 1px; }
.jaccard-card small { color: #526f78; font-size: 0.67rem; }
.jaccard-card output { min-width: 78px; border: 1px solid #8db7c2; border-radius: 2px; padding: 4px 8px; background: #fff; color: #102e38; font: 600 1rem/1.2 'Jura', sans-serif; text-align: right; }
.jaccard-card > p { grid-column: 1 / -1; color: #405f69; font-size: 0.71rem; }
.evidence-note { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 8px; padding: 7px 2px; border: 0; border-bottom: 1px solid #76a8b5; border-radius: 0; background: transparent; }
.evidence-note > .material-symbols-outlined { color: #a97800; font-family: 'Material Symbols Outlined'; font-size: 23px; font-variation-settings: 'FILL' 0, 'wght' 500, 'GRAD' 0, 'opsz' 24; line-height: 1; }
.evidence-note strong { color: #102e38; }
.evidence-note p { color: #253d45; font-size: 11px; }
.source-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.source-grid article { display: grid; gap: 3px; padding: 5px 8px; border: 0; border-left: 2px solid #5b96a6; border-radius: 0; background: transparent; }
.source-grid strong { color: #102e38; font-size: 12px; }
.source-grid a { color: #0b4e75; font-size: 11px; font-weight: 400; text-underline-offset: 1px; }
.science-status { color: #45636d; }
@media (max-width: 620px) {
  .science-dialog { width: calc(100vw - 10px); max-height: calc(100vh - 10px); }
  .science-content { max-height: calc(100vh - 43px); padding: 7px; }
  .source-grid { grid-template-columns: 1fr; }
}
</style>
