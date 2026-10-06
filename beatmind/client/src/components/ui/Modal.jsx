import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ open, onClose, title, children, width = 'max-w-lg' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/70 backdrop-blur-sm animate-rise" onMouseDown={onClose}>
      <div className={`panel-hi w-full ${width} max-h-[90vh] overflow-auto p-6`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display text-lg font-semibold">{title}</h3>
          <button type="button" onClick={onClose} className="text-mute hover:text-white" aria-label="Fermer"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
