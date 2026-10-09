/**
 * localStorage access that cannot take a feature down.
 *
 * Reads and writes are wrapped because storage throws in private mode and
 * when cookies are blocked — and a preference that fails to save should
 * still apply for the session, not surface as a crash in a toggle.
 */

export function readStorage(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null
  } catch {
    return null
  }
}

export function writeStorage(key: string, value: string) {
  try {
    globalThis.localStorage?.setItem(key, value)
  } catch {
    // The choice still applies for this session.
  }
}

/** 登出用。与写入同理：清不掉也不该把页面弄崩。 */
export function removeStorage(key: string) {
  try {
    globalThis.localStorage?.removeItem(key)
  } catch {
    // Nothing to do — the in-memory state is already cleared.
  }
}

export function readFlag(key: string, fallback = false): boolean {
  const raw = readStorage(key)
  if (raw === null) return fallback
  return raw === "1" || raw === "true"
}

export function writeFlag(key: string, value: boolean) {
  writeStorage(key, value ? "1" : "0")
}

/**
 * A string array, or an empty one.
 *
 * Tolerant on purpose: a value written by an older build, hand-edited, or
 * truncated by a full disk should cost the user their preference, not the
 * page. Anything that is not an array of strings is discarded silently.
 */
export function readStringArray(key: string): string[] {
  const raw = readStorage(key)
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((value): value is string => typeof value === "string")
  } catch {
    return []
  }
}

export function writeStringArray(key: string, value: readonly string[]) {
  writeStorage(key, JSON.stringify(value))
}
