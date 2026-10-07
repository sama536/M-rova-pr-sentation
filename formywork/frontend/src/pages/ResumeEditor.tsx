import * as Tabs from "@radix-ui/react-tabs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowDown, ArrowUp, CheckCircle2, ChevronLeft, Download, Info, Lightbulb, Plus, Save, Target, Trash2, Wand2, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { api } from "@/api/client";
import type { AtsCheck, AtsReport, Education, Experience, Offer, Resume, ResumeData } from "@/api/types";
import { Badge, Button, Card, Dialog, ErrorState, Field, Input, ScoreRing, Select, Skeleton, Spinner, Textarea, cx } from "@/components/ui";
import { keys, useOffers, useResume } from "@/hooks/data";

const NEW_EXP: Experience = { title: "", company: "", location: "", start: "", end: "", current: false, bullets: [] };
const NEW_EDU: Education = { degree: "", school: "", location: "", start: "", end: "", details: "" };

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function ResumeEditorPage() {
  const id = Number(useParams().id);
  const { data: resume, isLoading, isError, error, refetch } = useResume(id);
  if (isLoading)
    return (
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Skeleton className="h-[70vh]" />
        <Skeleton className="h-[50vh]" />
      </div>
    );
  if (isError || !resume) return <ErrorState message={(error as Error)?.message ?? "CV introuvable"} onRetry={() => refetch()} />;
  return <Editor key={resume.id} resume={resume} />;
}

