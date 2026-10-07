import { Bell, Bot, Mail, Monitor, Moon, Sun, Type } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { ProfileType, User } from "@/api/types";
import { SourceStatusList } from "@/components/SourceStatus";
import { Badge, Button, Card, Field, Input, PageHeader, Skeleton, cx } from "@/components/ui";
import { useSettingsStatus, useUpdateMe } from "@/hooks/data";
import { usePrefs, type TextSize, type Theme } from "@/hooks/prefs";
import { PROFILE_LABELS } from "@/lib/format";

export default function SettingsPage({ user }: { user: User }) {
  const { prefs, setPrefs } = usePrefs();
  const status = useSettingsStatus();
  const updateMe = useUpdateMe();
  const [name, setName] = useState(user.display_name);
  const [perm, setPerm] = useState(typeof Notification !== "undefined" ? Notification.permission : "denied");

  const option = (active: boolean) =>
    cx("flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border-2 px-3 font-medium transition", active ? "border-accent-strong bg-accent/20" : "border-line bg-surface hover:border-ink/30");

  return (
    <div className="animate-fade-up">
      <PageHeader title="Réglages" subtitle="Affichage, profil et état des services." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card as="section" aria-labelledby="display-title">
          <h2 id="display-title" className="mb-4 text-2xl">
            Affichage
          </h2>
          <fieldset className="mb-5">
            <legend className="mb-2 flex items-center gap-2 font-medium">
              <Type className="h-4 w-4" aria-hidden /> Taille du texte
            </legend>
            <div className="flex gap-2">
              {(
                [
                  ["normal", "Normal", "text-base"],
                  ["large", "Grand", "text-lg"],
                  ["xlarge", "Très grand", "text-xl"],
                ] as [TextSize, string, string][]
              ).map(([v, label, cls]) => (
                <button key={v} className={cx(option(prefs.textSize === v), cls)} aria-pressed={prefs.textSize === v} onClick={() => setPrefs({ textSize: v })}>
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 font-medium">Thème</legend>
            <div className="flex gap-2">
              {(
                [
                  ["light", "Clair", Sun],
                  ["dark", "Sombre", Moon],
                  ["system", "Automatique", Monitor],
                ] as [Theme, string, typeof Sun][]
              ).map(([v, label, Icon]) => (
                <button key={v} className={option(prefs.theme === v)} aria-pressed={prefs.theme === v} onClick={() => setPrefs({ theme: v })}>
                  <Icon className="h-4 w-4" aria-hidden /> {label}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="mt-5 flex items-start justify-between gap-4 border-t border-line/70 pt-5">
            <div>
              <p className="flex items-center gap-2 font-medium">
                <Bell className="h-4 w-4" aria-hidden /> Notifications du navigateur
              </p>
              <p className="text-sm text-muted">Pour être prévenu(e) des nouvelles offres même quand l'onglet est en arrière-plan.</p>
            </div>
            {perm === "granted" ? (
              <Badge tone="success">Activées</Badge>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                disabled={perm === "denied" || typeof Notification === "undefined"}
                onClick={async () => setPerm(await Notification.requestPermission())}
              >
                {perm === "denied" ? "Bloquées par le navigateur" : "Activer"}
              </Button>
            )}
          </div>
        </Card>

        <Card as="section" aria-labelledby="profile-title">
          <h2 id="profile-title" className="mb-4 text-2xl">
            Mon profil
          </h2>
          <form
            className="mb-5 flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              updateMe.mutate({ display_name: name }, { onSuccess: () => toast.success("Prénom enregistré") });
            }}
          >
            <div className="flex-1">
              <Field label="Prénom">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
            </div>
            <Button type="submit" variant="secondary" disabled={!name.trim() || name === user.display_name}>
              Enregistrer
            </Button>
          </form>
          <p className="mb-2 font-medium">Situation</p>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Situation">
            {(Object.keys(PROFILE_LABELS) as ProfileType[]).map((k) => (
              <button
                key={k}
                role="radio"
                aria-checked={user.profile_type === k}
                onClick={() => updateMe.mutate({ profile_type: k }, { onSuccess: () => toast.success("Profil mis à jour") })}
                className={cx("rounded-xl border-2 p-3 text-left transition", user.profile_type === k ? "border-accent-strong bg-accent/15" : "border-line hover:border-ink/30")}
              >
                <span className="block font-medium">{PROFILE_LABELS[k].title}</span>
                <span className="text-sm text-muted">{PROFILE_LABELS[k].hint}</span>
              </button>
            ))}
          </div>
        </Card>

        <Card as="section" aria-labelledby="sources-title">
          <h2 id="sources-title" className="mb-1 text-2xl">
            Sources d'offres
          </h2>
          <p className="mb-4 text-sm text-muted">
            Les clés se règlent dans le fichier <code className="rounded bg-sand px-1">.env</code> (voir le README), puis relancez FormyWork.
            {status.data && ` Mise à jour automatique toutes les ${status.data.refresh_api_minutes} min (APIs) et toutes les ${status.data.refresh_scraping_hours} h (pages publiques).`}
          </p>
          <SourceStatusList />
        </Card>

        <Card as="section" aria-labelledby="services-title">
          <h2 id="services-title" className="mb-4 text-2xl">
            Services
          </h2>
          {status.isLoading && <Skeleton className="h-32" />}
          {status.data && (
            <ul className="flex flex-col gap-4">
              <li className="flex gap-3">
                <Bot className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
                <div>
                  <p className="font-medium">
                    Intelligence artificielle (Anthropic) {status.data.ai.enabled ? <Badge tone="success">Active</Badge> : <Badge>Non configurée</Badge>}
                  </p>
                  <p className="text-sm text-muted">
                    {status.data.ai.enabled
                      ? `Résumés : ${status.data.ai.model_summary} · CV et lettres : ${status.data.ai.model_cv}. Les résumés sont mis en cache pour ne jamais payer deux fois.`
                      : "Sans clé, FormyWork utilise des résumés simples et réorganise votre CV sans réécriture. Ajoutez ANTHROPIC_API_KEY dans .env pour l'activer."}
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <Mail className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
                <div>
                  <p className="font-medium">
                    Envoi des candidatures par e-mail{" "}
                    <Badge tone={status.data.mail.mode === "smtp" ? "success" : status.data.mail.mode === "simulation" ? "warning" : "neutral"}>
                      {status.data.mail.mode === "smtp" ? "Configuré" : status.data.mail.mode === "simulation" ? "Simulation" : "Non configuré"}
                    </Badge>
                  </p>
                  <p className="text-sm text-muted">{status.data.mail.label}. Aucun e-mail ne part jamais sans votre confirmation.</p>
                </div>
              </li>
              {status.data.demo_mode && (
                <li className="rounded-xl bg-accent/15 p-3 text-sm">
                  <strong>Mode démo actif :</strong> des offres d'exemple sont affichées et une nouvelle offre « arrive » toutes les quelques minutes. Mettez DEMO_MODE=false dans .env quand vos clés sont prêtes.
                </li>
              )}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
