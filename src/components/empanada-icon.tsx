export function EmpanadaIcon({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <path d="M3 28C3 8 37 8 37 28Z" fill="#e0a35a" stroke="#8a4f1e" strokeWidth="2" strokeLinejoin="round" />
      <path d="M8 24C10 14 30 14 32 24" fill="none" stroke="#f5cf93" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M3 28H37" stroke="#8a4f1e" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M5 28.5v3.5M9.4 28.5v3.5M13.8 28.5v3.5M18.2 28.5v3.5M22.6 28.5v3.5M27 28.5v3.5M31.4 28.5v3.5M35 28.5v3"
        stroke="#8a4f1e"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="16" cy="18" r="1.2" fill="#8a4f1e" />
      <circle cx="24" cy="16.5" r="1.2" fill="#8a4f1e" />
    </svg>
  );
}
