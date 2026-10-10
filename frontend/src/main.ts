import { createApp } from "vue"
import { createPinia } from "pinia"

import "@/assets/main.css"
import App from "@/App.vue"
import { onSessionEvent } from "@/lib/session-events"
import { useAuthStore } from "@/stores/auth"
import { useAccessStore } from "@/stores/access"
import { clearAccessRoutes } from "@/router"
import { router } from "@/router"
import { installGuard } from "@/router/guard"
import { useThemeStore } from "@/stores/theme"

const app = createApp(App)

const pinia = createPinia()
app.use(pinia)

// 守卫要用 store，所以必须在 pinia 装好**之后**装它 —— 它内部才敢调
// useAuthStore()。守卫里也要能拿到 router，所以它自己 import 那个单例。
installGuard()
onSessionEvent((event) => {
  const auth = useAuthStore(pinia)
  if (!auth.signedIn) return
  if (event === "password-required") {
    if (auth.user) auth.signIn({ ...auth.user, mustChangePassword: true })
    void router.replace("/account/password")
    return
  }
  auth.signOut()
  useAccessStore(pinia).reset()
  clearAccessRoutes()
  void router.replace({ name: "login", query: { expired: "1" } })
})
app.use(router)

// Apply the stored theme before the first render mounts, so the app never
// repaints from the wrong surface colour. The pinia instance is passed
// explicitly: this call sits outside any component, so there is no active
// pinia to fall back on.
useThemeStore(pinia).init()

app.mount("#app")
