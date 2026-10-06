export default function Chip({ active, onClick, children, title, className = '' }) {
  return (
    <button type="button" title={title} onClick={onClick} className={`${active ? 'chip-on' : 'chip-off'} ${className}`}>
      {children}
    </button>
  );
}
