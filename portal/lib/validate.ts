// Server-side validation for form input (the client also enforces these via HTML attributes).
export class InputError extends Error {}

export function str(f: FormData, name: string, min = 1, max = 200): string {
  const v = String(f.get(name) ?? "").trim();
  if (v.length < min) throw new InputError(`${label(name)} is required${min > 1 ? ` (at least ${min} characters)` : ""}.`);
  if (v.length > max) throw new InputError(`${label(name)} must be at most ${max} characters.`);
  return v;
}
export function opt(f: FormData, name: string, max = 200): string | null {
  const v = String(f.get(name) ?? "").trim();
  if (v.length > max) throw new InputError(`${label(name)} must be at most ${max} characters.`);
  return v || null;
}
export function oneOf<T extends string>(f: FormData, name: string, allowed: readonly T[]): T {
  const v = String(f.get(name) ?? "") as T;
  if (!allowed.includes(v)) throw new InputError(`Choose a valid ${label(name)}.`);
  return v;
}
export function email(f: FormData, name = "email"): string {
  const v = str(f, name, 5, 200).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new InputError("Enter a valid email address.");
  return v;
}
export function date(f: FormData, name: string): string {
  const v = str(f, name, 10, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(Date.parse(v))) throw new InputError(`${label(name)} must be a date.`);
  return v;
}
export const uuid = (v: unknown) => {
  const s = String(v ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(s)) throw new InputError("Invalid reference.");
  return s;
};
const label = (n: string) => n.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

/** Only same-site paths survive; "/\\evil.com", "//evil.com" and tab tricks resolve off-site and are dropped. */
export function safeNext(next: string): string | null {
  if (!next.startsWith("/")) return null;
  try {
    const u = new URL(next, "http://local.invalid");
    return u.origin === "http://local.invalid" ? u.pathname + u.search : null;
  } catch {
    return null;
  }
}
