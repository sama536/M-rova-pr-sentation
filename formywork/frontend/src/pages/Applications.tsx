import { DndContext, KeyboardSensor, PointerSensor, closestCorners, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BellRing, CalendarClock, ExternalLink, FileText, GripVertical, KanbanSquare, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { api } from "@/api/client";
import type { AppStatus, Application } from "@/api/types";
import { Button, Dialog, EmptyState, ErrorState, Field, Input, PageHeader, Select, Skeleton, Textarea, cx } from "@/components/ui";
import { keys, useApplications, useResumes, useUpdateApplication } from "@/hooks/data";
import { STATUS_LABELS, STATUS_ORDER, formatDate, parseDate, relativeTime, toInputDate, toInputDateTime } from "@/lib/format";

const COLUMN_STYLE: Record<AppStatus, string> = {
  a_postuler: "bg-sand",
  postule: "bg-info/15",
  relance: "bg-accent/30",
  entretien: "bg-accent",
  refus: "bg-danger/10",
  offre: "bg-success/15",
};

export default function ApplicationsPage() {
  const { data, isLoading, isError, error, refetch } = useApplications();
  const update = useUpdateApplication();
  const [openId, setOpenId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));

  const onDragEnd = (e: DragEndEvent) => {
    const id = Number(e.active.id);
    const status = e.over?.id as AppStatus | undefined;
    const app = data?.find((a) => a.id === id);
    if (app && status && status !== app.status) {
      update.mutate({ id, status });
      toast(`Déplacée vers « ${STATUS_LABELS[status]} »`);
    }
  };

  const opened = data?.find((a) => a.id === openId) ?? null;

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Candidatures"
        subtitle="Glissez une carte d'une colonne à l'autre, ou utilisez le menu « Étape » de chaque carte."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>
            Ajouter une candidature
          </Button>
        }
      />
      {isError && <ErrorState message={(error as Error).message} onRetry={() => refetch()} />}
      {isLoading && (
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          {STATUS_ORDER.map((s) => (
            <Skeleton key={s} className="h-64" />
          ))}
        </div>
      )}
      {data && data.length === 0 && (
        <EmptyState icon={<KanbanSquare className="h-6 w-6" />} title="Aucune candidature pour l'instant" action={<Button onClick={() => setAdding(true)}>Ajouter une candidature</Button>}>
          Quand vous postulez depuis une offre, elle s'ajoute ici automatiquement.
        </EmptyState>
      )}
      {data && data.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
          <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-4 scroll-thin md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 2xl:grid-cols-6">
            {STATUS_ORDER.map((status) => (
              <Column key={status} status={status} items={data.filter((a) => a.status === status)} onOpen={setOpenId} onMove={(id, s) => update.mutate({ id, status: s })} />
            ))}
          </div>
        </DndContext>
      )}
      {opened && <ApplicationDialog app={opened} onClose={() => setOpenId(null)} />}
      <AddDialog open={adding} onOpenChange={setAdding} />
    </div>
  );
}

function Column({ status, items, onOpen, onMove }: { status: AppStatus; items: Application[]; onOpen: (id: number) => void; onMove: (id: number, s: AppStatus) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      aria-label={`${STATUS_LABELS[status]} : ${items.length}`}
      className={cx("flex w-[80vw] max-w-xs shrink-0 snap-start flex-col rounded-3xl border border-line/70 bg-sand/35 p-3 transition-colors md:w-auto md:max-w-none", isOver && "border-accent-strong bg-accent/10")}
    >
      <header className="mb-3 flex items-center justify-between px-1">
        <h2 className="flex items-center gap-2 font-sans text-base font-semibold">
          <span className={cx("h-3 w-3 rounded-full", COLUMN_STYLE[status])} aria-hidden />
          {STATUS_LABELS[status]}
        </h2>
        <span className="tabular rounded-full bg-surface px-2 text-sm text-muted">{items.length}</span>
      </header>
      <ul className="flex min-h-24 flex-col gap-2.5">
        {items.map((a) => (
          <AppCard key={a.id} app={a} onOpen={() => onOpen(a.id)} onMove={(s) => onMove(a.id, s)} />
        ))}
        {items.length === 0 && <li className="rounded-2xl border border-dashed border-line p-4 text-center text-sm text-muted">Déposez une carte ici</li>}
      </ul>
    </section>
  );
}

