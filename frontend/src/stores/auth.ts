import { computed, ref } from "vue"
import { defineStore } from "pinia"

import { readStorage, removeStorage, writeStorage } from "@/lib/storage"

/** 登录后服务端回的四个字段。`token` 是 JWT；口令哈希不在其中，也不该在。 */
export interface SessionUser {
  id: string
  name: string
  email: string
  token: string
}

const SESSION_KEY = "vat-session"

/**
 * Who is signed in.
 *
 * **This is not a permission check.** The session lives in `localStorage`,
 * which anyone can edit, and holding a token proves nothing until the backend
 * actually verifies it — which it does not yet (the guard exists but is not
 * mounted; see the backend auth module). Nothing in the app may treat
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
    const { id, name, email, token } = parsed as Record<string, unknown>
    if (
      typeof id !== "string" ||
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof token !== "string"
    ) {
      return null
    }
    return { id, name, email, token }
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
   * There is nothing to tell the server: no token was issued, so there is no
   * session to end. When tokens arrive this is where the revocation call
   * belongs.
   */
  function signOut() {
    user.value = null
    removeStorage(SESSION_KEY)
  }

  return { user, signedIn, signIn, signOut }
})
