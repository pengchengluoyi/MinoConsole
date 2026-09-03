import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { initServiceConfig } from '@/utils/config'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import './styles/tokens.css'
import './style.css'
import './global-loading.css'
import './styles/overlay.css'
import { installOverlayDefaults } from './utils/overlay'

initServiceConfig().then((origin) => {
  console.log(`[Console] Nexus origin: ${origin || '(same origin / Vite proxy)'}`)
})

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(ElementPlus)
installOverlayDefaults()
app.mount('#app')
