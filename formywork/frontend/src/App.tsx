import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { Toaster } from "sonner";

import { Layout, Logo } from "./components/Layout";
import { Spinner } from "./components/ui";
import { useMe } from "./hooks/data";
import { usePrefs } from "./hooks/prefs";
import { useEvents } from "./hooks/useEvents";
import ApplicationsPage from "./pages/Applications";
import DashboardPage from "./pages/Dashboard";
import LoginPage from "./pages/Login";
import OffersPage from "./pages/Offers";
import Onboarding from "./pages/Onboarding";
import ResumeEditorPage from "./pages/ResumeEditor";
import ResumesPage from "./pages/Resumes";
import SettingsPage from "./pages/Settings";

export default function App() {
  const { dark } = usePrefs();
  return (
    <>
      <Toaster
        position="top-right"
        theme={dark ? "dark" : "light"}
        toastOptions={{ className: "!rounded-2xl !border-line !bg-surface !text-ink !shadow-lift !font-sans !text-base" }}
        closeButton
      />
      <Routes>
        <Route path="/connexion" element={<LoginPage />} />
        <Route path="/*" element={<Protected />} />
      </Routes>
    </>
  );
}

function Protected() {
  const me = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  useEvents(!!me.data);

  useEffect(() => {
    const onUnauthorized = () => {
      qc.removeQueries({ queryKey: ["me"] });
      navigate("/connexion");
    };
    window.addEventListener("fw:unauthorized", onUnauthorized);
    return () => window.removeEventListener("fw:unauthorized", onUnauthorized);
  }, [qc, navigate]);

  if (me.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="flex flex-col items-center gap-5">
          <Logo />
          <Spinner label="Ouverture de FormyWork…" />
        </div>
      </div>
    );
  }
  if (me.isError || !me.data) return <Navigate to="/connexion" replace />;
  if (!me.data.onboarded) return <Onboarding user={me.data} />;

  return (
    <Layout user={me.data}>
      <Routes>
        <Route path="/" element={<DashboardPage user={me.data} />} />
        <Route path="/offres" element={<OffersPage />} />
        <Route path="/candidatures" element={<ApplicationsPage />} />
        <Route path="/cv" element={<ResumesPage />} />
        <Route path="/cv/:id" element={<ResumeEditorPage />} />
        <Route path="/reglages" element={<SettingsPage user={me.data} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
