import { computed, ref } from "vue"
import { defineStore } from "pinia"

import { navEntriesFrom, VIEW_TYPE, type AccessView } from "@/lib/access"
import { api, describeApiError } from "@/lib/api"

/**
 * What the signed-in user may reach — the sidebar, the routes, and the buttons.
 *
 * All three come from one answer (`GET /auth/me/access`), so they cannot
 * disagree: a page that is not in `views` is not in the sidebar **and** not
 * registered as a route. Deriving one from the other in two places is how you
 * end up with a menu item that 404s.
 *
 * The server is still the one that enforces this — it checks every request. The
 * store exists so the interface can avoid offering what would be refused, not
 * to decide anything.
 */
export const useAccessStore = defineStore("access", () => {
  const views = ref<AccessView[]>([])
  const permissions = ref<string[]>([])
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref<string | null>(null)

  /** 侧栏的树，直接由服务端给的视图列表构建。 */
  const navEntries = computed(() => navEntriesFrom(views.value))

  /** 能配成路由的：页面 + 有 path + 有组件名。菜单和按钮不算。 */
  const routableViews = computed(() =>
    views.value.filter(
      (view) =>
        view.type === VIEW_TYPE.VIEW &&
        view.path !== null &&
        view.componentName !== null &&
        view.path !== "" &&
        view.componentName !== "",
    ),
  )

  /**
   * 登录后该落到哪。
   *
   * 不是写死的 `/`：用户不一定有「总览」的权限，跳到一个不可达的地址会把
   * 登录成功变成一次 404。
   */
  const landingPath = computed(() => routableViews.value[0]?.path ?? null)

  async function load(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const { data, error: failure } = await api.auth.me.access.get()
      if (failure) throw failure
      views.value = data.views as AccessView[]
      permissions.value = data.permissions
      loaded.value = true
    } catch (cause) {
      error.value = describeApiError(cause)
      throw cause
    } finally {
      loading.value = false
    }
  }

  /** 登出、或者换个账号之前：把上一个用户的答案清干净。 */
  function reset(): void {
    views.value = []
    permissions.value = []
    loaded.value = false
    error.value = null
  }

  /**
   * 手里有没有某个权限点，用来决定按钮显不显示。
   *
   * **这不是安全边界** —— 服务端会独立校验同一个权限点，这里只是别把按不动
   * 的按钮摆出来。
   */
  function can(permission: string): boolean {
    return permissions.value.includes(permission)
  }

  return {
    views,
    permissions,
    loading,
    loaded,
    error,
    navEntries,
    routableViews,
    landingPath,
    load,
    reset,
    can,
  }
})
