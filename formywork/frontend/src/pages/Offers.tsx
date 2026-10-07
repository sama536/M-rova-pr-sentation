import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Bookmark, BookmarkPlus, Briefcase, CheckCircle2, ChevronLeft, Heart, MapPin, RefreshCw, Search, SlidersHorizontal, Trash2, XCircle } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { api } from "@/api/client";
import type { ContractType, Offer, SavedSearch, SearchParams, SearchResult, SourceReport } from "@/api/types";
import { OfferBadges, OfferDetail } from "@/components/OfferDetail";
import { Button, Card, Dialog, EmptyState, ErrorState, Field, Input, PageHeader, Select, Skeleton, cx } from "@/components/ui";
import { keys, useOffers, useSearchOffers, useSearches } from "@/hooks/data";
import { relativeTime } from "@/lib/format";

const EMPTY: SearchParams = { query: "", location: "", radius_km: 20, contract: "", max_days: 0, remote: "" };
type Sort = "date" | "relevance";

export default function OffersPage() {
  const [params, setParams] = useSearchParams();
  const savedId = params.get("recherche") ? Number(params.get("recherche")) : null;
  const view = params.get("vue") ?? (savedId ? "saved" : "search");
  const selectedId = params.get("offre") ? Number(params.get("offre")) : null;

  const [form, setForm] = useState<SearchParams>(() => ({ ...EMPTY, query: params.get("q") ?? "" }));
  const [result, setResult] = useState<SearchResult | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState<Sort>("date");
  const [onlyEmail, setOnlyEmail] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const qc = useQueryClient();

  const searches = useSearches();
  const saved = useSearchOffers(view === "saved" ? savedId : null);
  const listView = useOffers(view, ["new", "favorites", "hidden"].includes(view));
  const currentSaved = searches.data?.find((s) => s.id === savedId) ?? null;

  const search = useMutation({
    mutationFn: (p: SearchParams) => api.post<SearchResult>("/api/search", p),
    onSuccess: (r) => setResult(r),
    onError: (e: Error) => toast.error(e.message),
  });

  const runSearch = (p: SearchParams) => {
    const next = new URLSearchParams();
    if (p.query) next.set("q", p.query);
    setParams(next, { replace: true });
    search.mutate(p);
  };

  // Recherche initiale (lien « Chercher X » ou première visite)
  useEffect(() => {
    if (view === "search" && !result && !search.isPending) search.mutate(form);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  useEffect(() => {
    if (currentSaved) setForm({ ...EMPTY, ...currentSaved.params });
  }, [currentSaved]);

  const refresh = useMutation({
    mutationFn: (id: number) => api.post<{ sources: SourceReport[] }>(`/api/searches/${id}/refresh`),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["search-offers"] });
      qc.invalidateQueries({ queryKey: keys.sources });
      setResult((old) => (old ? { ...old, sources: r.sources } : { offers: [], sources: r.sources, location_found: null }));
      toast.success("Recherche mise à jour");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeSaved = useMutation({
    mutationFn: (id: number) => api.del(`/api/searches/${id}`),
    onSuccess: () => {
      toast("Recherche supprimée");
      qc.invalidateQueries({ queryKey: keys.searches });
      setParams(new URLSearchParams());
    },
  });

  const source: { data?: Offer[]; isLoading: boolean; isError: boolean; error: unknown; refetch?: () => void } =
    view === "saved"
      ? saved
      : view === "search"
        ? { data: result?.offers, isLoading: search.isPending, isError: search.isError, error: search.error }
        : listView;

  const offers = useMemo(() => {
    let list = [...(source.data ?? [])];
    if (onlyEmail) list = list.filter((o) => o.apply_email);
    if (sort === "date") list.sort((a, b) => (b.published_at ?? b.first_seen_at).localeCompare(a.published_at ?? a.first_seen_at));
    return list;
  }, [source.data, onlyEmail, sort]);

  const select = (id: number | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set("offre", String(id));
    else next.delete("offre");
    setParams(next, { replace: true });
  };

  // Ouvre automatiquement la première offre sur grand écran
  useEffect(() => {
    if (!selectedId && offers.length && window.matchMedia("(min-width: 1280px)").matches) select(offers[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offers.length]);

  const setView = (v: string, id?: number) => {
    const next = new URLSearchParams();
    if (v === "saved" && id) next.set("recherche", String(id));
    else if (v !== "search") next.set("vue", v);
    setParams(next);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (view !== "search") setView("search");
    runSearch(form);
  };

  const reports = view === "search" ? result?.sources : undefined;
  const isMobileDetail = selectedId !== null;

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Offres"
        subtitle="Toutes les sources en une seule recherche. Les doublons sont regroupés."
        actions={
          <Button variant="secondary" icon={<BookmarkPlus className="h-4 w-4" />} onClick={() => setSaveOpen(true)}>
            Enregistrer cette recherche
          </Button>
        }
      />

      <Card as="section" className="mb-5" aria-label="Recherche">
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-[1.4fr_1fr_auto] md:items-end">
          <Field label="Métier ou mots-clés">
            {(id) => (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden />
                <Input id={id} value={form.query} onChange={(e) => setForm({ ...form, query: e.target.value })} placeholder="ex. assistante RH, comptable…" className="pl-10" />
              </div>
            )}
          </Field>
          <Field label="Lieu">
            {(id) => (
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden />
                <Input id={id} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Ville ou code postal" className="pl-10" />
              </div>
            )}
          </Field>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} icon={<SlidersHorizontal className="h-4 w-4" />}>
              Filtres
            </Button>
            <Button type="submit" loading={search.isPending} className="flex-1 md:flex-none">
              Rechercher
            </Button>
          </div>
          {showFilters && (
            <div className="grid gap-3 border-t border-line/70 pt-3 sm:grid-cols-2 md:col-span-3 lg:grid-cols-4">
              <Field label="Contrat">
                {(id) => (
                  <Select id={id} value={form.contract} onChange={(e) => setForm({ ...form, contract: e.target.value as ContractType })}>
                    <option value="">Tous</option>
                    <option value="alternance">Alternance</option>
                    <option value="cdi">CDI</option>
                    <option value="cdd">CDD</option>
                    <option value="interim">Intérim</option>
                    <option value="stage">Stage</option>
                    <option value="freelance">Indépendant</option>
                  </Select>
                )}
              </Field>
              <Field label="Distance autour du lieu">
                {(id) => (
                  <Select id={id} value={form.radius_km} onChange={(e) => setForm({ ...form, radius_km: Number(e.target.value) })}>
                    {[5, 10, 20, 30, 50, 100].map((r) => (
                      <option key={r} value={r}>
                        {r} km
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Publiée depuis">
                {(id) => (
                  <Select id={id} value={form.max_days} onChange={(e) => setForm({ ...form, max_days: Number(e.target.value) })}>
                    <option value={0}>Peu importe</option>
                    <option value={1}>24 heures</option>
                    <option value={3}>3 jours</option>
                    <option value={7}>Une semaine</option>
                    <option value={14}>Deux semaines</option>
                    <option value={31}>Un mois</option>
                  </Select>
                )}
              </Field>
              <Field label="Télétravail">
                {(id) => (
                  <Select id={id} value={form.remote} onChange={(e) => setForm({ ...form, remote: e.target.value as SearchParams["remote"] })}>
                    <option value="">Peu importe</option>
                    <option value="partiel">Au moins partiel</option>
                    <option value="total">100 % télétravail</option>
                  </Select>
                )}
              </Field>
            </div>
          )}
        </form>
      </Card>

      {/* Vues et recherches enregistrées */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 scroll-thin" role="tablist" aria-label="Listes d'offres">
        <Chip active={view === "search"} onClick={() => setView("search")} icon={<Search className="h-4 w-4" />}>
          Résultats
        </Chip>
        <Chip active={view === "new"} onClick={() => setView("new")}>
          Nouvelles
        </Chip>
        <Chip active={view === "favorites"} onClick={() => setView("favorites")} icon={<Heart className="h-4 w-4" />}>
          Favoris
        </Chip>
        {searches.data?.map((s) => (
          <Chip key={s.id} active={view === "saved" && savedId === s.id} onClick={() => setView("saved", s.id)} icon={<Bookmark className="h-4 w-4" />} count={s.new_count}>
            {s.name}
          </Chip>
        ))}
        <Chip active={view === "hidden"} onClick={() => setView("hidden")}>
          Masquées
        </Chip>
      </div>

      {view === "saved" && currentSaved && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted">
          <span>Vérifiée automatiquement · dernière mise à jour {relativeTime(currentSaved.last_run_at)}</span>
          <Button size="sm" variant="ghost" loading={refresh.isPending} onClick={() => refresh.mutate(currentSaved.id)} icon={<RefreshCw className="h-4 w-4" />}>
            Mettre à jour
          </Button>
          <Button size="sm" variant="ghost" onClick={() => confirm("Supprimer cette recherche enregistrée ?") && removeSaved.mutate(currentSaved.id)} icon={<Trash2 className="h-4 w-4" />}>
            Supprimer
          </Button>
        </div>
      )}

      {reports && <SourcesStrip reports={reports} locationFound={result?.location_found ?? null} location={form.location} />}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <section aria-label="Liste des offres" className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="tabular text-muted" aria-live="polite">
              {source.isLoading ? "Recherche en cours…" : `${offers.length} offre${offers.length > 1 ? "s" : ""}`}
            </p>
            <div className="flex items-center gap-3 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={onlyEmail} onChange={(e) => setOnlyEmail(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--accent-strong))]" />
                Candidature par e-mail
              </label>
              <label className="flex items-center gap-2">
                Trier
                <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="rounded-lg border border-line bg-surface px-2 py-1">
                  <option value="date">Plus récentes</option>
                  <option value="relevance">Pertinence</option>
                </select>
              </label>
            </div>
          </div>

          {source.isError && <ErrorState message={(source.error as Error)?.message ?? "Erreur"} onRetry={source.refetch} />}
          {source.isLoading && (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-36" />
              ))}
            </div>
          )}
          {!source.isLoading && !source.isError && offers.length === 0 && (
            <EmptyState icon={<Briefcase className="h-6 w-6" />} title={view === "favorites" ? "Pas encore de favoris" : view === "hidden" ? "Aucune offre masquée" : "Aucune offre trouvée"}>
              {view === "search" ? "Essayez un mot-clé plus simple, une ville plus grande ou une distance plus large." : "Les offres apparaîtront ici."}
            </EmptyState>
          )}
          <ul className="flex flex-col gap-3">
            {offers.map((o) => (
              <li key={o.id}>
                <OfferCard offer={o} selected={o.id === selectedId} onSelect={() => select(o.id)} />
              </li>
            ))}
          </ul>
        </section>

        {/* Détail : panneau sur grand écran */}
        <aside aria-label="Détail de l'offre" className="hidden xl:block">
          <div className="sticky top-8 max-h-[calc(100vh-4rem)] overflow-y-auto rounded-3xl border border-line/80 bg-surface p-7 shadow-soft scroll-thin">
            {selectedId ? (
              <OfferDetail key={selectedId} offerId={selectedId} />
            ) : (
              <EmptyState icon={<Briefcase className="h-6 w-6" />} title="Choisissez une offre">
                Son résumé et le bouton « Postuler » s'afficheront ici.
              </EmptyState>
            )}
          </div>
        </aside>
      </div>

      {/* Détail : plein écran sur mobile et tablette */}
      {isMobileDetail && (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-bg px-4 pb-24 pt-4 xl:hidden" role="dialog" aria-modal="true" aria-label="Détail de l'offre">
          <Button variant="ghost" onClick={() => select(null)} icon={<ChevronLeft className="h-5 w-5" />} className="mb-3">
            Retour à la liste
          </Button>
          <OfferDetail key={selectedId} offerId={selectedId!} />
        </div>
      )}

      <SaveSearchDialog open={saveOpen} onOpenChange={setSaveOpen} params={form} onSaved={(s) => setView("saved", s.id)} />
    </div>
  );
}

function Chip({ active, onClick, children, icon, count }: { active: boolean; onClick: () => void; children: React.ReactNode; icon?: React.ReactNode; count?: number }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cx(
        "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-[0.95rem] transition-colors",
        active ? "border-primary bg-primary text-on-primary" : "border-line bg-surface hover:border-ink/30",
      )}
    >
      {icon}
      {children}
      {!!count && <span className={cx("tabular rounded-full px-1.5 text-xs font-semibold", active ? "bg-accent text-on-accent" : "bg-accent text-on-accent")}>{count}</span>}
    </button>
  );
}

function OfferCard({ offer, selected, onSelect }: { offer: Offer; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      aria-current={selected || undefined}
      className={cx(
        "group w-full rounded-2xl border bg-surface p-5 text-left shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift",
        selected ? "border-accent-strong ring-4 ring-accent/20" : "border-line/80",
        offer.expired && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-sans text-[1.08rem] font-semibold leading-snug">{offer.title}</h3>
          <p className="mt-0.5 text-muted">{[offer.company, offer.location].filter(Boolean).join(" · ")}</p>
        </div>
        {offer.favorite && <Heart className="h-5 w-5 shrink-0 fill-accent-strong text-accent-strong" aria-label="Favori" />}
      </div>
      <div className="mt-3">
        <OfferBadges offer={offer} />
      </div>
      {offer.summary && <p className="mt-3 line-clamp-2 text-[0.95rem] text-ink/85">{offer.summary.slice(0, 2).join(" ")}</p>}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
        <span className="flex flex-wrap gap-1.5">
          {offer.keywords?.map((k) => (
            <span key={k} className="rounded-md bg-sand px-2 py-0.5 text-ink/80">
              {k}
            </span>
          ))}
        </span>
        <span>
          {offer.source_label} · {relativeTime(offer.published_at ?? offer.first_seen_at)}
        </span>
      </div>
    </button>
  );
}

function SourcesStrip({ reports, locationFound, location }: { reports: SourceReport[]; locationFound: boolean | null; location: string }) {
  if (!reports.length)
    return (
      <p className="mb-4 rounded-xl bg-warning/10 p-3 text-warning">
        Aucune source n'est active. Ajoutez des clés d'API dans le fichier .env ou activez le mode démo (voir Réglages).
      </p>
    );
  return (
    <div className="mb-4 flex flex-col gap-2">
      {locationFound === false && location && (
        <p className="flex items-center gap-2 text-sm text-warning">
          <AlertCircle className="h-4 w-4" aria-hidden /> Ville « {location} » non reconnue : certaines sources ont cherché sans filtre de lieu précis.
        </p>
      )}
      <ul className="flex flex-wrap gap-2" aria-label="État des sources pour cette recherche">
        {reports.map((r) => (
          <li
            key={r.name}
            title={r.error ?? undefined}
            className={cx("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm", r.ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger")}
          >
            {r.ok ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <XCircle className="h-4 w-4" aria-hidden />}
            {r.label} : {r.ok ? `${r.count} offre${r.count > 1 ? "s" : ""}` : r.error}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SaveSearchDialog({ open, onOpenChange, params, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; params: SearchParams; onSaved: (s: SavedSearch) => void }) {
  const [name, setName] = useState("");
  const qc = useQueryClient();
  useEffect(() => {
    if (open) setName([params.query || "Toutes les offres", params.location].filter(Boolean).join(" – "));
  }, [open, params]);
  const save = useMutation({
    mutationFn: () => api.post<SavedSearch>("/api/searches", { name, params }),
    onSuccess: (s) => {
      toast.success("Recherche enregistrée", { description: "Vous serez prévenu(e) des nouvelles offres." });
      qc.invalidateQueries({ queryKey: keys.searches });
      onOpenChange(false);
      onSaved(s);
      if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => undefined);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Enregistrer la recherche" description="FormyWork la vérifiera automatiquement et vous préviendra des nouvelles offres.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
        className="flex flex-col gap-4"
      >
        <Field label="Nom de la recherche">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} required maxLength={150} />}</Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="submit" loading={save.isPending} disabled={!name.trim()}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
