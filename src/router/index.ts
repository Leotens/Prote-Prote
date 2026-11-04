import { createRouter, createWebHistory } from 'vue-router'
import MenuView from '../views/MenuView.vue'
import DatasetsView from '../views/DatasetsView.vue'
import VisualizerView from '../views/VisualizerView.vue'
import CompareProteinsView from '../views/CompareProteinsView.vue'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
  }
}

export default createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'menu',
      component: MenuView,
      meta: { title: 'Bienvenido de vuelta' },
    },
    {
      path: '/datasets',
      name: 'datasets',
      component: DatasetsView,
      meta: { title: 'Administrar Datasets' },
    },
    {
      path: '/visualizer',
      name: 'visualizer',
      component: VisualizerView,
      meta: { title: 'Visualizar Dataset' },
    },
    {
      path: '/compare',
      name: 'compare',
      component: CompareProteinsView,
      meta: { title: 'Comparar proteínas' },
    },
    { path: '/:pathMatch(.*)*', redirect: { name: 'menu' } },
  ],
})
