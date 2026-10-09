import { createApp } from "vue"
import { createPinia } from "pinia"

import "@/assets/main.css"
import App from "@/App.vue"
import { router } from "@/router"
import { useThemeStore } from "@/stores/theme"

const app = createApp(App)

const pinia = createPinia()
app.use(pinia)
app.use(router)

// Apply the stored theme before the first render mounts, so the app never
// repaints from the wrong surface colour. The pinia instance is passed
// explicitly: this call sits outside any component, so there is no active
// pinia to fall back on.
useThemeStore(pinia).init()

app.mount("#app")
