// Geometric composition in the azentio.com brand idiom: bold green bars, arcs and wedges on white.
export default function BrandArt({ className = "" }: { className?: string }) {
  const g = "#2ED88E";
  return (
    <svg viewBox="0 0 500 470" className={className} aria-hidden="true">
      <rect x="0" y="0" width="28" height="130" fill={g} />
      <rect x="58" y="0" width="28" height="130" fill={g} />
      <rect x="116" y="0" width="28" height="130" fill={g} />
      <path d="M190 0h120v28H218v74h92v28H190Z" fill={g} />
      <path d="M440 0a60 60 0 0 1 0 120V92a32 32 0 0 0 0-64Z" fill={g} />
      <path d="M0 158h70a62 62 0 0 1 0 124H0Z" fill={g} />
      <rect x="118" y="158" width="150" height="26" fill={g} />
      <rect x="118" y="214" width="110" height="26" fill={g} />
      <path d="M430 158h56l-50 124h-56Z" fill={g} />
      <path d="M0 470 54 316h30L30 470Z" fill={g} />
      <path d="M120 470V316h30v126h70v28Z" fill={g} />
      <circle cx="330" cy="400" r="70" fill="none" stroke={g} strokeWidth="28" />
      <path d="M430 316h28a42 42 0 0 1 0 84h-28Z" fill={g} />
      <rect x="430" y="420" width="70" height="50" fill={g} />
    </svg>
  );
}
