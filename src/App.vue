<script setup lang="ts">
import { ref } from 'vue'

const currentView = ref<'menu' | 'visualizer'>('menu')
</script>

<template>
  <main class="menu-page">
    <header class="topbar">
      <div class="brand" aria-label="Prote-Prote">
        <span>Prote-Prote</span>
        <img src="/images/logo.png" alt="" />
      </div>
      <p class="welcome">{{ currentView === 'menu' ? 'Bienvenido de vuelta' : 'Visualizar Dataset' }}</p>
    </header>

    <section v-if="currentView === 'menu'" class="menu-content" id="inicio" aria-label="Menú principal">
      <nav class="menu-actions" aria-label="Opciones principales">
        <button class="menu-button button-load" type="button">
          <img class="button-surface" src="/images/boton_1.png" alt="" />
          <span>Cargar Dataset</span>
        </button>
        <button class="menu-button button-visualize" type="button" @click="currentView = 'visualizer'">
          <img class="button-surface" src="/images/boton_1.png" alt="" />
          <span>Visualizar<br />Dataset</span>
        </button>
        <button class="menu-button button-recent" type="button">
          <img class="button-surface" src="/images/boton_2.png" alt="" />
          <span>Consultas<br />recientes</span>
        </button>
        <button class="menu-button button-credits" type="button">
          <img class="button-surface" src="/images/boton_1.png" alt="" />
          <span>Créditos</span>
        </button>
      </nav>

      <section class="hero" aria-label="Prote-Prote, visualizador de relaciones entre proteínas">
        <img class="hero-logo" src="/images/logo.png" alt="" />
        <h1>Prote-Prote</h1>
        <p>Visualizador de relaciones<br />entre proteínas</p>
      </section>
    </section>

    <div v-if="currentView === 'menu'" class="dataset-status" role="status">
      Dataset cargado: PP-Decagon
    </div>

    <section v-else class="visualizer" aria-label="Visualización del dataset PP-Decagon">
      <button class="back-button" type="button" aria-label="Volver al menú" @click="currentView = 'menu'">‹</button>

      <div class="dataset-summary">
        <span>Dataset PP-Decagon</span>
        <span>19 081 proteínas</span>
        <span>715 612 asociaciones</span>
      </div>

      <div class="visualizer-grid">
        <aside class="glass-panel parameters-panel">
          <h2>Parámetros</h2>
          <div class="mode-switch" aria-label="Modo de exploración">
            <button type="button" class="selected">Explorar entorno</button>
            <button type="button">Camino más corto</button>
          </div>

          <label class="field-label" for="protein-id">IDENTIFICADOR DE PROTEÍNA</label>
          <input id="protein-id" class="protein-input" type="text" placeholder="Ejemplo: 7157" />

          <label class="field-label" for="node-limit">LÍMITE MÁXIMO DE NODOS</label>
          <input id="node-limit" class="protein-input" type="number" placeholder="100" />

          <label class="field-label distance-label" for="distance-level">DISTANCIA MÁXIMA DESDE<br />LA PROTEÍNA</label>
          <span class="range-caption">Nivel</span>
          <input id="distance-level" class="distance-range" type="range" min="1" max="3" value="2" />
          <div class="range-values"><span>1</span><span>2</span><span>3</span></div>

          <button class="generate-button" type="button" aria-label="Generar subgrafo">
            <img src="/images/generate_button.png" alt="Generar subgrafo" />
          </button>
          <p class="node-note">Máx. 1500 nodos para una<br />visualización óptima</p>
        </aside>

        <section class="glass-panel graph-panel" aria-label="Área del grafo">
          <div class="graph-toolbar" aria-label="Herramientas del grafo">
            <button type="button" aria-label="Acercar">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5M10.5 7v7M7 10.5h7"/></svg>
            </button>
            <button type="button" aria-label="Alejar">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5M7 10.5h7"/></svg>
            </button>
            <span class="toolbar-divider"></span>
            <button type="button" aria-label="Pantalla completa">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3"/></svg>
            </button>
            <button type="button" aria-label="Compartir">
              <img class="share-icon" src="/images/share.png" alt="" />
            </button>
          </div>

          <div class="empty-graph">
            <img class="mascot" src="/images/mascot.png" alt="Mascota de Prote-Prote" />
            <h2>Ingresa un identificador para<br />explorar sus conexiones</h2>
            <p>Selecciona la distancia máxima desde la proteína y el<br class="wide-break" /> límite de nodos</p>
          </div>
        </section>

        <aside class="glass-panel details-panel">
          <h2>Ninguna proteína<br />seleccionada</h2>
          <p class="details-intro">Selecciona un nodo en el grafo para<br />ver sus detalles</p>
          <dl class="protein-details">
            <div><dt>ID</dt><dd>--</dd></div>
            <div><dt>Grado</dt><dd>--</dd></div>
            <div><dt>Vecinos</dt><dd>--</dd></div>
            <div><dt>Componente conectado</dt><dd>--</dd></div>
            <div><dt>Tamaño conectado</dt><dd>--</dd></div>
          </dl>
          <h3>Aún no hay una proteína<br />seleccionada</h3>
          <p class="details-hint">Ingresa un identificador y genera el subgrafo para visualizar la red de interacciones</p>
        </aside>
      </div>
    </section>
  </main>
</template>
