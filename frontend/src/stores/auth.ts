import { computed, ref } from "vue"
import { defineStore } from "pinia"

import { readStorage, removeStorage, writeStorage } from "@/lib/storage"

/** 登录后服务端回的身份、改密状态与 token。`token` 是 JWT；口令哈希不在其中，也不该在。 */
export interface SessionUser {
  id: string
  name: string
  email: string
  token: string
  mustChangePassword?: boolean
}

const SESSION_KEY = "vat-session"

/**
 * Who is signed in.
 *
 * **This is not a permission check.** The session lives in `localStorage`,
 * which anyone can edit, and holding a token proves nothing until the backend
 * actually verifies it. The backend verifies JWT and checks current permissions
 * for every business request. Nothing in the app may treat
 * `signedIn` as proof of anything.
 */
function readSession(): SessionUser | null {
  const raw = readStorage(SESSION_KEY)
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null) return null
    // Shape-check every field: a value in storage may have been written by an
    // older build, hand-edited, or truncated. A half-valid session is worse
    // than none, because the header would render it.
    if (!("id" in parsed) || !("name" in parsed) || !("email" in parsed) || !("token" in parsed))
      return null
    const { id, name, email, token } = parsed
    const mustChangePassword = "mustChangePassword" in parsed && parsed.mustChangePassword === true
    if (
      typeof id !== "string" ||
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof token !== "string"
    ) {
      return null
    }
    return { id, name, email, token, mustChangePassword: mustChangePassword === true }
  } catch {
    return null
  }
}

export const useAuthStore = defineStore("auth", () => {
  const user = ref<SessionUser | null>(readSession())
  const signedIn = computed(() => user.value !== null)

  function signIn(next: SessionUser) {
    user.value = next
    writeStorage(SESSION_KEY, JSON.stringify(next))
  }

  /**
   * Forget the session locally.
   *
   * JWT is stateless: clearing local storage does not revoke an already copied
   * token. Password changes revoke it through tokenVersion; permissions are checked on every request.
   */
  function signOut() {
    user.value = null
    removeStorage(SESSION_KEY)
  }

  return { user, signedIn, signIn, signOut }
})
