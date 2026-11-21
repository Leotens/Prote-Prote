<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{ id: string, label: string, proteins: readonly string[], disabled?: boolean, placeholder: string }>()
const model = defineModel<string>({ required: true })
const open = ref(false)
const active = ref(-1)
const input = ref<HTMLInputElement | null>(null)
const matches = computed(() => {
  const query = model.value.trim().toLowerCase()
  return props.proteins.filter(id => id.toLowerCase().includes(query))
})
const options = computed(() => matches.value.slice(0, 100))
watch(model, () => { active.value = -1 })
watch(() => props.disabled, disabled => { if (disabled) open.value = false })

function choose(id: string) {
  model.value = id
  open.value = false
  input.value?.focus()
  open.value = false
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    open.value = true
    active.value = Math.max(0, Math.min(options.value.length - 1, active.value + (event.key === 'ArrowDown' ? 1 : -1)))
    const element = document.getElementById(`${props.id}-option-${active.value}`)
    element?.scrollIntoView({ block: 'nearest' })
  } else if (event.key === 'Enter' && open.value && active.value >= 0) {
    event.preventDefault()
    const id = options.value[active.value]
    if (id) choose(id)
  } else if (event.key === 'Escape') {
    event.preventDefault()
    open.value = false
  }
}

function onFocusout(event: FocusEvent) {
  if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) open.value = false
}
</script>

<template>
  <div class="protein-selector" @focusout="onFocusout">
    <label :for="id">{{ label }}</label>
    <div class="selector-input">
      <input :id="id" ref="input" v-model="model" :placeholder="placeholder" :disabled="disabled" type="text" role="combobox" autocomplete="off" :aria-expanded="open" :aria-controls="`${id}-list`" :aria-activedescendant="open && active >= 0 ? `${id}-option-${active}` : undefined" aria-autocomplete="list" @focus="open = true" @input="open = true" @keydown="onKeydown" />
      <button type="button" :disabled="disabled" :aria-label="`Mostrar listado de ${label.toLowerCase()}`" :aria-expanded="open" :aria-controls="`${id}-list`" @click="open = !open">⌄</button>
    </div>
    <div v-if="open && !disabled" class="selector-dropdown">
      <ul :id="`${id}-list`" role="listbox" :aria-label="label">
        <li v-for="(protein, index) in options" :id="`${id}-option-${index}`" :key="protein" role="option" :aria-selected="index === active" @mousedown.prevent @click="choose(protein)">{{ protein }}</li>
      </ul>
      <p v-if="!options.length" role="status">No se encontraron proteínas.</p>
      <p v-else-if="matches.length > options.length">Mostrando {{ options.length }} de {{ matches.length }}. Escribe para filtrar.</p>
    </div>
  </div>
</template>

<style scoped>
.protein-selector { position: relative; min-width: 0; }
label { display: block; margin-bottom: 5px; font-size: 0.9rem; font-weight: 700; text-transform: uppercase; }
.selector-input { display: flex; border: 1px solid #8aafbb; border-radius: 10px; background: #f5fcff; }
input { width: 100%; min-width: 0; min-height: 42px; border: 0; border-radius: 10px; padding: 8px 12px; background: transparent; color: inherit; font: inherit; }
input::placeholder { color: #6a858e; }
button { width: 38px; flex: none; border: 0; border-radius: 10px; background: transparent; color: #164c5c; font-size: 1.3rem; cursor: pointer; }
:is(input, button):focus-visible { outline: 2px solid #08485d; outline-offset: 2px; }
.selector-dropdown { position: absolute; z-index: 5; top: calc(100% + 4px); width: 100%; overflow: hidden; border: 1px solid #96bdc8; border-radius: 10px; background: #edfaff; box-shadow: 0 6px 16px #0c4c673d; }
ul { max-height: 220px; margin: 0; padding: 4px; overflow-y: auto; list-style: none; }
li { padding: 7px 10px; border-radius: 6px; cursor: pointer; }
li:hover, li[aria-selected='true'] { background: #16566d; color: white; }
p { margin: 0; padding: 8px 12px; font-size: 0.8rem; }
</style>
