import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { asUser, system, Q } from "./db";
import { sha256 } from "./crypto";

export const COOKIE = "azp_session";

export type Membership = { org_id: string; org_name: string; org_slug: string; kind: "azentio" | "client"; role: string };
export type Viewer = {
  id: string;
  email: string;
  name: string;
  memberships: Membership[];
  grants: string[];
  activeOrg: Membership | null;
  isEmployee: boolean;
};

/**
 * Resolves the session cookie to a viewer. The viewer drives navigation only;
 * every data read and write is still checked by Postgres policies through asUser().
 */
export async function getViewer(): Promise<Viewer | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  return system(async (q) => {
    const [s] = await q<{ user_id: string; active_org_id: string | null; email: string; display_name: string }>(
      `select s.user_id, s.active_org_id, u.email, u.display_name from sessions s join users u on u.id = s.user_id
        where s.token_hash = $1 and s.expires_at > now()`, [sha256(raw)]);
    if (!s) return null;
    const memberships = await q<Membership>(
      `select m.org_id, o.name org_name, o.slug org_slug, o.kind, m.role from memberships m join organisations o on o.id = m.org_id
        where m.user_id = $1 and m.status = 'active' order by o.kind, o.name`, [s.user_id]);
    const isEmployee = memberships.some((m) => m.kind === "azentio" && m.role === "employee");
    // grants only count for verified employees, mirroring has_grant() in the database
    const grants = isEmployee
      ? (await q<{ grant_name: string }>("select grant_name from grants where user_id = $1", [s.user_id])).map((r) => r.grant_name)
      : [];
    const activeOrg = memberships.find((m) => m.org_id === s.active_org_id) ?? memberships[0] ?? null;
    return { id: s.user_id, email: s.email, name: s.display_name, memberships, grants, activeOrg, isEmployee };
  });
}

export async function requireViewer(): Promise<Viewer> {
  const v = await getViewer();
  if (!v) redirect("/login");
  return v;
}

/** Runs a query block as this viewer (or anonymously) under row-level security. */
export function db<T>(v: Viewer | null, fn: (q: Q) => Promise<T>) {
  return asUser({ userId: v?.id ?? null, orgId: v?.activeOrg?.org_id ?? null }, fn);
}

export const can = (v: Viewer | null, g: string) => !!v?.grants.includes(g);
export const isClientMember = (v: Viewer | null) => !!v?.activeOrg && v.activeOrg.kind === "client";
