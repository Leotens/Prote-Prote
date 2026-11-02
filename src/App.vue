<template>
  <main class="menu-page">
    <header class="topbar">
      <div class="brand" aria-label="Prote-Prote">
        <span>Prote-Prote</span>
        <img src="/images/logo.png" alt="" />
      </div>
      <p class="welcome">Bienvenido de vuelta</p>
    </header>

    <section class="menu-content" id="inicio" aria-label="Menú principal">
      <nav class="menu-actions" aria-label="Opciones principales">
        <button class="menu-button button-load" type="button">
          <img class="button-surface" src="/images/boton_1.png" alt="" />
          <span>Cargar Dataset</span>
        </button>
        <button class="menu-button button-visualize" type="button">
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

    <div class="dataset-status" role="status" aria-live="polite">
      Dataset cargado: PP-Decagon
    </div>
  </main>
</template>
