import { create } from 'zustand';
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';

export const useToasts = create((set) => ({
  items: [],
  push(kind, text) {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ items: [...s.items, { id, kind, text }] }));
    setTimeout(() => set((s) => ({ items: s.items.filter((t) => t.id !== id) })), kind === 'error' ? 7000 : 4000);
  },
}));

export const toast = {
  success: (t) => useToasts.getState().push('success', t),
  error: (t) => useToasts.getState().push('error', t),
  info: (t) => useToasts.getState().push('info', t),
};

const ICONS = { success: CheckCircle2, error: AlertTriangle, info: Info };

export default function Toaster() {
  const items = useToasts((s) => s.items);
  return (
    <div className="fixed bottom-24 right-4 z-[60] grid gap-2 w-[min(380px,calc(100vw-2rem))]">
      {items.map((t) => {
        const Icon = ICONS[t.kind];
        return (
          <div key={t.id} className={`panel animate-rise flex items-start gap-3 px-4 py-3 text-sm ${t.kind === 'error' ? 'border-red-500/40' : 'border-neon/40'}`}>
            <Icon size={16} className={`mt-0.5 shrink-0 ${t.kind === 'error' ? 'text-red-400' : 'text-neon-soft'}`} />
            <span className="text-zinc-200">{t.text}</span>
          </div>
        );
      })}
    </div>
  );
}
