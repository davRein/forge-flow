from apply_sso import ROOT, HUB, FLOW, edit
import shutil


def main() -> None:
    for target in [HUB / "frontend/lib/suite-runtime.tsx", FLOW / "frontend/src/suiteRuntime.tsx"]:
        shutil.copyfile(ROOT / "integrations/showcase/runtime.tsx", target)
    (HUB / "frontend/lib/runtime.ts").write_text(
        '"use client";\nimport { createRuntime } from "./suite-runtime";\n'
        'export const runtime = createRuntime(process.env.NEXT_PUBLIC_SUITE_ORIGIN);\n', encoding="utf-8")
    (FLOW / "frontend/src/runtime.ts").write_text(
        'import { createRuntime } from "./suiteRuntime";\n'
        'export const runtime = createRuntime(import.meta.env.VITE_SUITE_ORIGIN);\n', encoding="utf-8")
    (HUB / "frontend/components/runtime-boundary.tsx").write_text(
        '"use client";\nimport { runtime } from "../lib/runtime";\n'
        'export const RuntimeBoundary = runtime.Boundary;\n', encoding="utf-8")
    edit(HUB / "frontend/app/layout.tsx", 'import { SuiteBridge }', 'import { RuntimeBoundary } from "../components/runtime-boundary";\nimport { SuiteBridge }')
    edit(HUB / "frontend/app/layout.tsx", '<WorkspaceShell>{children}</WorkspaceShell>', '<RuntimeBoundary><WorkspaceShell>{children}</WorkspaceShell></RuntimeBoundary>')
    edit(FLOW / "frontend/src/main.tsx", "import { StrictMode }", "import { runtime } from './runtime';\nimport { StrictMode }")
    edit(FLOW / "frontend/src/main.tsx", '    <App />', '    <runtime.Boundary><App /></runtime.Boundary>')
    for file, imported in [(HUB / "frontend/components/suite-bridge.tsx", '../lib/runtime'), (FLOW / "frontend/src/suiteBridge.ts", './runtime')]:
        edit(file, 'import { setLanguage }', f'import {{ runtime }} from "{imported}";\nimport {{ setLanguage }}')
        marker = '        connected.current = true;' if 'tsx' == file.suffix[1:] else '      connected = true;'
        # Select the API mode before mounting anything that can request private data.
        edit(file, marker, marker.replace('connected.current = true;', 'if (!runtime.accept(event.data.authMode)) return;\n        connected.current = true;').replace('connected = true;', 'if (!runtime.accept(event.data.authMode)) return;\n      connected = true;'))
    api = HUB / "frontend/lib/api.ts"
    edit(api, 'export const apiUrl = (', 'import { runtime } from "./runtime";\n\nexport const apiUrl = () => (\n  runtime.current() === "suite" ? (process.env.NEXT_PUBLIC_SUITE_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") : (')
    edit(api, ').replace(/\\/$/, "");', ')).replace(/\\/$/, "");')
    # apiUrl must be selected at request time, after the trusted handshake.
    for path in (HUB / "frontend").rglob("*.ts*"):
        if any(part in {"node_modules", ".next"} for part in path.parts):
            continue
        source = path.read_text(encoding="utf-8")
        updated = source.replace('${apiUrl}', '${apiUrl()}')
        if updated != source:
            path.write_text(updated, encoding="utf-8", newline="\n")
    edit(api, '    cache: "no-store",', '    cache: "no-store",\n    credentials: "include",\n    headers: runtime.headers(),')
    auth = HUB / "frontend/lib/auth.ts"
    edit(auth, 'import { apiUrl }', 'import { runtime } from "./runtime";\nimport { apiUrl }')
    edit(auth, 'export type SessionInfo = {', 'export type SessionInfo = {\n  auth_source?: "standalone" | "suite";')
    edit(auth, '  const headers = new Headers(init.headers);', '  const headers = new Headers(init.headers);\n  Object.entries(runtime.headers()).forEach(([key, value]) => headers.set(key, value));')
    provider = HUB / "frontend/components/auth-provider.tsx"
    edit(provider, 'import { LanguagePicker }', 'import { runtime } from "../lib/runtime";\nimport { LanguagePicker }')
    edit(provider, '  const pathname = usePathname();', '  const mode = runtime.useMode();\n  const pathname = usePathname();')
    edit(provider, '    const controller = new AbortController();', '    setSession(null);\n    updateState(null);\n    const controller = new AbortController();')
    edit(provider, 'new BroadcastChannel("aihub-auth")', 'new BroadcastChannel("aihub-auth-" + mode)')
    edit(provider, '  }, [attempt]);', '  }, [attempt, mode]);')
    edit(provider, '        <SignIn registration={session.registration_enabled} update={update} />', '        mode === "suite" ? <p role="alert">{tx("Sign in to Dev Suite again.")}</p> : <SignIn registration={session.registration_enabled} update={update} />')
    shell = HUB / "frontend/components/workspace-shell.tsx"
    edit(shell, '        {privateWorkspace && (\n          <div className="account-summary">', '        {privateWorkspace && auth?.session?.auth_source !== "suite" && (\n          <div className="account-summary">')
    panel = HUB / "frontend/components/account-panel.tsx"
    edit(panel, '      <h2>{tx("Change password")}</h2>', '      {auth.session?.auth_source === "suite" ? <p>{tx("Manage your login in Dev Suite account settings.")}</p> : <>\n      <h2>{tx("Change password")}</h2>')
    edit(panel, '      {message && <p role="status">', '      </>}\n      {message && <p role="status">')
    prefix = FLOW / "frontend/src/apiPrefix.ts"
    edit(prefix, 'export function apiPath(', 'import { runtime } from "./runtime";\nexport function apiPath(')
    edit(prefix, "prefix = import.meta.env.VITE_API_PREFIX ?? '',", "prefix = (runtime.current() === 'suite' ? import.meta.env.VITE_SUITE_API_PREFIX : undefined) ?? import.meta.env.VITE_API_PREFIX ?? '',")
    for path, imp in [(FLOW / "frontend/src/api.ts", './runtime'), (FLOW / "frontend/src/workflows/client.ts", '../runtime')]:
        edit(path, 'import { apiPath }', f'import {{ runtime }} from "{imp}";\nimport {{ apiPath }}')
    api = FLOW / "frontend/src/api.ts"
    edit(api, '{ signal }', '{ signal, credentials: "include", headers: runtime.headers() }')
    edit(FLOW / "frontend/src/workflows/client.ts", '      method,', '      method,\n      credentials: "include",')
    edit(FLOW / "frontend/src/workflows/client.ts", '        ...extraHeaders,', '        ...extraHeaders,\n        ...runtime.headers(),')


if __name__ == "__main__":
    main()
