// Types de l'API REST FormyWork (miroir de backend/app/schemas.py).

export type ProfileType = "alternant" | "debutant" | "confirme" | "senior";
export type ContractType = "" | "cdi" | "cdd" | "alternance" | "stage" | "interim" | "freelance";
export type AppStatus = "a_postuler" | "postule" | "relance" | "entretien" | "refus" | "offre";

export interface User {
  id: number;
  email: string;
  display_name: string;
  profile_type: ProfileType;
  onboarded: boolean;
  preferences: Record<string, unknown>;
}

export interface AuthStatus {
  users: number;
  max_users: number;
  can_register: boolean;
  demo_mode: boolean;
  demo_login: { email: string; password: string } | null;
}

export interface SearchParams {
  query: string;
  location: string;
  radius_km: number;
  contract: ContractType;
  max_days: number;
  remote: "" | "partiel" | "total";
}

export interface Offer {
  id: number;
  source: string;
  source_label: string;
  also_on: string[];
  title: string;
  company: string | null;
  location: string | null;
  contract_type: string;
  is_alternance: boolean;
  remote: string;
  salary: string | null;
  url: string | null;
  apply_email: string | null;
  apply_url: string | null;
  published_at: string | null;
  first_seen_at: string;
  expired: boolean;
  is_new: boolean;
  favorite: boolean;
  hidden: boolean;
  summary: string[] | null;
  keywords: string[] | null;
  summary_by: string | null;
  application_status: AppStatus | null;
  description?: string;
}

export interface SourceReport {
  name: string;
  label: string;
  ok: boolean;
  count: number;
  error: string | null;
  skipped?: boolean;
}

export interface SearchResult {
  offers: Offer[];
  sources: SourceReport[];
  location_found: boolean | null;
}

export interface SavedSearch {
  id: number;
  name: string;
  params: SearchParams;
  auto_refresh: boolean;
  last_run_at: string | null;
  new_count: number;
}

export interface SourceStatus {
  name: string;
  label: string;
  kind: "api" | "scraping" | "demo";
  configured: boolean;
  last_success_at: string | null;
  last_error: string | null;
  last_error_at: string | null;
  last_count: number;
  blocked_until: string | null;
  calls_today: number;
}

export interface Experience {
  title: string;
  company: string;
  location: string;
  start: string;
  end: string;
  current: boolean;
  bullets: string[];
}
export interface Education {
  degree: string;
  school: string;
  location: string;
  start: string;
  end: string;
  details: string;
}
export interface ResumeData {
  contact: { full_name: string; headline: string; email: string; phone: string; city: string; links: string[] };
  summary: string;
  experiences: Experience[];
  education: Education[];
  skills: string[];
  languages: { name: string; level: string }[];
  certifications: string[];
  interests: string[];
  import_flags: Record<string, boolean>;
}

export interface Adaptation {
  changes: string[];
  points: string[];
  generated_by: string;
  score_before: number;
  score_after: number;
  keywords_missing: string[];
  letter: string | null;
  email_message: string | null;
  letter_by: string | null;
}

export interface Resume {
  id: number;
  name: string;
  data: ResumeData;
  is_base: boolean;
  parent_id: number | null;
  offer_id: number | null;
  offer_title: string | null;
  adaptation: Adaptation | null;
  created_at: string;
  updated_at: string;
  score: number;
}

export interface AtsCheck {
  id: string;
  category: string;
  status: "ok" | "warning" | "error" | "info";
  title: string;
  detail: string;
  fix: string | null;
  points: number;
  max_points: number;
}

export interface AtsReport {
  score: number;
  categories: { id: string; label: string; score: number; max: number }[];
  checks: AtsCheck[];
  keywords_matched: string[];
  keywords_missing: string[];
  profile_tips: string[];
}

export interface ApplicationEvent {
  id: number;
  kind: string;
  message: string;
  created_at: string;
}

export interface Application {
  id: number;
  offer_id: number | null;
  resume_id: number | null;
  resume_name: string | null;
  title: string;
  company: string | null;
  status: AppStatus;
  notes: string;
  cover_letter: string | null;
  applied_at: string | null;
  follow_up_at: string | null;
  interview_at: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  offer_url: string | null;
  events: ApplicationEvent[];
}

export interface MailStatus {
  mode: "smtp" | "simulation" | "none";
  ready: boolean;
  sender: string | null;
  label: string;
}

export interface ApplyPrep {
  offer_id: number;
  method: "email" | "site";
  to: string | null;
  site_url: string | null;
  resume_id: number;
  resume_name: string;
  score_before: number | null;
  score_after: number | null;
  points: string[];
  subject: string;
  body: string;
  letter: string;
  attachments: string[];
  answers: { question: string; answer: string }[];
  mail: MailStatus;
  already_applied: boolean;
  already_applied_at: string | null;
}

export interface ApplyPreview {
  from: string | null;
  to: string;
  subject: string;
  body: string;
  attachments: string[];
  fingerprint: string;
  mail: MailStatus;
}

export interface Dashboard {
  counts: Record<AppStatus, number>;
  follow_ups: Application[];
  interviews: Application[];
  new_offers: Offer[];
  new_offers_total: number;
  resume: { id: number; name: string; score: number } | null;
  searches: number;
}

export interface SettingsStatus {
  demo_mode: boolean;
  ai: { enabled: boolean; model_summary: string; model_cv: string };
  mail: MailStatus;
  scraping_enabled: boolean;
  refresh_api_minutes: number;
  refresh_scraping_hours: number;
  sources: { name: string; label: string; kind: string; configured: boolean }[];
  max_upload_mb: number;
}
