<script setup lang="ts">
defineProps<{ title: string }>()
const emit = defineEmits<{ home: [] }>()
</script>

<template>
  <header class="topbar">
    <button class="brand" type="button" aria-label="Prote-Prote, menú principal" @click="emit('home')">
      <span>Prote-Prote</span>
      <img src="/images/logo.png" alt="" />
    </button>
    <p class="welcome">{{ title }}</p>
  </header>
</template>

<style scoped>
.topbar {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: clamp(50px, 8dvh, 76px);
  padding: 8px clamp(12px, 3vw, 44px);
  border: 1px solid rgb(255 255 255 / 33%);
  border-radius: 999px;
  background: rgb(255 255 255 / 18%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 12%);
  backdrop-filter: blur(4px);
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: clamp(10px, 1.2vw, 20px);
  padding: 0;
  border: 0;
  background: transparent;
  color: #fff;
  cursor: pointer;
  font-size: clamp(1.25rem, 2.45vw, 2.6rem);
  letter-spacing: 0.025em;
  line-height: 1;
  text-decoration: none;
  white-space: nowrap;
}

.brand img { width: clamp(24px, 2.6vw, 40px); height: auto; }
.brand:focus-visible { outline: 2px solid white; outline-offset: 4px; border-radius: 4px; }
.welcome { margin: 0; font-size: clamp(0.85rem, 1.4vw, 1.3rem); letter-spacing: 0.06em; text-align: right; }

@media (max-width: 760px) {
  .welcome { line-height: 1.2; }
}
</style>

