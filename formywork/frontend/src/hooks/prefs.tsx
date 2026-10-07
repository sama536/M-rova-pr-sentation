import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "light" | "dark" | "system";
export type TextSize = "normal" | "large" | "xlarge";
interface Prefs {
  theme: Theme;
  textSize: TextSize;
}

const KEY = "fw-prefs";
const Ctx = createContext<{ prefs: Prefs; setPrefs: (p: Partial<Prefs>) => void; dark: boolean } | null>(null);

function load(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
    return { theme: raw.theme ?? "system", textSize: raw.textSize ?? "normal" };
  } catch {
    return { theme: "system", textSize: "normal" };
  }
}

function systemDark() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setState] = useState<Prefs>(load);
  const [sysDark, setSysDark] = useState(systemDark);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const on = () => setSysDark(mq.matches);
    mq?.addEventListener("change", on);
    return () => mq?.removeEventListener("change", on);
  }, []);

  const dark = prefs.theme === "dark" || (prefs.theme === "system" && sysDark);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.dataset.textSize = prefs.textSize;
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      /* stockage indisponible : réglage gardé pour la session */
    }
  }, [dark, prefs]);

  const setPrefs = useCallback((p: Partial<Prefs>) => setState((old) => ({ ...old, ...p })), []);
  return <Ctx.Provider value={{ prefs, setPrefs, dark }}>{children}</Ctx.Provider>;
}

export function usePrefs() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("PrefsProvider manquant");
  return ctx;
}
