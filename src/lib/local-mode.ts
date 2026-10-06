const LOCAL_USER_KEY = "jarvis-local-user";

export function isLocalMode(): boolean {
  if (typeof import.meta !== "undefined" && import.meta.env?.DEV) return true;
  if (typeof window === "undefined") return false;
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
}

export function getLocalUser(): { name: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(LOCAL_USER_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as { name?: unknown };
    return typeof parsed.name === "string" && parsed.name.trim() ? { name: parsed.name.trim() } : null;
  } catch {
    return null;
  }
}

export function setLocalUser(name: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_USER_KEY, JSON.stringify({ name: name.trim() }));
}

export function clearLocalUser(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LOCAL_USER_KEY);
}
