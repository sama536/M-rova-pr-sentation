// Accès aux données (TanStack Query) : cache, états de chargement et d'erreur.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/api/client";
import type {
  Application,
  AuthStatus,
  Dashboard,
  Offer,
  Resume,
  SavedSearch,
  SettingsStatus,
  SourceStatus,
  User,
} from "@/api/types";

export const keys = {
  me: ["me"] as const,
  authStatus: ["auth-status"] as const,
  dashboard: ["dashboard"] as const,
  searches: ["searches"] as const,
  searchOffers: (id: number) => ["search-offers", id] as const,
  offers: (view: string) => ["offers", view] as const,
  offer: (id: number) => ["offer", id] as const,
  sources: ["sources"] as const,
  resumes: ["resumes"] as const,
  resume: (id: number) => ["resume", id] as const,
  applications: ["applications"] as const,
  settings: ["settings"] as const,
};

export const useAuthStatus = () => useQuery({ queryKey: keys.authStatus, queryFn: () => api.get<AuthStatus>("/api/auth/status") });
export const useMe = () =>
  useQuery({ queryKey: keys.me, queryFn: () => api.get<User>("/api/me"), retry: false, staleTime: 60_000 });
export const useDashboard = () => useQuery({ queryKey: keys.dashboard, queryFn: () => api.get<Dashboard>("/api/dashboard") });
export const useSearches = () => useQuery({ queryKey: keys.searches, queryFn: () => api.get<SavedSearch[]>("/api/searches") });
export const useSearchOffers = (id: number | null) =>
  useQuery({
    queryKey: keys.searchOffers(id ?? 0),
    queryFn: () => api.get<Offer[]>(`/api/searches/${id}/offers`),
    enabled: !!id,
  });
export const useOffers = (view: string, enabled = true) =>
  useQuery({ queryKey: keys.offers(view), queryFn: () => api.get<Offer[]>(`/api/offers?view=${view}`), enabled });
export const useOffer = (id: number | null) =>
  useQuery({ queryKey: keys.offer(id ?? 0), queryFn: () => api.get<Offer>(`/api/offers/${id}`), enabled: !!id });
export const useSources = () =>
  useQuery({ queryKey: keys.sources, queryFn: () => api.get<SourceStatus[]>("/api/sources"), refetchInterval: 60_000 });
export const useResumes = () => useQuery({ queryKey: keys.resumes, queryFn: () => api.get<Resume[]>("/api/resumes") });
export const useResume = (id: number | null) =>
  useQuery({ queryKey: keys.resume(id ?? 0), queryFn: () => api.get<Resume>(`/api/resumes/${id}`), enabled: !!id });
export const useApplications = () =>
  useQuery({ queryKey: keys.applications, queryFn: () => api.get<Application[]>("/api/applications") });
export const useSettingsStatus = () =>
  useQuery({ queryKey: keys.settings, queryFn: () => api.get<SettingsStatus>("/api/settings/status") });

export function useOfferState() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number; favorite?: boolean; hidden?: boolean }) =>
      api.patch(`/api/offers/${id}/state`, body),
    onSuccess: (_d, vars) => {
      if (vars.favorite !== undefined) toast.success(vars.favorite ? "Ajoutée aux favoris" : "Retirée des favoris");
      if (vars.hidden !== undefined) toast(vars.hidden ? "Offre masquée" : "Offre affichée de nouveau");
      qc.invalidateQueries({ queryKey: ["offers"] });
      qc.invalidateQueries({ queryKey: ["search-offers"] });
      qc.invalidateQueries({ queryKey: ["offer", vars.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<User>) => api.patch<User>("/api/me", body),
    onSuccess: (user) => qc.setQueryData(keys.me, user),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number } & Record<string, unknown>) =>
      api.patch<Application>(`/api/applications/${id}`, body),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: keys.applications });
      const prev = qc.getQueryData<Application[]>(keys.applications);
      if (prev && vars.status) {
        qc.setQueryData<Application[]>(
          keys.applications,
          prev.map((a) => (a.id === vars.id ? { ...a, status: vars.status as Application["status"] } : a)),
        );
      }
      return { prev };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(keys.applications, ctx.prev);
      toast.error(e.message);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.applications });
      qc.invalidateQueries({ queryKey: keys.dashboard });
    },
  });
}
