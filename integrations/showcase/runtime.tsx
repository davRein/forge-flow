"use client";
import { useSyncExternalStore, type ReactNode } from "react";

export function createRuntime(origin: string | undefined) {
  type Mode = "pending" | "standalone" | "suite" | "demo";
  let chosen: Mode | undefined;
  const listeners = new Set<() => void>();
  const current = (): Mode => chosen ?? (
    typeof window === "undefined" || (origin && window.parent !== window)
      ? "pending" : "standalone"
  );
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  };
  const useMode = () => useSyncExternalStore(subscribe, current, () => "pending" as Mode);
  // Only the origin/source-checked bridge may call this. This selects transport, never identity.
  const accept = (mode: unknown) => {
    if (mode !== "suite" && mode !== "demo") return false;
    if (chosen && chosen !== mode) { window.location.reload(); return false; }
    chosen = mode;
    listeners.forEach(listener => listener());
    return true;
  };
  const headers = (): Record<string, string> => current() === "suite"
    ? { "X-ForgeFlow-Mode": "suite" } : {};
  function Boundary({ children }: { children: ReactNode }) {
    const mode = useMode();
    if (mode === "pending") return <p role="status">…</p>;
    return children;
  }
  return { current, useMode, accept, headers, Boundary };
}
