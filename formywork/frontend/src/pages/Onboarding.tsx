import { useQueryClient } from "@tanstack/react-query";
import { Check, FileUp, GraduationCap, Repeat, Search, Sparkles, Star } from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { api } from "@/api/client";
import type { ProfileType, Resume, SavedSearch, User } from "@/api/types";
import { Logo } from "@/components/Layout";
import { Button, Card, Field, Input, Select, cx } from "@/components/ui";
import { keys } from "@/hooks/data";
import { PROFILE_LABELS } from "@/lib/format";

const STEPS = ["Votre CV", "Votre profil", "Première recherche"];
const PROFILE_ICONS = { alternant: GraduationCap, debutant: Repeat, confirme: Star, senior: Sparkles };

export default function Onboarding({ user }: { user: User }) {
  const [step, setStep] = useState(0);
  const [resume, setResume] = useState<Resume | null>(null);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState<ProfileType>(user.profile_type);
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [contract, setContract] = useState(user.profile_type === "alternant" ? "alternance" : "");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const upload = async (file: File) => {
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const r = await api.upload<Resume>("/api/resumes/import", form);
      setResume(r);
      toast.success("CV importé", { description: `Score de lisibilité ATS : ${r.score}/100` });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const finish = async () => {
    setSaving(true);
    try {
      await api.patch("/api/me", { profile_type: profile });
      let target = "/offres";
      if (query.trim() || location.trim()) {
        const s = await api.post<SavedSearch>("/api/searches", {
          name: [query.trim() || "Toutes les offres", location.trim()].filter(Boolean).join(" – "),
          params: { query, location, radius_km: 20, contract, max_days: 0, remote: "" },
        });
        target = `/offres?recherche=${s.id}`;
      }
      const updated = await api.patch<User>("/api/me", { onboarded: true });
      qc.setQueryData(keys.me, updated);
      qc.invalidateQueries();
      navigate(target);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-5 py-8">
      <Logo />
      <ol className="mt-10 flex items-center gap-2" aria-label="Étapes">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2" aria-current={i === step ? "step" : undefined}>
            <span
              className={cx(
                "tabular grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 font-semibold transition-colors",
                i < step ? "border-success bg-success text-bg" : i === step ? "border-accent-strong bg-accent text-on-accent" : "border-line text-muted",
              )}
            >
              {i < step ? <Check className="h-4 w-4" aria-label="terminée" /> : i + 1}
            </span>
            <span className={cx("hidden text-sm sm:block", i === step ? "font-semibold" : "text-muted")}>{label}</span>
            {i < STEPS.length - 1 && <span className="h-0.5 flex-1 rounded bg-line" aria-hidden />}
          </li>
        ))}
      </ol>

      <div key={step} className="mt-10 flex-1 animate-fade-up">
        {step === 0 && (
          <section>
            <h1 className="text-4xl">Bonjour {user.display_name} 👋</h1>
            <p className="mt-2 text-lg text-muted">Commençons par votre CV. Nous allons vérifier qu'il est bien lisible par les logiciels de recrutement.</p>
            <Card className="mt-8 flex flex-col items-center gap-4 border-dashed py-10 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-2xl bg-sand">
                <FileUp className="h-8 w-8" strokeWidth={1.5} aria-hidden />
              </span>
              {resume ? (
                <>
                  <p className="text-lg font-medium">« {resume.name} » est importé.</p>
                  <p className="text-muted">
                    Score ATS de départ : <strong className="tabular text-ink">{resume.score}/100</strong>. Vous pourrez l'améliorer dans « Mes CV ».
                  </p>
                </>
              ) : (
                <>
                  <p className="text-lg">Choisissez votre CV (PDF, Word ou texte)</p>
                  <p className="text-sm text-muted">5 Mo maximum. Il reste sur votre ordinateur.</p>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx,.txt"
                className="sr-only"
                onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
                aria-label="Choisir mon CV"
              />
              <Button variant={resume ? "secondary" : "primary"} loading={uploading} onClick={() => fileRef.current?.click()}>
                {resume ? "Choisir un autre fichier" : "Choisir mon CV"}
              </Button>
            </Card>
          </section>
        )}

        {step === 1 && (
          <section>
            <h1 className="text-4xl">Quelle est votre situation ?</h1>
            <p className="mt-2 text-lg text-muted">Les conseils et les adaptations de CV seront ajustés à votre profil.</p>
            <div role="radiogroup" aria-label="Profil" className="mt-8 grid gap-3 sm:grid-cols-2">
              {(Object.keys(PROFILE_LABELS) as ProfileType[]).map((key) => {
                const Icon = PROFILE_ICONS[key];
                const selected = profile === key;
                return (
                  <button
                    key={key}
                    role="radio"
                    aria-checked={selected}
                    onClick={() => {
                      setProfile(key);
                      if (key === "alternant") setContract("alternance");
                    }}
                    className={cx(
                      "flex items-start gap-4 rounded-2xl border-2 bg-surface p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-soft",
                      selected ? "border-accent-strong shadow-soft" : "border-line",
                    )}
                  >
                    <span className={cx("grid h-11 w-11 shrink-0 place-items-center rounded-xl", selected ? "bg-accent text-on-accent" : "bg-sand")}>
                      <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                    </span>
                    <span>
                      <span className="block font-semibold">{PROFILE_LABELS[key].title}</span>
                      <span className="text-muted">{PROFILE_LABELS[key].hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {step === 2 && (
          <section>
            <h1 className="text-4xl">Que recherchez-vous ?</h1>
            <p className="mt-2 text-lg text-muted">Nous gardons cette recherche et vous prévenons dès qu'une nouvelle offre arrive.</p>
            <Card className="mt-8 grid gap-4 sm:grid-cols-2">
              <Field label="Métier ou mots-clés" hint="Par exemple : assistante administrative">
                {(id) => <Input id={id} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Métier, compétence…" />}
              </Field>
              <Field label="Ville ou code postal">{(id) => <Input id={id} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Lyon" />}</Field>
              <Field label="Type de contrat">
                {(id) => (
                  <Select id={id} value={contract} onChange={(e) => setContract(e.target.value)}>
                    <option value="">Tous les contrats</option>
                    <option value="alternance">Alternance</option>
                    <option value="cdi">CDI</option>
                    <option value="cdd">CDD</option>
                    <option value="interim">Intérim</option>
                    <option value="stage">Stage</option>
                  </Select>
                )}
              </Field>
            </Card>
          </section>
        )}
      </div>

      <div className="sticky bottom-0 mt-10 flex items-center justify-between gap-3 bg-bg/90 py-4 backdrop-blur">
        <Button variant="ghost" onClick={() => (step === 0 ? setStep(1) : setStep(step - 1))}>
          {step === 0 ? "Passer cette étape" : "Retour"}
        </Button>
        {step < 2 ? (
          <Button size="lg" onClick={() => setStep(step + 1)}>
            Continuer
          </Button>
        ) : (
          <Button size="lg" loading={saving} onClick={finish} icon={<Search className="h-5 w-5" />}>
            Voir les offres
          </Button>
        )}
      </div>
    </div>
  );
}
