// Temps réel : les nouvelles offres, résumés et rappels arrivent sans recharger la page (SSE).
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export function useEvents(enabled: boolean) {
  const qc = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    if (!enabled || typeof EventSource === "undefined") return;
    const es = new EventSource("/api/events");

    es.addEventListener("new_offers", (ev) => {
      const data = JSON.parse((ev as MessageEvent).data) as { search_id: number; search_name: string; count: number; titles: string[] };
      qc.invalidateQueries({ queryKey: ["search-offers"] });
      qc.invalidateQueries({ queryKey: ["offers"] });
      qc.invalidateQueries({ queryKey: ["searches"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      const label = data.count > 1 ? `${data.count} nouvelles offres` : "1 nouvelle offre";
      toast(`${label} · ${data.search_name}`, {
        description: data.titles.join(" · "),
        duration: 9000,
        action: { label: "Voir", onClick: () => navigate(`/offres?recherche=${data.search_id}`) },
      });
      if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
        new Notification(`FormyWork : ${label}`, { body: data.titles.join("\n"), icon: "/favicon.svg" });
      }
    });

    es.addEventListener("summaries", () => {
      qc.invalidateQueries({ queryKey: ["search-offers"] });
      qc.invalidateQueries({ queryKey: ["offers"] });
      qc.invalidateQueries({ queryKey: ["offer"] });
    });

    es.addEventListener("sources", () => qc.invalidateQueries({ queryKey: ["sources"] }));
    es.addEventListener("expired", () => qc.invalidateQueries({ queryKey: ["offers"] }));

    es.addEventListener("reminder", (ev) => {
      const data = JSON.parse((ev as MessageEvent).data) as { title: string; company: string | null };
      toast.warning("Pensez à relancer", {
        description: `${data.title}${data.company ? ` · ${data.company}` : ""}`,
        duration: 12000,
        action: { label: "Candidatures", onClick: () => navigate("/candidatures") },
      });
    });

    return () => es.close();
  }, [enabled, qc, navigate]);
}
