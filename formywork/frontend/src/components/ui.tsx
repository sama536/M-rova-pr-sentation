// Composants d'interface de base, accessibles (Radix pour les dialogues et interrupteurs).
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import clsx from "clsx";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { forwardRef, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

export const cx = clsx;

// ------------------------------------------------------------------ bouton
type Variant = "primary" | "accent" | "secondary" | "ghost" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary/90 shadow-soft",
  accent: "bg-accent text-on-accent hover:bg-accent-strong shadow-soft",
  secondary: "bg-surface text-ink border border-line hover:border-ink/30 hover:bg-sand/50",
  ghost: "text-ink hover:bg-sand/70",
  danger: "bg-surface text-danger border border-danger/40 hover:bg-danger/10",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, icon, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-[background,box-shadow,transform,border-color] duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55",
        size === "sm" && "min-h-9 px-3 text-sm",
        size === "md" && "min-h-11 px-4",
        size === "lg" && "min-h-12 px-6 text-lg",
        variants[variant],
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

// ------------------------------------------------------------------ cartes, badges
export function Card({ className, children, as: As = "div", ...props }: { className?: string; children: ReactNode; as?: "div" | "section" | "article" } & Record<string, unknown>) {
  return (
    <As className={cx("rounded-2xl border border-line/80 bg-surface p-5 shadow-soft", className)} {...props}>
      {children}
    </As>
  );
}

type Tone = "neutral" | "accent" | "new" | "success" | "danger" | "info" | "warning";
const tones: Record<Tone, string> = {
  neutral: "bg-sand text-ink",
  accent: "bg-accent/25 text-ink",
  new: "bg-accent text-on-accent font-semibold",
  success: "bg-success/15 text-success",
  danger: "bg-danger/10 text-danger",
  info: "bg-info/10 text-info",
  warning: "bg-warning/15 text-warning",
};

export function Badge({ tone = "neutral", children, className, icon }: { tone?: Tone; children: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.8rem] leading-6", tones[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

// ------------------------------------------------------------------ champs de formulaire
export function Field({ label, hint, error, children, id }: { label: string; hint?: string; error?: string; children: (id: string) => ReactNode; id?: string }) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children(fieldId)}
      {hint && !error && <p className="text-sm text-muted">{hint}</p>}
      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

const inputBase =
  "w-full rounded-xl border border-line bg-surface px-3.5 text-ink placeholder:text-muted/70 transition-colors hover:border-ink/30 focus:border-accent-strong focus:outline-none focus:ring-4 focus:ring-accent/25";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cx(inputBase, "min-h-11", className)} {...p} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} className={cx(inputBase, "py-2.5 leading-relaxed", className)} {...p} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...p }, ref) {
  return <select ref={ref} className={cx(inputBase, "min-h-11 cursor-pointer pr-8", className)} {...p} />;
});

export function Switch({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={id} className="font-medium">
          {label}
        </label>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      <SwitchPrimitive.Root
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        className="relative mt-1 h-7 w-12 shrink-0 rounded-full bg-line transition-colors data-[state=checked]:bg-accent-strong"
      >
        <SwitchPrimitive.Thumb className="block h-6 w-6 translate-x-0.5 rounded-full bg-surface shadow transition-transform data-[state=checked]:translate-x-[1.375rem]" />
      </SwitchPrimitive.Root>
    </div>
  );
}

// ------------------------------------------------------------------ états
export function Spinner({ label = "Chargement…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-muted" role="status">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse-soft rounded-xl bg-sand", className)} aria-hidden />;
}

export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line px-6 py-12 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-sand text-ink">{icon}</div>
      <h3 className="text-xl">{title}</h3>
      {children && <div className="max-w-md text-muted">{children}</div>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-2xl border border-danger/30 bg-danger/5 p-5">
      <div className="flex items-center gap-2 font-medium text-danger">
        <AlertTriangle className="h-5 w-5" aria-hidden /> Un problème est survenu
      </div>
      <p className="text-ink">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Réessayer
        </Button>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ score circulaire
export function ScoreRing({ score, size = 112, label = "Score ATS" }: { score: number; size?: number; label?: string }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const tone = score >= 75 ? "rgb(var(--success))" : score >= 50 ? "rgb(var(--accent-strong))" : "rgb(var(--danger))";
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }} role="img" aria-label={`${label} : ${score} sur 100`}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgb(var(--sand))" strokeWidth="9" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          style={{ transition: "stroke-dashoffset 700ms cubic-bezier(.2,.7,.2,1)" }}
        />
      </svg>
      <div className="absolute text-center leading-none">
        <span className="tabular font-display text-[1.9em] font-semibold">{score}</span>
        <span className="block text-[0.7em] text-muted">/ 100</span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ dialogue
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-[#0b1426]/45 backdrop-blur-[2px] data-[state=open]:animate-fade-up" />
        <DialogPrimitive.Content
          className={cx(
            "fixed inset-x-0 bottom-0 z-50 max-h-[92vh] overflow-y-auto rounded-t-3xl border border-line bg-bg p-5 shadow-lift scroll-thin sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[calc(100%-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:p-7",
            wide ? "sm:max-w-3xl" : "sm:max-w-lg",
          )}
          aria-describedby={description ? undefined : undefined}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <DialogPrimitive.Title className="font-display text-2xl">{title}</DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-1 text-muted">{description}</DialogPrimitive.Description>
              ) : (
                <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close className="rounded-xl p-2 text-muted hover:bg-sand hover:text-ink" aria-label="Fermer">
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-3xl sm:text-[2.1rem]">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
