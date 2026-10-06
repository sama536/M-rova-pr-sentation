import Slider from './Slider.jsx';

// Un paramètre = un libellé, une explication courte en gris, un contrôle.
export default function Param({ label, hint, value, children, className = '' }) {
  return (
    <div className={`grid gap-1.5 ${className}`}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="label shrink-0">{label}</span>
          {hint && <span className="hint truncate">{hint}</span>}
        </div>
        {value !== undefined && <span className="num text-xs text-neon-glow shrink-0">{value}</span>}
      </div>
      {children}
    </div>
  );
}

export function SliderParam({ label, hint, value, min, max, step, unit = '', format, onChange }) {
  const shown = format ? format(value) : `${value > 0 && min < 0 ? '+' : ''}${value}${unit ? ` ${unit}` : ''}`;
  return (
    <Param label={label} hint={hint} value={shown}>
      <Slider value={value} min={min} max={max} step={step} onChange={onChange} ariaLabel={label} />
    </Param>
  );
}
