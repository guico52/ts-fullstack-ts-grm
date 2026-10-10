type SessionEvent = "expired" | "password-required"
let handler: ((event: SessionEvent) => void) | undefined
export function onSessionEvent(next: (event: SessionEvent) => void): void {
  handler = next
}
export function emitSessionEvent(event: SessionEvent): void {
  handler?.(event)
}
