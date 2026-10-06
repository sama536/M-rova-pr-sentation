export default function SectionHeader({ index, title, hint, right }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-4">
      <div>
        <div className="flex items-center gap-3">
          {index && <span className="num text-[11px] text-neon-soft border border-neon/40 rounded-md px-1.5 py-0.5">{index}</span>}
          <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
        </div>
        {hint && <p className="hint mt-1.5 max-w-2xl">{hint}</p>}
      </div>
      {right}
    </div>
  );
}
