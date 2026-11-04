<script setup lang="ts">
defineProps<{ surface: string }>()
</script>

<template>
  <button class="menu-button" type="button">
    <img class="button-surface" :src="surface" alt="" />
    <span><slot /></span>
  </button>
</template>

<style scoped>
.menu-button {
  position: relative;
  display: grid;
  width: min(100%, 590px);
  min-height: clamp(48px, 14dvh, 144px);
  place-items: center;
  padding: 5px 24px 5px 12px;
  border: 0;
  background: transparent;
  color: #fff;
  cursor: pointer;
  font: inherit;
  font-size: clamp(1rem, min(2.2vw, 4dvh), 2rem);
  letter-spacing: 0.035em;
  line-height: 1.15;
  text-align: center;
  text-shadow: 0 1px 1px rgb(177 56 0 / 12%);
  transition: filter 160ms ease, transform 160ms ease;
}

.button-surface {
  position: absolute;
  top: -17%;
  left: var(--surface-left, -5%);
  width: var(--surface-width, 106%);
  height: 150%;
  object-fit: fill;
  pointer-events: none;
}

.menu-button span { position: relative; z-index: 1; }
.menu-button:hover { filter: brightness(1.08); transform: translateY(-2px); }
.menu-button:active { filter: brightness(0.96); transform: translateY(1px); }
.menu-button:focus-visible { outline: 3px solid white; outline-offset: 4px; }

</style>