function AppCard({ app, onOpen, onMove }: { app: Application; onOpen: () => void; onMove: (s: AppStatus) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: String(app.id) });
  const due = app.follow_up_at && parseDate(app.follow_up_at)! <= new Date() && ["postule", "relance"].includes(app.status);
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cx("rounded-2xl border border-line/80 bg-surface p-3.5 shadow-soft", isDragging && "z-10 rotate-1 shadow-lift")}
    >
      <div className="flex items-start gap-2">
        <button {...listeners} {...attributes} className="mt-0.5 cursor-grab rounded-md p-0.5 text-muted hover:bg-sand active:cursor-grabbing" aria-label={`Déplacer ${app.title}`}>
          <GripVertical className="h-4 w-4" />
        </button>
        <button onClick={onOpen} className="min-w-0 flex-1 text-left">
          <p className="font-semibold leading-snug">{app.title}</p>
          {app.company && <p className="text-sm text-muted">{app.company}</p>}
        </button>
      </div>
      <div className="mt-2 flex flex-col gap-1 pl-7 text-sm">
        {app.interview_at && (
          <span className="inline-flex items-center gap-1.5 font-medium">
            <CalendarClock className="h-4 w-4" aria-hidden /> {formatDate(app.interview_at, true)}
          </span>
        )}
        {app.follow_up_at && ["postule", "relance"].includes(app.status) && (
          <span className={cx("inline-flex items-center gap-1.5", due ? "font-semibold text-warning" : "text-muted")}>
            <BellRing className="h-4 w-4" aria-hidden /> Relance {relativeTime(app.follow_up_at)}
          </span>
        )}
        {app.resume_name && (
          <span className="inline-flex items-center gap-1.5 text-muted">
            <FileText className="h-4 w-4" aria-hidden /> <span className="truncate">{app.resume_name}</span>
          </span>
        )}
        {app.notes && <p className="line-clamp-2 text-ink/80">{app.notes}</p>}
      </div>
      <label className="mt-2 flex items-center gap-2 pl-7 text-sm text-muted">
        Étape
        <select value={app.status} onChange={(e) => onMove(e.target.value as AppStatus)} className="rounded-lg border border-line bg-surface px-1.5 py-0.5 text-ink">
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
    </li>
  );
}

function ApplicationDialog({ app, onClose }: { app: Application; onClose: () => void }) {
  const [notes, setNotes] = useState(app.notes);
  const [followUp, setFollowUp] = useState(toInputDate(app.follow_up_at));
  const [interview, setInterview] = useState(toInputDateTime(app.interview_at));
  const [resumeId, setResumeId] = useState(app.resume_id ?? 0);
  const update = useUpdateApplication();
  const resumes = useResumes();
  const qc = useQueryClient();
  const remove = useMutation({
    mutationFn: () => api.del(`/api/applications/${app.id}`),
    onSuccess: () => {
      toast("Candidature supprimée");
      qc.invalidateQueries({ queryKey: keys.applications });
      onClose();
    },
  });

  const save = () => {
    update.mutate(
      {
        id: app.id,
        notes,
        ...(followUp ? { follow_up_at: new Date(`${followUp}T09:00`).toISOString() } : { clear_follow_up: true }),
        ...(interview ? { interview_at: new Date(interview).toISOString() } : {}),
        ...(resumeId ? { resume_id: resumeId } : {}),
      },
      { onSuccess: () => (toast.success("Enregistré"), onClose()) },
    );
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} title={app.title} description={[app.company, STATUS_LABELS[app.status]].filter(Boolean).join(" · ")} wide>
      <div className="grid gap-5 md:grid-cols-[1.3fr_1fr]">
        <div className="flex flex-col gap-4">
          <Field label="Notes">{(id) => <Textarea id={id} rows={7} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Personne contactée, questions posées, impressions…" />}</Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date de relance" hint="Un rappel s'affichera ce jour-là.">
              {(id) => <Input id={id} type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} />}
            </Field>
            <Field label="Entretien">{(id) => <Input id={id} type="datetime-local" value={interview} onChange={(e) => setInterview(e.target.value)} />}</Field>
          </div>
          <Field label="CV utilisé">
            {(id) => (
              <Select id={id} value={resumeId} onChange={(e) => setResumeId(Number(e.target.value))}>
                <option value={0}>Non précisé</option>
                {resumes.data?.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <div className="flex flex-col gap-4">
          {app.offer_url && (
            <a href={app.offer_url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-2 font-medium underline decoration-accent decoration-2 underline-offset-4">
              <ExternalLink className="h-4 w-4" aria-hidden /> Voir l'annonce
            </a>
          )}
          {app.cover_letter && (
            <details className="rounded-2xl border border-line p-3">
              <summary className="cursor-pointer font-medium">Lettre envoyée</summary>
              <p className="mt-2 whitespace-pre-line text-sm">{app.cover_letter}</p>
            </details>
          )}
          <div>
            <h3 className="mb-2 font-sans text-base font-semibold">Historique</h3>
            <ol className="flex flex-col gap-2 border-l-2 border-line pl-4">
              {app.events.map((e) => (
                <li key={e.id} className="text-sm">
                  <p>{e.message}</p>
                  <p className="text-muted">{formatDate(e.created_at, true)}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap justify-between gap-2 border-t border-line pt-4">
        <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => confirm("Supprimer cette candidature ?") && remove.mutate()}>
          Supprimer
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={save} loading={update.isPending}>
            Enregistrer
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function AddDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState<AppStatus>("a_postuler");
  const qc = useQueryClient();
  const add = useMutation({
    mutationFn: () => api.post("/api/applications", { title, company: company || null, status }),
    onSuccess: () => {
      toast.success("Candidature ajoutée");
      qc.invalidateQueries({ queryKey: keys.applications });
      setTitle("");
      setCompany("");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Ajouter une candidature" description="Pour une candidature faite en dehors de FormyWork (salon, réseau, candidature spontanée…).">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate();
        }}
      >
        <Field label="Poste">{(id) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} required />}</Field>
        <Field label="Entreprise">{(id) => <Input id={id} value={company} onChange={(e) => setCompany(e.target.value)} />}</Field>
        <Field label="Étape">
          {(id) => (
            <Select id={id} value={status} onChange={(e) => setStatus(e.target.value as AppStatus)}>
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="submit" loading={add.isPending} disabled={!title.trim()}>
            Ajouter
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
