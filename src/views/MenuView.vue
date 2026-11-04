<script setup lang="ts">
import MenuButton from '../components/MenuButton.vue'

defineProps<{ datasetName?: string }>()
const emit = defineEmits<{ datasets: []; visualizer: []; compare: [] }>()
</script>

<template>
  <section class="menu-content" id="inicio" aria-label="Menú principal">
    <nav class="menu-actions" aria-label="Opciones principales">
      <MenuButton class="button-load" surface="/images/boton_1.png" @click="emit('datasets')">Administrar <br> Datasets</MenuButton>
      <MenuButton class="button-visualize" surface="/images/boton_1.png" @click="emit('visualizer')">Visualizar<br />Dataset</MenuButton>
      <MenuButton class="button-compare" surface="/images/boton_2.png" @click="emit('compare')">Comparar<br />proteínas</MenuButton>
      <MenuButton class="button-credits" surface="/images/boton_1.png">Créditos</MenuButton>
    </nav>

    <section class="hero" aria-label="Prote-Prote, visualizador de relaciones entre proteínas">
      <img class="hero-logo" src="/images/logo.png" alt="" />
      <h1>Prote-Prote</h1>
      <p>Visualizador de relaciones<br />entre proteínas</p>
    </section>
  </section>

  <div class="dataset-status" role="status">
    {{ datasetName ? `Dataset cargado: ${datasetName}` : 'Sin datasets cargados' }}
  </div>
</template>

<style scoped>
.menu-content {
  display: grid;
  flex: 1;
  grid-template-columns: minmax(220px, 34%) minmax(0, 1fr);
  align-items: center;
  gap: clamp(16px, 5vw, 80px);
  padding: clamp(10px, 2dvh, 24px) clamp(8px, 2vw, 32px);
}

.menu-actions { display: flex; max-width: 46dvh; flex-direction: column; align-items: flex-start; gap: clamp(8px, 2.2dvh, 24px); }

.button-load { width: 100%; }
.button-visualize { width: 91%; }
.button-compare { --surface-left: -5.5%; --surface-width: 119%; width: 87%; }
.button-credits { width: 92%; }

.hero {
  position: relative;
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.hero-logo { width: clamp(48px, min(9vw, 14dvh), 136px); height: auto; margin-bottom: clamp(6px, 1.5dvh, 14px); }
.hero h1 {
  margin: 0;
  font-size: clamp(2rem, min(5.8vw, 10dvh), 5.8rem);
  font-weight: 400;
  letter-spacing: 0.025em;
  line-height: 1.05;
  text-shadow: 0 0 0.18em rgb(255 255 255 / 40%), 0 0 0.48em rgb(255 255 255 / 25%);
}
.hero > p { margin: 8px 0 0; font-size: clamp(1rem, min(2.2vw, 4dvh), 2rem); letter-spacing: 0.04em; line-height: 1.3; }

.dataset-status {
  align-self: flex-end;
  min-width: min(41%, 620px);
  margin: 0 clamp(12px, 2vw, 34px) 0 0;
  padding: 8px 20px;
  border: 1px solid rgb(255 255 255 / 27%);
  border-radius: 999px;
  background: rgb(255 255 255 / 27%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 12%);
  backdrop-filter: blur(5px);
  font-size: clamp(0.9rem, 1.3vw, 1.25rem);
  letter-spacing: 0.04em;
  text-align: center;
}

@media (max-width: 640px) {
  .menu-content { grid-template-columns: 1fr; align-content: center; gap: clamp(14px, 4dvh, 32px); }
  .menu-actions { display: grid; max-width: none; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .menu-actions > .menu-button { width: 100%; min-height: clamp(52px, 9dvh, 74px); margin: 0; }
  .hero h1 { font-size: clamp(2rem, 9vw, 3.5rem); }
  .dataset-status { align-self: center; min-width: 0; width: 100%; margin: 0; }
}
</style>
