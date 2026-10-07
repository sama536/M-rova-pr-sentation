import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Copy, Download, ExternalLink, FileText, Mail, Paperclip, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { api } from "@/api/client";
import type { Application, ApplyPrep, ApplyPreview, Offer } from "@/api/types";
import { formatDate } from "@/lib/format";
import { Badge, Button, Dialog, ErrorState, Field, Input, Spinner, Textarea } from "./ui";

type Step = "loading" | "error" | "edit" | "preview" | "sent" | "site";

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copié`);
  } catch {
    toast.error("Copie impossible : sélectionnez le texte et faites Ctrl+C.");
  }
}

export function ApplyDialog({ offer, open, onOpenChange }: { offer: Offer; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [step, setStep] = useState<Step>("loading");
  const [prep, setPrep] = useState<ApplyPrep | null>(null);
  const [error, setError] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [letter, setLetter] = useState("");
  const [attachLetter, setAttachLetter] = useState(true);
  const [preview, setPreview] = useState<ApplyPreview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const qc = useQueryClient();

  const load = async () => {
    setStep("loading");
    try {
      const p = await api.post<ApplyPrep>("/api/apply/prepare", { offer_id: offer.id });
      setPrep(p);
      setSubject(p.subject);
      setBody(p.body);
      setLetter(p.letter);
      setStep(p.method === "email" ? "edit" : "site");
      qc.invalidateQueries({ queryKey: ["resumes"] });
    } catch (e) {
      setError((e as Error).message);
      setStep("error");
    }
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const refreshAll = () => {
    ["applications", "dashboard", "offers", "search-offers"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    qc.invalidateQueries({ queryKey: ["offer", offer.id] });
  };

  const toPreview = async () => {
    if (!prep) return;
    setBusy(true);
    try {
      const p = await api.post<ApplyPreview>("/api/apply/preview", {
        offer_id: offer.id, resume_id: prep.resume_id, subject, body, letter, attach_letter: attachLetter, fingerprint: "x".repeat(16),
      });
      setPreview(p);
      setConfirmed(false);
      setStep("preview");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    if (!prep || !preview) return;
    setBusy(true);
    try {
      await api.post<Application>("/api/apply/send", {
        offer_id: offer.id, resume_id: prep.resume_id, subject, body, letter, attach_letter: attachLetter,
        fingerprint: preview.fingerprint, confirm: true, allow_duplicate: allowDuplicate,
      });
      setStep("sent");
      refreshAll();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const markApplied = async () => {
    if (!prep) return;
    setBusy(true);
    try {
      await api.post<Application>("/api/apply/mark", { offer_id: offer.id, resume_id: prep.resume_id, letter, allow_duplicate: allowDuplicate });
      setStep("sent");
      refreshAll();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const blockedByDuplicate = !!prep?.already_applied && !allowDuplicate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Postuler" description={`${offer.title}${offer.company ? ` · ${offer.company}` : ""}`} wide>
      {step === "loading" && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <Spinner label="Préparation de votre candidature…" />
          <p className="max-w-sm text-sm text-muted">Nous choisissons votre CV, l'adaptons à l'offre (sans rien inventer) et préparons la lettre.</p>
        </div>
      )}
      {step === "error" && <ErrorState message={error} onRetry={load} />}

      {prep && (step === "edit" || step === "site" || step === "preview") && (
        <div className="mb-5 flex flex-col gap-3">
          {prep.already_applied && (
            <div role="alert" className="flex flex-col gap-2 rounded-2xl border border-warning/40 bg-warning/10 p-4">
              <p className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-5 w-5" aria-hidden /> Vous avez déjà postulé à cette offre
                {prep.already_applied_at ? ` le ${formatDate(prep.already_applied_at)}` : ""}.
              </p>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={allowDuplicate} onChange={(e) => setAllowDuplicate(e.target.checked)} className="h-5 w-5 accent-[rgb(var(--accent-strong))]" />
                Je veux vraiment postuler une deuxième fois
              </label>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-sand/60 p-4">
            <FileText className="h-6 w-6 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-medium">CV utilisé : {prep.resume_name}</p>
              {prep.score_before != null && prep.score_after != null && (
                <p className="tabular text-sm text-muted">
                  Score ATS pour cette offre : {prep.score_before} → <strong className="text-ink">{prep.score_after}</strong>/100
                </p>
              )}
            </div>
            <Link to={`/cv/${prep.resume_id}`} className="text-sm font-medium underline decoration-accent decoration-2 underline-offset-4">
              Voir / modifier
            </Link>
            <a href={`/api/resumes/${prep.resume_id}/export.pdf`} className="inline-flex items-center gap-1 text-sm font-medium underline decoration-accent decoration-2 underline-offset-4">
              <Download className="h-4 w-4" aria-hidden /> PDF
            </a>
          </div>
          {prep.points.length > 0 && (
            <details className="rounded-2xl border border-line p-4">
              <summary className="cursor-pointer font-medium">Points à vérifier ({prep.points.length})</summary>
              <ul className="mt-2 list-disc pl-5 text-sm text-ink/90">
                {prep.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {prep && step === "edit" && (
        <div className="flex flex-col gap-4">
          <p className="flex items-center gap-2 rounded-xl bg-info/10 px-3 py-2 text-sm text-info">
            <Mail className="h-4 w-4 shrink-0" aria-hidden /> Cette offre accepte les candidatures par e-mail : {prep.to}
          </p>
          <Field label="Objet de l'e-mail">{(id) => <Input id={id} value={subject} onChange={(e) => setSubject(e.target.value)} />}</Field>
          <Field label="Message">{(id) => <Textarea id={id} rows={7} value={body} onChange={(e) => setBody(e.target.value)} />}</Field>
          <Field label="Lettre de motivation (jointe en PDF)" hint="Relisez et complétez les passages entre crochets [ ].">
            {(id) => <Textarea id={id} rows={10} value={letter} onChange={(e) => setLetter(e.target.value)} />}
          </Field>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={attachLetter} onChange={(e) => setAttachLetter(e.target.checked)} className="h-5 w-5 accent-[rgb(var(--accent-strong))]" />
            Joindre la lettre de motivation
          </label>
          {!prep.mail.ready && <p className="rounded-xl bg-warning/10 p-3 text-warning">{prep.mail.label}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setStep("site")}>
              Postuler plutôt sur le site
            </Button>
            <Button onClick={toPreview} loading={busy} disabled={!prep.mail.ready || blockedByDuplicate || !subject.trim() || !body.trim()}>
              Vérifier avant l'envoi
            </Button>
          </div>
        </div>
      )}

      {prep && step === "preview" && preview && (
        <div className="flex flex-col gap-4">
          <h3 className="flex items-center gap-2 font-sans text-lg font-semibold">
            <ShieldCheck className="h-5 w-5" aria-hidden /> Voici exactement ce qui va partir
          </h3>
          {preview.mail.mode === "simulation" && <Badge tone="warning">{preview.mail.label}</Badge>}
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-2xl border border-line bg-surface p-4">
            <dt className="text-muted">De</dt>
            <dd className="font-medium">{preview.from}</dd>
            <dt className="text-muted">À</dt>
            <dd className="font-medium">{preview.to}</dd>
            <dt className="text-muted">Objet</dt>
            <dd className="font-medium">{preview.subject}</dd>
            <dt className="text-muted">Pièces jointes</dt>
            <dd className="flex flex-col gap-1">
              {preview.attachments.map((a) => (
                <span key={a} className="inline-flex items-center gap-1.5">
                  <Paperclip className="h-4 w-4" aria-hidden /> {a}
                </span>
              ))}
            </dd>
          </dl>
          <div className="max-h-56 overflow-y-auto whitespace-pre-line rounded-2xl border border-line bg-surface p-4 scroll-thin">{preview.body}</div>
          <label className="flex items-start gap-3 rounded-2xl bg-sand/60 p-4">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1 h-5 w-5 accent-[rgb(var(--accent-strong))]" />
            <span>J'ai tout relu et je confirme l'envoi de cette candidature à {preview.to}.</span>
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setStep("edit")}>
              Modifier
            </Button>
            <Button variant="accent" size="lg" onClick={send} loading={busy} disabled={!confirmed}>
              {preview.mail.mode === "simulation" ? "Simuler l'envoi" : "Envoyer ma candidature"}
            </Button>
          </div>
        </div>
      )}

      {prep && step === "site" && (
        <div className="flex flex-col gap-4">
          <p className="rounded-xl bg-info/10 px-3 py-2 text-sm text-info">
            Cette offre se postule sur le site du recruteur. Tout est prêt ci-dessous : copiez, collez, c'est vous qui envoyez.
          </p>
          <ol className="flex flex-col gap-4">
            <li className="rounded-2xl border border-line p-4">
              <p className="font-medium">1. Téléchargez votre CV adapté</p>
              <a href={`/api/resumes/${prep.resume_id}/export.pdf`} className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 font-medium text-on-primary">
                <Download className="h-4 w-4" aria-hidden /> Télécharger le CV (PDF)
              </a>
            </li>
            <li className="rounded-2xl border border-line p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">2. Lettre de motivation</p>
                <Button size="sm" variant="secondary" icon={<Copy className="h-4 w-4" />} onClick={() => copy(letter, "Lettre")}>
                  Copier
                </Button>
              </div>
              <Textarea aria-label="Lettre de motivation" rows={8} value={letter} onChange={(e) => setLetter(e.target.value)} className="mt-2" />
            </li>
            <li className="rounded-2xl border border-line p-4">
              <p className="font-medium">3. Réponses types aux questions fréquentes</p>
              <ul className="mt-2 flex flex-col gap-3">
                {prep.answers.map((a) => (
                  <li key={a.question} className="rounded-xl bg-sand/50 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{a.question}</p>
                      <button className="shrink-0 rounded-lg p-1.5 hover:bg-surface" aria-label={`Copier la réponse : ${a.question}`} onClick={() => copy(a.answer, "Réponse")}>
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="mt-1 text-sm text-ink/90">{a.answer}</p>
                  </li>
                ))}
              </ul>
            </li>
            <li className="rounded-2xl border border-line p-4">
              <p className="font-medium">4. Ouvrez la page officielle et postulez</p>
              {prep.site_url ? (
                <a href={prep.site_url} target="_blank" rel="noreferrer noopener" className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 font-medium hover:border-ink/30">
                  <ExternalLink className="h-4 w-4" aria-hidden /> Ouvrir la page de l'offre <span className="sr-only">(nouvel onglet)</span>
                </a>
              ) : (
                <p className="text-muted">Lien de candidature non fourni par la source.</p>
              )}
            </li>
          </ol>
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
            {prep.to && (
              <Button variant="ghost" onClick={() => setStep("edit")}>
                Revenir à l'envoi par e-mail
              </Button>
            )}
            <Button variant="accent" size="lg" onClick={markApplied} loading={busy} disabled={blockedByDuplicate} icon={<CheckCircle2 className="h-5 w-5" />}>
              J'ai bien postulé
            </Button>
          </div>
        </div>
      )}

      {step === "sent" && (
        <div className="flex flex-col items-center gap-3 py-10 text-center animate-fade-up">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-success/15 text-success">
            <CheckCircle2 className="h-9 w-9" aria-hidden />
          </span>
          <h3 className="text-2xl">Candidature enregistrée</h3>
          <p className="max-w-sm text-muted">Elle apparaît dans « Postulé ». Un rappel de relance est prévu dans 7 jours.</p>
          <div className="mt-2 flex gap-2">
            <Link to="/candidatures">
              <Button variant="secondary">Mes candidatures</Button>
            </Link>
            <Button onClick={() => onOpenChange(false)}>Fermer</Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