function Editor({ resume }: { resume: Resume }) {
  const [data, setData] = useState<ResumeData>(resume.data);
  const [name, setName] = useState(resume.name);
  const [offerId, setOfferId] = useState<number | null>(resume.offer_id);
  const [adaptOpen, setAdaptOpen] = useState(false);
  const dirty = JSON.stringify(data) !== JSON.stringify(resume.data) || name !== resume.name;
  const qc = useQueryClient();
  const debounced = useDebounced(data, 600);

  const report = useQuery({
    queryKey: ["ats", resume.id, debounced, offerId],
    queryFn: () => api.post<AtsReport>("/api/resumes/analyze", { data: debounced, offer_id: offerId }),
    placeholderData: (prev) => prev,
  });

  const save = useMutation({
    mutationFn: () => api.put<Resume>(`/api/resumes/${resume.id}`, { name, data }),
    onSuccess: (r) => {
      qc.setQueryData(keys.resume(resume.id), r);
      qc.invalidateQueries({ queryKey: keys.resumes });
      qc.invalidateQueries({ queryKey: keys.dashboard });
      toast.success("CV enregistré");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = <K extends keyof ResumeData>(key: K, value: ResumeData[K]) => setData((d) => ({ ...d, [key]: value }));
  const exportUrl = (fmt: "pdf" | "docx") => `/api/resumes/${resume.id}/export.${fmt}`;

  return (
    <div className="animate-fade-up">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 flex-1">
          <Link to="/cv" className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
            <ChevronLeft className="h-4 w-4" /> Mes CV
          </Link>
          <label htmlFor="cv-name" className="sr-only">
            Nom du CV
          </label>
          <input id="cv-name" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl bg-transparent font-display text-3xl font-semibold outline-none hover:bg-sand/50 focus:bg-surface sm:text-[2.1rem]" />
          {resume.offer_title && (
            <p className="mt-1 flex items-center gap-1.5 text-muted">
              <Target className="h-4 w-4" aria-hidden /> Adapté pour : {resume.offer_title}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={exportUrl("pdf")} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 font-medium hover:border-ink/30" onClick={(e) => dirty && (e.preventDefault(), toast("Enregistrez d'abord vos modifications."))}>
            <Download className="h-4 w-4" aria-hidden /> PDF
          </a>
          <a href={exportUrl("docx")} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 font-medium hover:border-ink/30" onClick={(e) => dirty && (e.preventDefault(), toast("Enregistrez d'abord vos modifications."))}>
            <Download className="h-4 w-4" aria-hidden /> Word
          </a>
          <Button variant="accent" icon={<Wand2 className="h-4 w-4" />} onClick={() => setAdaptOpen(true)}>
            Adapter à une offre
          </Button>
          <Button icon={<Save className="h-4 w-4" />} onClick={() => save.mutate()} loading={save.isPending} disabled={!dirty}>
            {dirty ? "Enregistrer" : "Enregistré"}
          </Button>
        </div>
      </div>

      <Tabs.Root defaultValue={resume.adaptation ? "compare" : "edit"}>
        <Tabs.List className="mb-5 inline-flex gap-1 rounded-2xl bg-sand/70 p-1" aria-label="Affichage du CV">
          <Tab value="edit">Éditer</Tab>
          {resume.adaptation && <Tab value="compare">Avant / après</Tab>}
          {resume.adaptation?.letter && <Tab value="letter">Lettre</Tab>}
        </Tabs.List>

        <Tabs.Content value="edit" className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-5">
            {data.import_flags?.image_only && (
              <p role="alert" className="flex gap-2 rounded-2xl bg-danger/10 p-4 text-danger">
                <AlertCircle className="h-5 w-5 shrink-0" /> Le PDF importé semble être une image : le texte n'a pas pu être lu. Complétez les champs ci-dessous.
              </p>
            )}
            <Section title="Coordonnées">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Prénom et nom">{(id) => <Input id={id} value={data.contact.full_name} onChange={(e) => set("contact", { ...data.contact, full_name: e.target.value })} />}</Field>
                <Field label="Intitulé (poste visé)">{(id) => <Input id={id} value={data.contact.headline} onChange={(e) => set("contact", { ...data.contact, headline: e.target.value })} placeholder="ex. Assistante de gestion" />}</Field>
                <Field label="E-mail">{(id) => <Input id={id} type="email" value={data.contact.email} onChange={(e) => set("contact", { ...data.contact, email: e.target.value })} />}</Field>
                <Field label="Téléphone">{(id) => <Input id={id} type="tel" value={data.contact.phone} onChange={(e) => set("contact", { ...data.contact, phone: e.target.value })} />}</Field>
                <Field label="Ville">{(id) => <Input id={id} value={data.contact.city} onChange={(e) => set("contact", { ...data.contact, city: e.target.value })} />}</Field>
                <Field label="Lien (LinkedIn, site…)" hint="Facultatif">
                  {(id) => <Input id={id} value={data.contact.links[0] ?? ""} onChange={(e) => set("contact", { ...data.contact, links: e.target.value ? [e.target.value] : [] })} />}
                </Field>
              </div>
            </Section>

            <Section title="Accroche" hint="2 à 4 phrases : qui vous êtes, ce que vous savez faire, ce que vous cherchez.">
              <Textarea aria-label="Accroche" rows={4} value={data.summary} onChange={(e) => set("summary", e.target.value)} />
              <p className="tabular mt-1 text-right text-sm text-muted">{data.summary.length} caractères</p>
            </Section>

            <Section title="Expériences professionnelles" action={<Button size="sm" variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => set("experiences", [...data.experiences, { ...NEW_EXP }])}>Ajouter</Button>}>
              {data.experiences.length === 0 && <p className="text-muted">Stages, emplois, missions, bénévolat : tout compte.</p>}
              <ol className="flex flex-col gap-4">
                {data.experiences.map((exp, i) => (
                  <ListItem
                    key={i}
                    label={exp.title || `Expérience ${i + 1}`}
                    onUp={i > 0 ? () => set("experiences", move(data.experiences, i, i - 1)) : undefined}
                    onDown={i < data.experiences.length - 1 ? () => set("experiences", move(data.experiences, i, i + 1)) : undefined}
                    onRemove={() => set("experiences", data.experiences.filter((_, j) => j !== i))}
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Poste">{(id) => <Input id={id} value={exp.title} onChange={(e) => set("experiences", patch(data.experiences, i, { title: e.target.value }))} />}</Field>
                      <Field label="Entreprise">{(id) => <Input id={id} value={exp.company} onChange={(e) => set("experiences", patch(data.experiences, i, { company: e.target.value }))} />}</Field>
                      <Field label="Début" hint="MM/AAAA">{(id) => <Input id={id} value={exp.start} onChange={(e) => set("experiences", patch(data.experiences, i, { start: e.target.value }))} placeholder="09/2021" />}</Field>
                      <Field label="Fin" hint={exp.current ? "En cours" : "MM/AAAA"}>
                        {(id) => (
                          <div className="flex items-center gap-3">
                            <Input id={id} value={exp.end} disabled={exp.current} onChange={(e) => set("experiences", patch(data.experiences, i, { end: e.target.value }))} placeholder="06/2024" />
                            <label className="flex shrink-0 items-center gap-1.5 text-sm">
                              <input type="checkbox" checked={exp.current} onChange={(e) => set("experiences", patch(data.experiences, i, { current: e.target.checked, end: e.target.checked ? "" : exp.end }))} className="h-4 w-4 accent-[rgb(var(--accent-strong))]" />
                              En cours
                            </label>
                          </div>
                        )}
                      </Field>
                    </div>
                    <Field label="Missions (une par ligne)" hint="Commencez par un verbe : Accueillir, Préparer, Gérer…">
                      {(id) => <Textarea id={id} rows={4} value={exp.bullets.join("\n")} onChange={(e) => set("experiences", patch(data.experiences, i, { bullets: e.target.value.split("\n") }))} />}
                    </Field>
                  </ListItem>
                ))}
              </ol>
            </Section>

            <Section title="Formation" action={<Button size="sm" variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => set("education", [...data.education, { ...NEW_EDU }])}>Ajouter</Button>}>
              <ol className="flex flex-col gap-4">
                {data.education.map((ed, i) => (
                  <ListItem key={i} label={ed.degree || `Formation ${i + 1}`} onRemove={() => set("education", data.education.filter((_, j) => j !== i))}>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Diplôme ou formation">{(id) => <Input id={id} value={ed.degree} onChange={(e) => set("education", patch(data.education, i, { degree: e.target.value }))} />}</Field>
                      <Field label="Établissement">{(id) => <Input id={id} value={ed.school} onChange={(e) => set("education", patch(data.education, i, { school: e.target.value }))} />}</Field>
                      <Field label="Année d'obtention">{(id) => <Input id={id} value={ed.end} onChange={(e) => set("education", patch(data.education, i, { end: e.target.value }))} placeholder="2024" />}</Field>
                      <Field label="Détails" hint="Facultatif">{(id) => <Input id={id} value={ed.details} onChange={(e) => set("education", patch(data.education, i, { details: e.target.value }))} />}</Field>
                    </div>
                  </ListItem>
                ))}
              </ol>
            </Section>

            <Section title="Compétences" hint="Séparez par des virgules. Nommez précisément vos outils et savoir-faire.">
              <ListInput label="Compétences" value={data.skills} onChange={(v) => set("skills", v)} />
            </Section>
            <Section title="Langues" hint="Ex. : Anglais : B2, Espagnol : notions">
              <ListInput
                label="Langues"
                value={data.languages.map((l) => (l.level ? `${l.name} : ${l.level}` : l.name))}
                onChange={(v) => set("languages", v.map((s) => ({ name: s.split(":")[0].trim(), level: (s.split(":")[1] ?? "").trim() })))}
              />
            </Section>
            <Section title="Certifications, permis">
              <ListInput label="Certifications" value={data.certifications} onChange={(v) => set("certifications", v)} />
            </Section>
            <Section title="Centres d'intérêt" hint="Facultatif. Le bénévolat est souvent apprécié.">
              <ListInput label="Centres d'intérêt" value={data.interests} onChange={(v) => set("interests", v)} />
            </Section>
          </div>

          <AtsPanel report={report.data} loading={report.isFetching} offerId={offerId} onOffer={setOfferId} />
        </Tabs.Content>

        {resume.adaptation && (
          <Tabs.Content value="compare">
            <Compare resume={resume} />
          </Tabs.Content>
        )}
        {resume.adaptation?.letter && (
          <Tabs.Content value="letter">
            <LetterView resume={resume} />
          </Tabs.Content>
        )}
      </Tabs.Root>

      {adaptOpen && <AdaptDialog resume={resume} onClose={() => setAdaptOpen(false)} />}
    </div>
  );
}

function Tab({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <Tabs.Trigger value={value} className="min-h-10 rounded-xl px-4 font-medium text-muted transition data-[state=active]:bg-surface data-[state=active]:text-ink data-[state=active]:shadow-soft">
      {children}
    </Tabs.Trigger>
  );
}

function Section({ title, hint, action, children }: { title: string; hint?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card as="section">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl">{title}</h2>
          {hint && <p className="text-sm text-muted">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

function ListItem({ label, children, onUp, onDown, onRemove }: { label: string; children: React.ReactNode; onUp?: () => void; onDown?: () => void; onRemove: () => void }) {
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-line/80 bg-bg/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold">{label}</p>
        <div className="flex gap-1">
          {onUp && (
            <button onClick={onUp} className="rounded-lg p-1.5 hover:bg-sand" aria-label={`Monter ${label}`}>
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
          {onDown && (
            <button onClick={onDown} className="rounded-lg p-1.5 hover:bg-sand" aria-label={`Descendre ${label}`}>
              <ArrowDown className="h-4 w-4" />
            </button>
          )}
          <button onClick={onRemove} className="rounded-lg p-1.5 text-muted hover:bg-danger/10 hover:text-danger" aria-label={`Supprimer ${label}`}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      {children}
    </li>
  );
}

function ListInput({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState(value.join(", "));
  useEffect(() => setText(value.join(", ")), [value]);
  return (
    <div>
      <Input aria-label={label} value={text} onChange={(e) => setText(e.target.value)} onBlur={() => onChange(text.split(",").map((s) => s.trim()).filter(Boolean))} />
      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5" aria-hidden>
          {value.map((v) => (
            <Badge key={v}>{v}</Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function patch<T>(list: T[], i: number, p: Partial<T>): T[] {
  return list.map((item, j) => (j === i ? { ...item, ...p } : item));
}
function move<T>(list: T[], from: number, to: number): T[] {
  const copy = [...list];
  const [it] = copy.splice(from, 1);
  copy.splice(to, 0, it);
  return copy;
}

// ------------------------------------------------------------------ panneau ATS
const STATUS_ICON = {
  ok: <CheckCircle2 className="h-5 w-5 text-success" aria-label="Correct" />,
  warning: <AlertCircle className="h-5 w-5 text-warning" aria-label="À améliorer" />,
  error: <XCircle className="h-5 w-5 text-danger" aria-label="À corriger" />,
  info: <Info className="h-5 w-5 text-info" aria-label="Conseil" />,
};

function AtsPanel({ report, loading, offerId, onOffer }: { report?: AtsReport; loading: boolean; offerId: number | null; onOffer: (id: number | null) => void }) {
  const favorites = useOffers("favorites");
  const recent = useOffers("recent");
  const options = useMemo(() => {
    const seen = new Set<number>();
    return [...(favorites.data ?? []), ...(recent.data ?? [])].filter((o) => !seen.has(o.id) && seen.add(o.id)).slice(0, 40);
  }, [favorites.data, recent.data]);
  const order = { error: 0, warning: 1, info: 2, ok: 3 };
  const checks = [...(report?.checks ?? [])].sort((a, b) => order[a.status] - order[b.status]);
  const todo = checks.filter((c) => c.status !== "ok");
  const done = checks.filter((c) => c.status === "ok");

  return (
    <aside aria-label="Diagnostic ATS" className="xl:sticky xl:top-8 xl:self-start">
      <Card className="flex flex-col gap-5">
        <div className="flex items-center gap-5">
          {report ? <ScoreRing score={report.score} /> : <Skeleton className="h-28 w-28 rounded-full" />}
          <div className="flex-1">
            <h2 className="text-2xl">Lisibilité ATS</h2>
            <p className="text-sm text-muted">Les logiciels de recrutement trient les CV automatiquement. Ce score explique ce qu'ils voient.</p>
            {loading && <p className="mt-1 text-sm text-muted" aria-live="polite">Analyse…</p>}
          </div>
        </div>

        <Field label="Comparer à une offre" hint="Pour vérifier les mots-clés attendus.">
          {(id) => (
            <Select id={id} value={offerId ?? ""} onChange={(e) => onOffer(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Aucune offre (analyse générale)</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.favorite ? "★ " : ""}
                  {o.title} {o.company ? `· ${o.company}` : ""}
                </option>
              ))}
            </Select>
          )}
        </Field>

        {report && (
          <>
            <ul className="flex flex-col gap-2.5">
              {report.categories.map((c) => (
                <li key={c.id}>
                  <div className="flex justify-between text-sm">
                    <span>{c.label}</span>
                    <span className="tabular font-medium">
                      {c.score} / {c.max}
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-sand" role="presentation">
                    <div className="h-full rounded-full bg-accent-strong transition-[width] duration-500" style={{ width: `${(c.score / c.max) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>

            {(report.keywords_matched.length > 0 || report.keywords_missing.length > 0) && (
              <div>
                <h3 className="mb-2 font-sans text-base font-semibold">Mots-clés {offerId ? "de l'offre" : "reconnus"}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {report.keywords_matched.map((k) => (
                    <Badge key={k} tone="success" icon={<CheckCircle2 className="h-3.5 w-3.5" />}>
                      {k}
                    </Badge>
                  ))}
                  {report.keywords_missing.map((k) => (
                    <Badge key={k} tone="danger" icon={<XCircle className="h-3.5 w-3.5" />}>
                      {k}
                    </Badge>
                  ))}
                </div>
                {report.keywords_missing.length > 0 && <p className="mt-2 text-sm text-muted">Ajoutez seulement ceux que vous maîtrisez vraiment.</p>}
              </div>
            )}

            <div>
              <h3 className="mb-2 font-sans text-base font-semibold">Corrections conseillées ({todo.length})</h3>
              <ul className="flex flex-col gap-2">
                {todo.map((c) => (
                  <CheckItem key={c.id} c={c} />
                ))}
                {todo.length === 0 && <p className="text-success">Rien à corriger, bravo !</p>}
              </ul>
            </div>
            {done.length > 0 && (
              <details>
                <summary className="cursor-pointer font-medium">Points déjà réussis ({done.length})</summary>
                <ul className="mt-2 flex flex-col gap-2">
                  {done.map((c) => (
                    <CheckItem key={c.id} c={c} />
                  ))}
                </ul>
              </details>
            )}
            <div className="rounded-2xl bg-sand/60 p-4">
              <h3 className="mb-2 flex items-center gap-2 font-sans text-base font-semibold">
                <Lightbulb className="h-4 w-4" aria-hidden /> Conseils pour votre profil
              </h3>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {report.profile_tips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          </>
        )}
      </Card>
    </aside>
  );
}

function CheckItem({ c }: { c: AtsCheck }) {
  return (
    <li className="flex gap-3 rounded-xl border border-line/70 p-3">
      <span className="mt-0.5 shrink-0">{STATUS_ICON[c.status]}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-medium">{c.title}</p>
          <span className="tabular shrink-0 text-xs text-muted">
            {Math.round(c.points)}/{c.max_points} pts
          </span>
        </div>
        <p className="text-sm text-ink/85">{c.detail}</p>
        {c.fix && <p className="mt-1 text-sm font-medium">→ {c.fix}</p>}
      </div>
    </li>
  );
}

// ------------------------------------------------------------------ adaptation
function AdaptDialog({ resume, onClose }: { resume: Resume; onClose: () => void }) {
  const favorites = useOffers("favorites");
  const recent = useOffers("recent");
  const [offerId, setOfferId] = useState<number | "">("");
  const [withLetter, setWithLetter] = useState(true);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const all = useMemo(() => {
    const seen = new Set<number>();
    return [...(favorites.data ?? []), ...(recent.data ?? [])].filter((o: Offer) => !seen.has(o.id) && seen.add(o.id));
  }, [favorites.data, recent.data]);
  const adapt = useMutation({
    mutationFn: () => api.post<Resume>(`/api/resumes/${resume.id}/adapt`, { offer_id: offerId, with_letter: withLetter }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: keys.resumes });
      toast.success("Version adaptée créée", { description: "Vérifiez les « points à vérifier » avant de l'envoyer." });
      onClose();
      navigate(`/cv/${r.id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} title="Adapter le CV à une offre" description="Une nouvelle version est créée, votre CV d'origine ne change pas. Aucune expérience, compétence ou chiffre n'est inventé.">
      {adapt.isPending ? (
        <div className="py-10">
          <Spinner label="Adaptation en cours… (jusqu'à une minute avec l'IA)" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Field label="Offre visée" hint="Vos favoris et les offres récentes.">
            {(id) => (
              <Select id={id} value={offerId} onChange={(e) => setOfferId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Choisir une offre…</option>
                {all.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.favorite ? "★ " : ""}
                    {o.title} {o.company ? `· ${o.company}` : ""}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={withLetter} onChange={(e) => setWithLetter(e.target.checked)} className="h-5 w-5 accent-[rgb(var(--accent-strong))]" />
            Préparer aussi une lettre de motivation courte
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Annuler
            </Button>
            <Button variant="accent" icon={<Wand2 className="h-4 w-4" />} disabled={!offerId} onClick={() => adapt.mutate()}>
              Adapter
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function Compare({ resume }: { resume: Resume }) {
  const parent = useResume(resume.parent_id);
  const a = resume.adaptation!;
  const before = parent.data?.data;
  const after = resume.data;
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-[auto_1fr]">
        <Card className="flex items-center gap-6">
          <div className="text-center">
            <ScoreRing score={a.score_before} size={88} label="Score avant" />
            <p className="mt-1 text-sm text-muted">Avant</p>
          </div>
          <span className="font-display text-3xl text-muted" aria-hidden>
            →
          </span>
          <div className="text-center">
            <ScoreRing score={a.score_after} size={88} label="Score après" />
            <p className="mt-1 text-sm text-muted">Après</p>
          </div>
        </Card>
        <Card>
          <h2 className="text-xl">Ce qui a changé</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {a.changes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted">
            Généré par : {a.generated_by === "simple" ? "réorganisation automatique (IA non configurée)" : `IA (${a.generated_by})`}
          </p>
        </Card>
      </div>
      {a.points.length > 0 && (
        <Card className="border-warning/40 bg-warning/5">
          <h2 className="flex items-center gap-2 text-xl">
            <AlertCircle className="h-5 w-5 text-warning" aria-hidden /> Points à vérifier
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {a.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Card>
      )}
      {!before ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <CompareColumn title="CV d'origine" data={before} />
          <CompareColumn title="Version adaptée" data={after} other={before} />
        </div>
      )}
    </div>
  );
}

function CompareColumn({ title, data, other }: { title: string; data: ResumeData; other?: ResumeData }) {
  const changed = (a: string, b?: string) => other !== undefined && a !== b;
  return (
    <Card>
      <h2 className="mb-3 text-xl">{title}</h2>
      <p className={cx("font-semibold", changed(data.contact.headline, other?.contact.headline) && "rounded bg-accent/25 px-1")}>{data.contact.headline}</p>
      <p className={cx("mt-2 text-[0.95rem]", changed(data.summary, other?.summary) && "rounded bg-accent/25 px-1")}>{data.summary}</p>
      <h3 className="mt-4 font-sans text-sm font-semibold uppercase tracking-wide text-muted">Compétences</h3>
      <p className={cx("text-[0.95rem]", changed(data.skills.join(), other?.skills.join()) && "rounded bg-accent/25 px-1")}>{data.skills.join(", ")}</p>
      {data.experiences.map((e, i) => (
        <div key={i} className="mt-4">
          <p className="font-medium">
            {e.title} – {e.company}
          </p>
          <ul className="mt-1 list-disc pl-5 text-[0.95rem]">
            {e.bullets.map((b, j) => (
              <li key={j} className={cx(changed(b, other?.experiences[i]?.bullets[j]) && "rounded bg-accent/25 px-1")}>
                {b}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {other && <p className="mt-4 text-sm text-muted">Surligné : ce qui diffère de l'original.</p>}
    </Card>
  );
}

function LetterView({ resume }: { resume: Resume }) {
  const qc = useQueryClient();
  const regen = useMutation({
    mutationFn: () => api.post<Resume>(`/api/resumes/${resume.id}/letter`),
    onSuccess: (r) => {
      qc.setQueryData(keys.resume(resume.id), r);
      toast.success("Nouvelle lettre préparée");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const a = resume.adaptation!;
  return (
    <Card className="max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl">Lettre de motivation</h2>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" loading={regen.isPending} onClick={() => regen.mutate()}>
            Proposer une autre version
          </Button>
          <a href={`/api/resumes/${resume.id}/letter.pdf`} className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-primary px-3 text-sm font-medium text-on-primary">
            <Download className="h-4 w-4" aria-hidden /> PDF
          </a>
        </div>
      </div>
      <div className="whitespace-pre-line rounded-2xl bg-bg p-6 font-[450] leading-relaxed">{a.letter}</div>
      <p className="mt-3 text-sm text-muted">
        {a.letter_by === "simple" ? "Modèle simple rempli avec les informations réelles de votre CV (IA non configurée). Complétez les passages entre crochets." : "Rédigée par l'IA à partir de votre CV uniquement. Relisez-la avant de l'envoyer."}
      </p>
    </Card>
  );
}
