/// <reference types="node" />
import assert from "node:assert/strict"
import { api, upload } from "./api.ts"
import { installCommand, registerCommand } from "./commands.ts"
import { basePath, siteURL, socketURL, stripBase, withBase } from "./base.ts"

for (const [uri, base] of [
  ["https://example.com/admin/", ""],
  ["https://example.com/monitor/admin/", "/monitor"],
  ["https://example.com/a/b/admin/", "/a/b"],
  ["https://example.com/admin/admin/", "/admin"],
  ["https://example.com/%E7%9B%91%E6%8E%A7/admin/", "/%E7%9B%91%E6%8E%A7"],
]) {
  assert.equal(basePath(uri), base)
  Object.assign(globalThis, {
    document: { baseURI: uri, querySelector: () => ({}) },
    location: { origin: "https://example.com" },
  })
  assert.equal(withBase("/admin/nodes"), base + "/admin/nodes")
  assert.equal(stripBase(base + "/admin/nodes"), "/admin/nodes")
  assert.equal(withBase("/api/db/backup"), base + "/api/db/backup")
  assert.equal(siteURL(), "https://example.com" + base)
  assert.equal(socketURL(), "wss://example.com" + base + "/api/ws")
  const sent: string[] = []
  Object.assign(globalThis, {
    fetch: async (url: string) => {
      sent.push(url)
      return Response.json({ ok: true })
    },
  })
  await api("/settings")
  await upload("/db/restore", new File(["backup"], "monitor.db"))
  assert.deepEqual(sent, [base + "/api/settings", base + "/api/db/restore?offset=0&total=6"])
}
assert.equal(stripBase("/monitoring/admin", "/monitor"), "/monitoring/admin")
// Vite dev has no injected base; the current deep route is not a prefix.
Object.assign(globalThis, {
  document: { baseURI: "http://localhost:5173/admin/nodes", querySelector: () => null },
  location: { origin: "http://localhost:5173" },
})
assert.equal(withBase("/api/me"), "/api/me")
assert.equal(socketURL(), "ws://localhost:5173/api/ws")
console.log("root, nested subpath, encoded path and dev URL checks passed")

assert.equal(installCommand("https://example.com/a/b", "token", undefined, undefined),
  "curl -fsSL 'https://example.com/a/b/install.sh' | sh -s -- --server 'https://example.com/a/b' --token token")
assert.ok(registerCommand("https://example.com/a'b/$path", "key", 10, "eth0").includes("--server 'https://example.com/a'\"'\"'b/$path'"))
