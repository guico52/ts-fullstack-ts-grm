import { useAccessStore } from "@/stores/access"
import { useAuthStore } from "@/stores/auth"

import { registerAccessRoutes, router } from "./index"

/**
 * The route guard.
 *
 * Three questions, in this order:
 *
 * 1. **Is this the login page?** Then nothing to check — and a signed-in user
 *    landing there is sent on, we do not need a second login.
 * 2. **Is anybody signed in?** If not, off to the login page, remembering where
 *    they were headed.
 * 3. **Do we know what they may reach?** After a page reload the session is
 *    still in storage but the access set is not, and the router has no routes
 *    for it yet. Fetch it, register the routes it implies, then re-resolve the
 *    same location.
 *
 * The re-resolve cannot loop: the second pass finds `loaded === true` and stops.
 *
 * **This is not the security boundary.** The backend checks every request; this
 * only keeps the interface from offering pages that would be refused.
 */
export function installGuard(): void {
  router.beforeEach(async (to) => {
    const auth = useAuthStore()

    if (to.meta.layout === "bare") {
      return auth.signedIn ? { path: "/" } : true
    }

    if (!auth.signedIn) {
      return { name: "login", query: to.fullPath === "/" ? {} : { redirect: to.fullPath } }
    }

    const access = useAccessStore()
    if (access.loaded) return true

    // 刷新页面：会话还在，但可达集合与动态路由都没了。
    try {
      await access.load()
    } catch {
      // token 过期或服务端不认了 —— 清掉本地，回到登录页。
      auth.signOut()
      return { name: "login" }
    }

    registerAccessRoutes(access.views)
    return to.fullPath
  })
}
