<script setup lang="ts">
import BackToMenu from '../components/BackToMenu.vue'

const emit = defineEmits<{ back: [] }>()
const students = ['Isabel Aponte Pablo', 'Alejandra Astocondor Bazan', 'Leo Dulanto Espino']
</script>

<template>
  <section class="credits" aria-label="Créditos">
    <BackToMenu @back="emit('back')" />
    <div class="credits-content">
      <article class="glass-panel credits-panel">
        <img class="credits-logo" src="/images/logo.png" alt="" />
        <h1>Prote-Prote</h1>
        <h2>Desarrollado por</h2>
        <ul class="team">
          <li v-for="student in students" :key="student">{{ student }}</li>
        </ul>
      </article>
    </div>
  </section>
</template>

<style scoped>
.credits { display: flex; flex: 1; flex-direction: column; padding: clamp(10px, 2dvh, 20px) 4px 0; color: #12333f; }
.credits-content { display: grid; flex: 1; place-items: center; padding: 12px 0; }
.credits-panel { width: min(100%, 880px); padding: clamp(24px, 4vw, 56px); text-align: center; }
.credits-logo { width: clamp(48px, 7vw, 76px); height: auto; margin-bottom: 12px; }
h1 { margin: 0; color: #fff; font-size: clamp(1.8rem, 3vw, 2.65rem); line-height: 1.2; }
h2 { margin: clamp(24px, 4dvh, 36px) 0 20px; color: #34535e; font-size: 1rem; font-weight: 400; }
.team { display: grid; gap: 24px; margin: 0; padding: 0; list-style: none; }
.team li { font-size: clamp(1.1rem, 2vw, 1.5rem); font-weight: 700; line-height: 1.5; overflow-wrap: anywhere; }
</style>
