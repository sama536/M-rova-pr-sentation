import { CheckCircle2, CircleDashed, PauseCircle, XCircle } from "lucide-react";

import { useSources } from "@/hooks/data";
import { relativeTime } from "@/lib/format";
import { Skeleton, cx } from "./ui";

/** Liste des sources : configurée ou non, dernière mise à jour réussie, dernière erreur. */
export function SourceStatusList({ compact }: { compact?: boolean }) {
  const { data, isLoading, isError } = useSources();
  if (isLoading) return <Skeleton className="h-24" />;
  if (isError || !data) return <p className="text-danger">État des sources indisponible.</p>;
  const visible = compact ? data.filter((s) => s.configured) : data;
  if (visible.length === 0) return <p className="text-muted">Aucune source configurée. Voir Réglages.</p>;
  return (
    <ul className="flex flex-col gap-2.5">
      {visible.map((s) => {
        const blocked = s.blocked_until && new Date(`${s.blocked_until}Z`) > new Date();
        const state = !s.configured ? "off" : blocked ? "paused" : s.last_error && (!s.last_success_at || s.last_error_at! > s.last_success_at) ? "error" : s.last_success_at ? "ok" : "idle";
        const Icon = { ok: CheckCircle2, error: XCircle, paused: PauseCircle, off: CircleDashed, idle: CircleDashed }[state];
        return (
          <li key={s.name} className="flex items-start gap-2.5">
            <Icon
              className={cx("mt-0.5 h-5 w-5 shrink-0", state === "ok" && "text-success", state === "error" && "text-danger", state === "paused" && "text-warning", (state === "off" || state === "idle") && "text-muted")}
              aria-hidden
            />
            <div className="min-w-0 text-[0.95rem]">
              <p className="font-medium">
                {s.label}
                <span className="sr-only"> : {state === "ok" ? "fonctionne" : state === "error" ? "en erreur" : state === "paused" ? "en pause" : state === "off" ? "non configurée" : "pas encore utilisée"}</span>
              </p>
              <p className="text-sm text-muted">
                {state === "off" && (s.kind === "scraping" ? "Désactivée (Réglages → pages publiques)" : "Clé API à ajouter dans le fichier .env")}
                {state === "idle" && "Prête, pas encore interrogée"}
                {state === "ok" && `Mise à jour ${relativeTime(s.last_success_at)} · ${s.last_count} offre${s.last_count > 1 ? "s" : ""}`}
                {state === "error" && (s.last_error ?? "Erreur")}
                {state === "paused" && `En pause : ${s.last_error ?? "trop de requêtes"}`}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
