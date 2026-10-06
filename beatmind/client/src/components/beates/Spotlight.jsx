import { useEffect, useState } from 'react';

// Anneau néon autour de l'élément [data-beates="target"] pendant le tutoriel.
export default function Spotlight({ target }) {
  const [rect, setRect] = useState(null);
  useEffect(() => {
    if (!target) return undefined;
    let scrolled = false;
    const update = () => {
      const el = document.querySelector(`[data-beates="${target}"]`);
      if (!el) { setRect(null); return; }
      if (!scrolled) {
        scrolled = true;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      const r = el.getBoundingClientRect();
      setRect(r.width ? { top: r.top, left: r.left, width: r.width, height: r.height } : null);
    };
    update();
    const id = setInterval(update, 250);
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => { clearInterval(id); window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update); };
  }, [target]);
  if (!rect) return null;
  const pad = 8;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed z-[45] rounded-2xl border-2 border-neon-soft animate-beates-ring"
      style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }}
    />
  );
}
