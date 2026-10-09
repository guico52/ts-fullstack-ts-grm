import { createApp } from "vue"
import { createPinia } from "pinia"

import "@/assets/main.css"
import App from "@/App.vue"
import { router } from "@/router"
import { installGuard } from "@/router/guard"
import { useThemeStore } from "@/stores/theme"

const app = createApp(App)

const pinia = createPinia()
app.use(pinia)

// 守卫要用 store，所以必须在 pinia 装好**之后**装它 —— 它内部才敢调
// useAuthStore()。守卫里也要能拿到 router，所以它自己 import 那个单例。
installGuard()
app.use(router)

// Apply the stored theme before the first render mounts, so the app never
// repaints from the wrong surface colour. The pinia instance is passed
// explicitly: this call sits outside any component, so there is no active
// pinia to fall back on.
useThemeStore(pinia).init()

app.mount("#app")
