import { useQueryClient } from "@tanstack/react-query";
import { Building2, EyeOff, ExternalLink, Heart, KanbanSquare, MapPin, Send, Sparkles, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { api } from "@/api/client";
import type { Offer } from "@/api/types";
import { useOffer, useOfferState } from "@/hooks/data";
import { CONTRACT_LABELS, REMOTE_LABELS, STATUS_LABELS, formatDate, relativeTime } from "@/lib/format";
import { ApplyDialog } from "./ApplyDialog";
import { Badge, Button, ErrorState, Skeleton, cx } from "./ui";

export function summaryLabel(by: string | null | undefined) {
  if (!by) return null;
  if (by === "simple") return "Résumé automatique (sans IA)";
  if (by === "exemple-demo") return "Résumé IA · exemple de démonstration";
  return "Résumé IA";
}

export function OfferBadges({ offer }: { offer: Offer }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {offer.is_new && <Badge tone="new">Nouveau</Badge>}
      <Badge tone={offer.is_alternance ? "accent" : "neutral"}>{CONTRACT_LABELS[offer.contract_type] ?? offer.contract_type}</Badge>
      {REMOTE_LABELS[offer.remote] && <Badge tone="info">{REMOTE_LABELS[offer.remote]}</Badge>}
      {offer.apply_email && <Badge tone="success">Candidature par e-mail</Badge>}
      {offer.application_status && <Badge tone="warning">{STATUS_LABELS[offer.application_status]}</Badge>}
    </div>
  );
}

export function OfferDetail({ offerId }: { offerId: number }) {
  const { data: offer, isLoading, isError, error, refetch } = useOffer(offerId);
  const state = useOfferState();
  const qc = useQueryClient();
  const [applyOpen, setApplyOpen] = useState(false);
  const [tracking, setTracking] = useState(false);

  if (isLoading)
    return (
      <div className="flex flex-col gap-4 p-1">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  if (isError || !offer) return <ErrorState message={(error as Error)?.message ?? "Offre introuvable"} onRetry={() => refetch()} />;

  const track = async () => {
    setTracking(true);
    try {
      await api.post("/api/applications", { offer_id: offer.id, status: "a_postuler" });
      toast.success("Ajoutée à vos candidatures", { description: "Colonne « À postuler »" });
      qc.invalidateQueries({ queryKey: ["applications"] });
      qc.invalidateQueries({ queryKey: ["offer", offer.id] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTracking(false);
    }
  };

  const label = summaryLabel(offer.summary_by);
  return (
    <article className="flex flex-col gap-5" aria-labelledby={`offer-title-${offer.id}`}>
      <header>
        <OfferBadges offer={offer} />
        <h2 id={`offer-title-${offer.id}`} className="mt-3 text-[1.75rem] leading-tight">
          {offer.title}
        </h2>
        <ul className="mt-3 flex flex-col gap-1.5 text-ink/90">
          {offer.company && (
            <li className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted" aria-hidden /> {offer.company}
            </li>
          )}
          {offer.location && (
            <li className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted" aria-hidden /> {offer.location}
            </li>
          )}
          {offer.salary && (
            <li className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-muted" aria-hidden /> {offer.salary}
            </li>
          )}
        </ul>
        <p className="mt-2 text-sm text-muted">
          Publiée {offer.published_at ? `le ${formatDate(offer.published_at)}` : relativeTime(offer.first_seen_at)} · source : {offer.source_label}
          {offer.also_on.length > 0 && ` (aussi sur ${offer.also_on.join(", ")})`}
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Button size="lg" icon={<Send className="h-5 w-5" />} onClick={() => setApplyOpen(true)} className="flex-1 sm:flex-none">
          {offer.application_status && offer.application_status !== "a_postuler" ? "Postuler à nouveau" : "Postuler"}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          aria-pressed={offer.favorite}
          onClick={() => state.mutate({ id: offer.id, favorite: !offer.favorite })}
          icon={<Heart className={cx("h-5 w-5", offer.favorite && "fill-accent-strong text-accent-strong")} />}
        >
          {offer.favorite ? "Favori" : "Garder"}
        </Button>
        {offer.url && (
          <a href={offer.url} target="_blank" rel="noreferrer noopener" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-line bg-surface px-4 font-medium hover:border-ink/30">
            <ExternalLink className="h-5 w-5" aria-hidden /> Annonce d'origine
            <span className="sr-only">(nouvel onglet)</span>
          </a>
        )}
      </div>

      {offer.summary && (
        <section className="rounded-2xl border border-accent/40 bg-accent/10 p-5" aria-labelledby={`sum-${offer.id}`}>
          <h3 id={`sum-${offer.id}`} className="flex items-center gap-2 font-sans text-base font-semibold">
            <Sparkles className="h-4 w-4" aria-hidden /> {label}
          </h3>
          <ul className="mt-3 flex flex-col gap-2">
            {offer.summary.map((line) => {
              const [head, ...rest] = line.split(" : ");
              return (
                <li key={line} className="leading-relaxed">
                  {rest.length ? (
                    <>
                      <strong className="font-semibold">{head} :</strong> {rest.join(" : ")}
                    </>
                  ) : (
                    line
                  )}
                </li>
              );
            })}
          </ul>
          {!!offer.keywords?.length && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {offer.keywords.map((k) => (
                <Badge key={k} className="bg-surface">
                  {k}
                </Badge>
              ))}
            </div>
          )}
        </section>
      )}

      <section aria-labelledby={`desc-${offer.id}`}>
        <h3 id={`desc-${offer.id}`} className="mb-2 text-xl">
          Annonce complète
        </h3>
        <div className="whitespace-pre-line leading-relaxed text-ink/90">{offer.description || "Pas de description fournie par la source."}</div>
      </section>

      <div className="flex flex-wrap gap-2 border-t border-line/70 pt-4">
        {!offer.application_status && (
          <Button variant="ghost" size="sm" loading={tracking} onClick={track} icon={<KanbanSquare className="h-4 w-4" />}>
            Ajouter à mon suivi
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => state.mutate({ id: offer.id, hidden: !offer.hidden })} icon={<EyeOff className="h-4 w-4" />}>
          {offer.hidden ? "Ne plus masquer" : "Masquer cette offre"}
        </Button>
      </div>

      {applyOpen && <ApplyDialog offer={offer} open={applyOpen} onOpenChange={setApplyOpen} />}
    </article>
  );
}
