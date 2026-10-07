import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FilePlus2, FileText, FileUp, Target, Trash2 } from "lucide-react";
import { useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { api } from "@/api/client";
import type { Resume, ResumeData } from "@/api/types";
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, ScoreRing, Skeleton } from "@/components/ui";
import { keys, useResumes } from "@/hooks/data";
import { relativeTime } from "@/lib/format";

export const EMPTY_RESUME: ResumeData = {
  contact: { full_name: "", headline: "", email: "", phone: "", city: "", links: [] },
  summary: "",
  experiences: [],
  education: [],
  skills: [],
  languages: [],
  certifications: [],
  interests: [],
  import_flags: {},
};

export default function ResumesPage() {
  const { data, isLoading, isError, error, refetch } = useResumes();
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const importFile = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return api.upload<Resume>("/api/resumes/import", form);
    },
    onSuccess: (r) => {
      toast.success("CV importé", { description: "Vérifiez les informations reconnues." });
      qc.invalidateQueries({ queryKey: keys.resumes });
      navigate(`/cv/${r.id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const create = useMutation({
    mutationFn: () => api.post<Resume>("/api/resumes", { name: "Nouveau CV", data: EMPTY_RESUME }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: keys.resumes });
      navigate(`/cv/${r.id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.del(`/api/resumes/${id}`),
    onSuccess: () => {
      toast("CV supprimé");
      qc.invalidateQueries({ queryKey: keys.resumes });
    },
  });

  const bases = data?.filter((r) => r.is_base) ?? [];
  const variants = data?.filter((r) => !r.is_base) ?? [];

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Mes CV"
        subtitle="Un CV principal, puis des versions adaptées à chaque offre. Rien n'est inventé."
        actions={
          <>
            <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" className="sr-only" aria-label="Importer un CV" onChange={(e) => e.target.files?.[0] && importFile.mutate(e.target.files[0])} />
            <Button variant="secondary" icon={<FileUp className="h-4 w-4" />} loading={importFile.isPending} onClick={() => fileRef.current?.click()}>
              Importer (PDF, Word, texte)
            </Button>
            <Button icon={<FilePlus2 className="h-4 w-4" />} loading={create.isPending} onClick={() => create.mutate()}>
              Créer un CV
            </Button>
          </>
        }
      />
      {isError && <ErrorState message={(error as Error).message} onRetry={() => refetch()} />}
      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      )}
      {data && data.length === 0 && (
        <EmptyState icon={<FileText className="h-6 w-6" />} title="Aucun CV pour l'instant" action={<Button onClick={() => fileRef.current?.click()}>Importer mon CV</Button>}>
          Importez votre CV actuel : nous le découpons en sections et vérifions sa lisibilité par les logiciels de recrutement (ATS).
        </EmptyState>
      )}

      {bases.length > 0 && (
        <section className="mb-10" aria-labelledby="base-title">
          <h2 id="base-title" className="mb-3 text-2xl">
            CV principaux
          </h2>
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {bases.map((r) => (
              <ResumeCard key={r.id} r={r} onDelete={() => confirm(`Supprimer « ${r.name} » ?`) && remove.mutate(r.id)} />
            ))}
          </ul>
        </section>
      )}
      {variants.length > 0 && (
        <section aria-labelledby="variants-title">
          <h2 id="variants-title" className="mb-3 text-2xl">
            Versions adaptées aux offres
          </h2>
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {variants.map((r) => (
              <ResumeCard key={r.id} r={r} onDelete={() => confirm(`Supprimer « ${r.name} » ?`) && remove.mutate(r.id)} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ResumeCard({ r, onDelete }: { r: Resume; onDelete: () => void }) {
  return (
    <li>
      <Card className="flex h-full items-center gap-4 transition hover:-translate-y-0.5 hover:shadow-lift">
        <ScoreRing score={r.score} size={80} />
        <div className="min-w-0 flex-1">
          <Link to={`/cv/${r.id}`} className="font-semibold leading-snug hover:underline">
            {r.name}
          </Link>
          {r.offer_title && (
            <p className="mt-1 flex items-center gap-1 text-sm text-muted">
              <Target className="h-4 w-4 shrink-0" aria-hidden /> <span className="truncate">{r.offer_title}</span>
            </p>
          )}
          <p className="mt-1 text-sm text-muted">Modifié {relativeTime(r.updated_at)}</p>
          {r.adaptation && (
            <Badge tone="success" className="mt-2">
              <span className="tabular">
                {r.adaptation.score_before} → {r.adaptation.score_after}
              </span>
            </Badge>
          )}
        </div>
        <button onClick={onDelete} className="self-start rounded-lg p-2 text-muted hover:bg-sand hover:text-danger" aria-label={`Supprimer ${r.name}`}>
          <Trash2 className="h-4 w-4" />
        </button>
      </Card>
    </li>
  );
}
