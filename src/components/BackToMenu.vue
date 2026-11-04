<script setup lang="ts">
const emit = defineEmits<{ back: [] }>()
</script>

<template>
  <button class="back-button" type="button" @click="emit('back')">
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M16 10H4m5-5-5 5 5 5" />
    </svg>
    Volver al menú
  </button>
</template>

<style scoped>
.back-button {
  display: inline-flex;
  min-height: 32px;
  flex: 0 0 auto;
  align-self: flex-start;
  align-items: center;
  gap: 7px;
  margin: 0 0 6px -8px;
  padding: 4px 8px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: #12333f;
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}

.back-button svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round; }
.back-button:hover { background: rgb(255 255 255 / 45%); }

.back-button:focus-visible { outline: 2px solid #08485d; outline-offset: 3px; }
</style>
