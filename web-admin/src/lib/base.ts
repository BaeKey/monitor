/** The hub injects a base pointing at <site>/admin/ before the built assets.
 * Without it (Vite dev), the admin is mounted at the root path /admin/. */
export function basePath(baseURI: string): string {
  const path = new URL(baseURI).pathname.replace(/\/$/, "")
  return path.endsWith("/admin") ? path.slice(0, -6) : ""
}

function currentBase(): string {
  if (typeof document === "undefined") return ""
  const base = document.querySelector("base[href]")
  return base ? basePath(document.baseURI) : ""
}

export function withBase(path: string): string {
  return currentBase() + path
}

export function stripBase(path: string, base = currentBase()): string {
  return base && (path === base || path.startsWith(base + "/")) ? path.slice(base.length) || "/" : path
}

export function siteURL(): string {
  return location.origin + withBase("")
}

export function socketURL(): string {
  const url = new URL(withBase("/api/ws"), location.origin)
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
  return url.href
}
