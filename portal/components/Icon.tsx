// Line icons in the azentio.com manner: ink strokes with one mint accent stroke.
type Name = "bank" | "chart" | "shield" | "document" | "network" | "spark" | "bell" | "menu" | "arrow-right" | "arrow-left" | "lock" | "users" | "search" | "check" | "flask" | "layers";

const INK: Record<Name, string[]> = {
  bank: ["M4 9.5 12 4l8 5.5", "M7 11v6M12 11v6M17 11v6"],
  chart: ["M5 19v-5M9.5 19v-8M14 19v-6"],
  shield: ["M12 3.5 5 6v5.5c0 4.2 3 7.6 7 9 4-1.4 7-4.8 7-9V6l-7-2.5Z"],
  document: ["M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20V3.5Z", "M14 3.5V8h4"],
  network: ["M8.6 9.4 15.4 6.6M8.6 13.6l6.8 3.8"],
  spark: ["M12 4v4M12 16v4M4 12h4M16 12h4"],
  bell: ["M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2H4.5l1.5-2Z"],
  menu: ["M4 7h16M4 12h16M4 17h16"],
  "arrow-right": ["M5 12h14"],
  "arrow-left": ["M19 12H5"],
  lock: ["M6.5 10.5h11v9h-11z", "M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"],
  users: ["M3.5 19c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5", "M9 11.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"],
  search: ["M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z"],
  check: ["M5 12.5 10 17.5 19 7.5"],
  flask: ["M9.5 3.5h5M10.5 3.5v5.5L5.2 18.2A1.5 1.5 0 0 0 6.5 20.5h11a1.5 1.5 0 0 0 1.3-2.3L13.5 9V3.5"],
  layers: ["M12 4 3.5 8.5 12 13l8.5-4.5L12 4Z", "M3.5 12.5 12 17l8.5-4.5"],
};
const ACCENT: Partial<Record<Name, string[]>> = {
  bank: ["M4 20h16"],
  chart: ["M18.5 19V5"],
  shield: ["m8.8 12 2.3 2.3 4.2-4.6"],
  document: ["M9.5 13h5M9.5 16.5h5"],
  network: ["M6 14a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM18 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM18 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"],
  spark: ["M12 9.5 13 11l1.5 1-1.5 1-1 1.5-1-1.5-1.5-1 1.5-1 1-1.5Z"],
  bell: ["M10 20.5a2 2 0 0 0 4 0"],
  "arrow-right": ["m13 6 6 6-6 6"],
  "arrow-left": ["m11 6-6 6 6 6"],
  lock: ["M12 14v2.5"],
  users: ["M15.5 5.6a3 3 0 0 1 0 5.8M17 14.7c2 .4 3.2 1.9 3.6 4.3"],
  search: ["m15.5 15.5 4.5 4.5"],
  flask: ["M7.5 15h9"],
  layers: ["M3.5 16.5 12 21l8.5-4.5"],
};

export default function Icon({ name, className = "h-6 w-6", accent = true }: { name: Name; className?: string; accent?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {INK[name].map((d) => <path key={d} d={d} stroke="currentColor" />)}
      {(ACCENT[name] ?? []).map((d) => <path key={d} d={d} stroke={accent ? "#2ED88E" : "currentColor"} />)}
    </svg>
  );
}
