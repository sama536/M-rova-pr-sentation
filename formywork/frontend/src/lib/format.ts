import type { AppStatus } from "@/api/types";

export const CONTRACT_LABELS: Record<string, string> = {
  cdi: "CDI",
  cdd: "CDD",
  alternance: "Alternance",
  stage: "Stage",
  interim: "Intérim",
  freelance: "Indépendant",
  autre: "Autre contrat",
};

export const REMOTE_LABELS: Record<string, string> = {
  partiel: "Télétravail partiel",
  total: "100 % télétravail",
  non: "Sur place",
  inconnu: "",
};

export const STATUS_LABELS: Record<AppStatus, string> = {
  a_postuler: "À postuler",
  postule: "Postulé",
  relance: "Relance",
  entretien: "Entretien",
  refus: "Refus",
  offre: "Offre",
};

export const STATUS_ORDER: AppStatus[] = ["a_postuler", "postule", "relance", "entretien", "refus", "offre"];

export const PROFILE_LABELS = {
  alternant: { title: "Alternant ou étudiant", hint: "Je cherche une alternance, un stage ou un premier emploi." },
  debutant: { title: "Débutant ou en reconversion", hint: "Je change de métier ou je débute dans un domaine." },
  confirme: { title: "Expérimenté", hint: "J'ai plusieurs années d'expérience dans mon métier." },
  senior: { title: "Senior (50 ans et plus)", hint: "Je valorise une longue carrière et mon expérience." },
} as const;

/** Les dates du serveur sont en UTC sans fuseau : on l'ajoute. */
export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`);
}

export function relativeTime(value: string | null | undefined): string {
  const d = parseDate(value);
  if (!d) return "";
  const diff = (Date.now() - d.getTime()) / 1000;
  const future = diff < 0;
  const s = Math.abs(diff);
  const fmt = (n: number, unit: string) => (future ? `dans ${n} ${unit}` : `il y a ${n} ${unit}`);
  if (s < 60) return future ? "dans un instant" : "à l'instant";
  if (s < 3600) return fmt(Math.round(s / 60), "min");
  if (s < 86400) return fmt(Math.round(s / 3600), "h");
  const days = Math.round(s / 86400);
  if (days === 1) return future ? "demain" : "hier";
  if (days < 31) return fmt(days, "jours");
  return formatDate(value);
}

export function formatDate(value: string | null | undefined, withTime = false): string {
  const d = parseDate(value);
  if (!d) return "";
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function toInputDate(value: string | null | undefined): string {
  const d = parseDate(value);
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function greeting(): string {
  const h = new Date().getHours();
  return h < 5 ? "Bonsoir" : h < 18 ? "Bonjour" : "Bonsoir";
}

export function toInputDateTime(value: string | null | undefined): string {
  const d = parseDate(value);
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${toInputDate(value)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
