/// <reference types="node" />
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { transformWithOxc } from "vite"
import vm from "node:vm"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

// Compile the actual component with inert visual wrappers, not a duplicate of its logic.
const source = readFileSync(new URL("./Login.tsx", import.meta.url), "utf8")
const transformed = await transformWithOxc(source, "Login.tsx", { jsx: { runtime: "automatic" } })
const compiled = transformed.code
  .replace(/import \{([^}]+)\} from "([^"]+)";/g, (_, bindings: string, name: string) =>
    `const {${bindings.replace(/\bas\b/g, ":")}} = require(${JSON.stringify(name)});`)
  .replace("export function Login", "exports.Login = function Login")
const React = await import("react")
const jsx = await import("react/jsx-runtime")
const wrappers = new Proxy({}, { get: (_, name) => name === "Input"
  ? (props: React.InputHTMLAttributes<HTMLInputElement>) => createElement("input", props)
  : (props: { children?: React.ReactNode }) => createElement("div", null, props.children) })
const exports: { Login?: React.ComponentType<{ github: boolean; passwordLogin: boolean; onDone: () => void }> } = {}
vm.runInNewContext(compiled, {
  exports,
  require: (name: string) => name === "react" ? React : name === "react/jsx-runtime" ? jsx
    : name === "@/lib/base" ? { withBase: (path: string) => path } : wrappers,
  URLSearchParams,
  location: { search: "" },
})
assert.ok(exports.Login)
const render = (passwordLogin: boolean) => renderToStaticMarkup(createElement(exports.Login!, { github: true, passwordLogin, onDone: () => {} }))
const sso = render(false)
assert.match(sso, /使用 GitHub 登录/)
assert.doesNotMatch(sso, /应急密码|type="password"|已禁用|单点登录/)
assert.equal((sso.match(/<p\b/g) ?? []).length, 0)
assert.match(render(true), /type="password"/)
console.log("SSO-only login has a GitHub entry without password fields or a footer hint")
