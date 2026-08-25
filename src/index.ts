import type { App } from 'vue'
import RmrSwiper from './components/RmrSwiper.vue'

export { RmrSwiper }

// vue插件，支持 app.use
const RmrSwiperPlugin = {
  install(app: App) {
    app.component('RmrSwiper', RmrSwiper)
  }
}

export default RmrSwiperPlugin
