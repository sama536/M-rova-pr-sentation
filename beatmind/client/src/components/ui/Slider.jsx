export default function Slider({ value, min = 0, max = 100, step = 1, onChange, vertical = false, className = '', ariaLabel }) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      aria-label={ariaLabel}
      className={`${vertical ? 'bm-range bm-fader' : 'bm-range'} ${className}`}
      style={{ '--fill': `${fill}%` }}
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}
