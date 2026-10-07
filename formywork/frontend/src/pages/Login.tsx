import { useQueryClient } from "@tanstack/react-query";
import { Info } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "@/api/client";
import type { User } from "@/api/types";
import { Logo } from "@/components/Layout";
import { Button, Card, Field, Input } from "@/components/ui";
import { keys, useAuthStatus } from "@/hooks/data";

export default function LoginPage() {
  const status = useAuthStatus();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user =
        mode === "login"
          ? await api.post<User>("/api/auth/login", { email, password })
          : await api.post<User>("/api/auth/register", { email, password, display_name: name });
      qc.setQueryData(keys.me, user);
      navigate("/");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const demo = status.data?.demo_login;
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-sand/60 p-12 lg:flex lg:flex-col lg:justify-between">
        <Logo />
        <div className="max-w-md animate-fade-up">
          <h1 className="text-5xl leading-tight">
            Votre recherche d'emploi, <em className="not-italic underline decoration-accent decoration-[0.18em] underline-offset-[0.2em]">en toute sérénité.</em>
          </h1>
          <p className="mt-5 text-lg text-muted">
            Toutes les offres au même endroit, un CV lisible par les logiciels de recrutement et un suivi clair de vos candidatures.
          </p>
        </div>
        <p className="text-sm text-muted">Application privée · vos données restent sur votre ordinateur.</p>
        <div aria-hidden className="pointer-events-none absolute -right-24 top-1/3 h-80 w-80 rounded-full bg-accent/30 blur-3xl" />
      </section>

      <section className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-md animate-fade-up">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h2 className="text-3xl">{mode === "login" ? "Bienvenue" : "Créer mon compte"}</h2>
          <p className="mt-1 text-muted">
            {mode === "login" ? "Connectez-vous pour retrouver vos offres et vos CV." : "Trois comptes au maximum sur cette application."}
          </p>

          {demo && mode === "login" && (
            <Card className="mt-6 flex gap-3 border-accent/50 bg-accent/10">
              <Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              <div className="text-sm">
                <p className="font-medium">Mode démonstration</p>
                <p className="text-muted">
                  Essayez avec <strong className="text-ink">{demo.email}</strong> et le mot de passe <strong className="text-ink">{demo.password}</strong>.
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-2"
                  type="button"
                  onClick={() => {
                    setEmail(demo.email);
                    setPassword(demo.password);
                  }}
                >
                  Remplir pour moi
                </Button>
              </div>
            </Card>
          )}

          <form onSubmit={submit} className="mt-6 flex flex-col gap-4" noValidate>
            {mode === "register" && (
              <Field label="Votre prénom">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" required />}</Field>
            )}
            <Field label="Adresse e-mail">
              {(id) => <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />}
            </Field>
            <Field label="Mot de passe" hint={mode === "register" ? "Au moins 8 caractères." : undefined}>
              {(id) => (
                <Input
                  id={id}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  required
                />
              )}
            </Field>
            {error && (
              <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-danger">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" loading={busy}>
              {mode === "login" ? "Se connecter" : "Créer mon compte"}
            </Button>
          </form>

          {status.data && (mode === "register" || status.data.can_register) && (
            <p className="mt-6 text-center text-muted">
              {mode === "login" ? "Pas encore de compte ?" : "Déjà un compte ?"}{" "}
              <button className="font-medium text-ink underline decoration-accent-strong decoration-2 underline-offset-4" onClick={() => setMode(mode === "login" ? "register" : "login")}>
                {mode === "login" ? "Créer un compte" : "Se connecter"}
              </button>
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
