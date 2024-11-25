import { createMemoryHistory, createRouter } from 'vue-router'

import LandingPage from './components/LandingPage.vue'
import GameBoard from './components/GameBoard.vue'

const routes = [
  { path: '/', component: LandingPage },
  { path: '/game', component: GameBoard },
]

const router = createRouter({
    history: createMemoryHistory(),
    routes,
})

export default router