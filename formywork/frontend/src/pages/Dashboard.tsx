import { ArrowRight, BellRing, Briefcase, CalendarClock, FileText, Send, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

import type { User } from "@/api/types";
import { Badge, Button, Card, EmptyState, ErrorState, ScoreRing, Skeleton } from "@/components/ui";
import { SourceStatusList } from "@/components/SourceStatus";
import { useDashboard } from "@/hooks/data";
import { CONTRACT_LABELS, formatDate, greeting, relativeTime } from "@/lib/format";

export default function DashboardPage({ user }: { user: User }) {
  const { data, isLoading, isError, error, refetch } = useDashboard();
  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="animate-fade-up">
      <header className="mb-8">
        <p className="text-muted first-letter:uppercase">{today}</p>
        <h1 className="mt-1 text-4xl sm:text-5xl">
          {greeting()} {user.display_name}
        </h1>
      </header>

      {isError && <ErrorState message={(error as Error).message} onRetry={() => refetch()} />}

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-3 gap-3 sm:gap-4 xl:grid-cols-4">
            <Stat icon={<Sparkles className="h-5 w-5" />} label="Nouvelles offres" value={data.new_offers_total} to="/offres?vue=new" highlight={data.new_offers_total > 0} />
            <Stat icon={<Send className="h-5 w-5" />} label="En cours" value={data.counts.postule + data.counts.relance + data.counts.entretien} to="/candidatures" />
            <Stat icon={<BellRing className="h-5 w-5" />} label="Relances" value={data.follow_ups.length} to="/candidatures" highlight={data.follow_ups.length > 0} />
            <Card className="col-span-3 flex items-center gap-4 xl:col-span-1">
              {data.resume ? (
                <>
                  <ScoreRing score={data.resume.score} size={76} />
                  <div className="min-w-0">
                    <p className="text-muted">Score ATS</p>
                    <Link to={`/cv/${data.resume.id}`} className="font-medium underline decoration-accent decoration-2 underline-offset-4">
                      Améliorer mon CV
                    </Link>
                  </div>
                </>
              ) : (
                <div>
                  <p className="text-muted">Pas encore de CV</p>
                  <Link to="/cv" className="font-medium underline decoration-accent decoration-2 underline-offset-4">
                    Ajouter mon CV
                  </Link>
                </div>
              )}
            </Card>
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
            <Card as="section" aria-labelledby="new-offers-title">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 id="new-offers-title" className="text-2xl">
                  Nouvelles offres pour vous
                </h2>
                <Link to="/offres" className="inline-flex items-center gap-1 text-sm font-medium hover:underline">
                  Toutes les offres <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              {data.new_offers.length === 0 ? (
                <EmptyState icon={<Briefcase className="h-6 w-6" />} title="Rien de nouveau pour l'instant">
                  Vos recherches enregistrées sont vérifiées automatiquement. Les nouvelles offres apparaîtront ici.
                </EmptyState>
              ) : (
                <ul className="divide-y divide-line/70">
                  {data.new_offers.map((o) => (
                    <li key={o.id}>
                      <Link to={`/offres?offre=${o.id}`} className="-mx-2 flex items-start gap-3 rounded-xl px-2 py-3 transition hover:bg-sand/50">
                        <span className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sand font-display font-semibold">
                          {(o.company ?? o.title).slice(0, 1)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">{o.title}</span>
                            <Badge tone="new">Nouveau</Badge>
                          </span>
                          <span className="block text-muted">
                            {[o.company, o.location, CONTRACT_LABELS[o.contract_type]].filter(Boolean).join(" · ")}
                          </span>
                          {o.summary?.[0] && <span className="mt-1 block text-sm text-ink/80">{o.summary[0]}</span>}
                        </span>
                        <span className="hidden shrink-0 text-sm text-muted sm:block">{relativeTime(o.first_seen_at)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <div className="flex flex-col gap-6">
              <Card as="section" aria-labelledby="todo-title">
                <h2 id="todo-title" className="mb-3 text-2xl">
                  À faire
                </h2>
                {data.follow_ups.length === 0 && data.interviews.length === 0 ? (
                  <p className="text-muted">Aucune relance ni entretien prévu. 🌿</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {data.interviews.map((a) => (
                      <li key={`i${a.id}`} className="flex items-start gap-3 rounded-xl bg-accent/15 p-3">
                        <CalendarClock className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
                        <div>
                          <p className="font-medium">Entretien {formatDate(a.interview_at, true)}</p>
                          <p className="text-sm text-muted">
                            {a.title} · {a.company}
                          </p>
                        </div>
                      </li>
                    ))}
                    {data.follow_ups.map((a) => (
                      <li key={`f${a.id}`} className="flex items-start gap-3 rounded-xl bg-sand/70 p-3">
                        <BellRing className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
                        <div>
                          <p className="font-medium">Relancer {a.company ?? "le recruteur"}</p>
                          <p className="text-sm text-muted">
                            {a.title} · prévu {relativeTime(a.follow_up_at)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <Link to="/candidatures" className="mt-4 inline-flex items-center gap-1 text-sm font-medium hover:underline">
                  Voir mes candidatures <ArrowRight className="h-4 w-4" />
                </Link>
              </Card>

              <Card as="section" aria-labelledby="sources-title">
                <h2 id="sources-title" className="mb-3 text-2xl">
                  Sources d'offres
                </h2>
                <SourceStatusList compact />
              </Card>

              {!data.resume && (
                <Card className="flex items-center gap-4 bg-accent/15">
                  <FileText className="h-8 w-8 shrink-0" strokeWidth={1.5} aria-hidden />
                  <div className="flex-1">
                    <p className="font-medium">Ajoutez votre CV</p>
                    <p className="text-sm text-muted">Pour vérifier sa lisibilité et postuler en un clic.</p>
                  </div>
                  <Link to="/cv">
                    <Button size="sm">Ajouter</Button>
                  </Link>
                </Card>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ icon, label, value, to, highlight }: { icon: React.ReactNode; label: string; value: number; to: string; highlight?: boolean }) {
  return (
    <Link to={to} className="group">
      <Card className="flex h-full flex-col gap-3 p-4 transition group-hover:-translate-y-0.5 group-hover:shadow-lift sm:flex-row sm:items-center sm:gap-4 sm:p-5">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${highlight ? "bg-accent text-on-accent" : "bg-sand"}`}>{icon}</span>
        <div>
          <p className="tabular font-display text-3xl font-semibold leading-none sm:text-4xl">{value}</p>
          <p className="mt-1 text-sm leading-tight text-muted sm:text-base">{label}</p>
        </div>
      </Card>
    </Link>
  );
}
