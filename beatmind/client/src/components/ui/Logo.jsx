// Logo BeatMind : le B néon (brand/logo.svg, copié dans client/public) + le nom.
export default function Logo({ size = 'md', withName = true }) {
  const h = size === 'lg' ? 'h-11 w-11' : 'h-8 w-8';
  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      <img src="/logo.svg" alt="" className={`${h} shrink-0 drop-shadow-[0_0_12px_rgba(139,92,246,.55)]`} />
      {withName && (
        <span className={`font-display font-extrabold tracking-tight ${size === 'lg' ? 'text-2xl' : 'text-[17px]'}`}>
          BEAT<span className="text-neon-soft">MIND</span>
        </span>
      )}
    </span>
  );
}
