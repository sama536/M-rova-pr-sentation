import { Command } from "cmdk";
import { Briefcase, FileText, Home, KanbanSquare, LogOut, Moon, Search, Settings, Sun } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import type { User } from "@/api/types";
import { useDashboard, useResumes, useSearches } from "@/hooks/data";
import { usePrefs } from "@/hooks/prefs";
import { cx } from "./ui";

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  const { dark } = usePrefs();
  return (
    <span className={cx("inline-flex items-center gap-2.5", className)}>
      <img src={dark ? "/logo-mark-dark.svg" : "/logo-mark.svg"} alt="" className="h-9 w-9" />
      {!compact && (
        <span className="font-display text-[1.45rem] font-semibold tracking-tight">
          Formy<span className="text-accent-strong dark:text-accent">Work</span>
        </span>
      )}
      <span className="sr-only">FormyWork</span>
    </span>
  );
}

const NAV = [
  { to: "/", label: "Accueil", icon: Home, end: true },
  { to: "/offres", label: "Offres", icon: Briefcase },
  { to: "/candidatures", label: "Candidatures", icon: KanbanSquare },
  { to: "/cv", label: "Mes CV", icon: FileText },
  { to: "/reglages", label: "Réglages", icon: Settings },
];

export function Layout({ user, children }: { user: User; children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { prefs, setPrefs, dark } = usePrefs();
  const dash = useDashboard();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if (e.key === "/" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const logout = async () => {
    await api.post("/api/auth/logout");
    qc.clear();
    navigate("/connexion");
  };

  const followUps = dash.data?.follow_ups.length ?? 0;
  const newOffers = dash.data?.new_offers_total ?? 0;
  const badge = (to: string) => (to === "/offres" ? newOffers : to === "/candidatures" ? followUps : 0);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[17rem_1fr]">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-surface focus:p-3">
        Aller au contenu
      </a>

      {/* Barre latérale (ordinateur) */}
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-line/70 bg-sand/45 px-4 py-6 lg:flex">
        <NavLink to="/" className="mb-8 px-2" aria-label="FormyWork, accueil">
          <Logo />
        </NavLink>
        <button
          onClick={() => setPaletteOpen(true)}
          className="mb-5 flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-left text-muted transition hover:border-ink/30"
        >
          <Search className="h-4 w-4" aria-hidden />
          <span className="flex-1">Rechercher…</span>
          <kbd className="rounded-md border border-line px-1.5 text-xs">Ctrl K</kbd>
        </button>
        <nav aria-label="Navigation principale" className="flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cx(
                  "group flex min-h-12 items-center gap-3 rounded-xl px-3 text-[1.02rem] transition-colors",
                  isActive ? "bg-surface font-semibold shadow-soft" : "text-ink/85 hover:bg-surface/70",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className={cx("grid h-8 w-8 place-items-center rounded-lg transition-colors", isActive ? "bg-accent text-on-accent" : "text-ink/70 group-hover:text-ink")}>
                    <Icon className="h-[1.15rem] w-[1.15rem]" strokeWidth={1.75} aria-hidden />
                  </span>
                  <span className="flex-1">{label}</span>
                  {badge(to) > 0 && (
                    <span className="tabular rounded-full bg-accent px-2 text-sm font-semibold text-on-accent" aria-label={`${badge(to)} à voir`}>
                      {badge(to)}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-2 border-t border-line/70 pt-4">
          <button
            onClick={() => setPrefs({ theme: dark ? "light" : "dark" })}
            className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-ink/85 hover:bg-surface/70"
            aria-label={dark ? "Passer en thème clair" : "Passer en thème sombre"}
          >
            {dark ? <Sun className="h-5 w-5" strokeWidth={1.75} /> : <Moon className="h-5 w-5" strokeWidth={1.75} />}
            {dark ? "Thème clair" : "Thème sombre"}
          </button>
          <div className="flex items-center gap-3 rounded-xl px-3 py-2">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-primary font-semibold text-on-primary" aria-hidden>
              {user.display_name.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{user.display_name}</p>
              <p className="truncate text-sm text-muted">{user.email}</p>
            </div>
            <button onClick={logout} className="rounded-lg p-2 text-muted hover:bg-surface hover:text-ink" aria-label="Se déconnecter">
              <LogOut className="h-5 w-5" strokeWidth={1.75} />
            </button>
          </div>
          <p className="px-3 text-xs text-muted">Texte : {prefs.textSize === "normal" ? "normal" : prefs.textSize === "large" ? "grand" : "très grand"}</p>
        </div>
      </aside>

      {/* En-tête (mobile et tablette) */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line/70 bg-bg/90 px-4 py-3 backdrop-blur lg:hidden">
        <NavLink to="/" aria-label="FormyWork, accueil">
          <Logo />
        </NavLink>
        <div className="flex items-center gap-1">
          <button onClick={() => setPaletteOpen(true)} className="rounded-xl p-2.5 hover:bg-sand" aria-label="Rechercher">
            <Search className="h-5 w-5" />
          </button>
          <button onClick={() => setPrefs({ theme: dark ? "light" : "dark" })} className="rounded-xl p-2.5 hover:bg-sand" aria-label="Changer de thème">
            {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>
      </header>

      <main id="contenu" className="mx-auto w-full max-w-[90rem] px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">
        {children}
      </main>

      {/* Navigation basse (mobile) */}
      <nav aria-label="Navigation principale" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => cx("relative flex min-h-16 flex-col items-center justify-center gap-0.5 text-[0.72rem]", isActive ? "font-semibold text-ink" : "text-muted")}
          >
            {({ isActive }) => (
              <>
                <span className={cx("grid h-8 w-12 place-items-center rounded-full transition-colors", isActive && "bg-accent text-on-accent")}>
                  <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                </span>
                {label}
                {badge(to) > 0 && <span className="absolute right-[22%] top-1.5 h-2.5 w-2.5 rounded-full bg-accent-strong" aria-hidden />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}

function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const searches = useSearches();
  const resumes = useResumes();
  const [value, setValue] = useState("");
  const go = (to: string) => {
    onOpenChange(false);
    setValue("");
    navigate(to);
  };
  const item = "flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 aria-selected:bg-sand";
  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Recherche rapide"
      className="fixed left-1/2 top-[12vh] z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-line bg-bg shadow-lift"
      overlayClassName="fixed inset-0 z-40 bg-[#0b1426]/40"
    >
      <div className="flex items-center gap-3 border-b border-line px-4">
        <Search className="h-5 w-5 text-muted" aria-hidden />
        <Command.Input value={value} onValueChange={setValue} placeholder="Chercher une page, une offre, un CV…" className="min-h-14 flex-1 bg-transparent text-lg outline-none placeholder:text-muted" />
      </div>
      <Command.List className="max-h-[55vh] overflow-y-auto p-2 scroll-thin">
        <Command.Empty className="p-4 text-muted">Aucun résultat.</Command.Empty>
        <Command.Group heading="Pages" className="px-1 text-sm text-muted">
          {NAV.map((n) => (
            <Command.Item key={n.to} value={n.label} onSelect={() => go(n.to)} className={cx(item, "text-ink")}>
              <n.icon className="h-4 w-4" /> {n.label}
            </Command.Item>
          ))}
        </Command.Group>
        {!!searches.data?.length && (
          <Command.Group heading="Recherches enregistrées" className="px-1 text-sm text-muted">
            {searches.data.map((s) => (
              <Command.Item key={s.id} value={`recherche ${s.name}`} onSelect={() => go(`/offres?recherche=${s.id}`)} className={cx(item, "text-ink")}>
                <Search className="h-4 w-4" /> {s.name}
              </Command.Item>
            ))}
          </Command.Group>
        )}
        {!!resumes.data?.length && (
          <Command.Group heading="Mes CV" className="px-1 text-sm text-muted">
            {resumes.data.map((r) => (
              <Command.Item key={r.id} value={`cv ${r.name}`} onSelect={() => go(`/cv/${r.id}`)} className={cx(item, "text-ink")}>
                <FileText className="h-4 w-4" /> {r.name}
              </Command.Item>
            ))}
          </Command.Group>
        )}
        {value.trim().length > 1 && (
          <Command.Group heading="Offres" className="px-1 text-sm text-muted">
            <Command.Item forceMount value="~recherche-offres" onSelect={() => go(`/offres?q=${encodeURIComponent(value.trim())}`)} className={item}>
              <Briefcase className="h-4 w-4" /> Chercher « {value.trim()} » dans les offres
            </Command.Item>
          </Command.Group>
        )}
      </Command.List>
    </Command.Dialog>
  );
}
