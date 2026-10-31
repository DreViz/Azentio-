import { cookies } from "next/headers";
import nodemailer from "nodemailer";
import { system } from "./db";
import { sha256, sixDigits, token, sameHash } from "./crypto";
import { COOKIE } from "./session";

const CODE_TTL_MIN = 10;
const SESSION_DAYS = 7;
export const demoMode = () => process.env.DEMO_MODE === "true";

/** Errors whose message is safe and meant for the user; anything else is shown as a generic failure. */
export class AuthError extends Error {}

// Demo mode shows codes on screen only for the seeded judging personas and reserved .example addresses,
// which cannot receive real mail. A real mailbox can never be taken over through the demo flow.
const SEEDED = new Set(["priya@azentio.com", "maya@azentio.com", "pat@azentio.com", "omar@azentio.com", "ada@azentio.com"]);
export const demoEcho = (email: string) => demoMode() && (SEEDED.has(email) || /(\.example|@example\.(com|org|net))$/.test(email));

/**
 * Issues a single-use six-digit code. In demo mode the code is returned so the judging page
 * can display it; otherwise it is only emailed. No account is created until the code is verified.
 */
export async function requestCode(email: string): Promise<{ code?: string; delivered: boolean }> {
  const code = sixDigits();
  await system(async (q) => {
    await q("select pg_advisory_xact_lock(hashtext($1))", [email]); // serialise per email so parallel requests cannot pass the limit
    const [{ n }] = await q<{ n: number }>(
      "select count(*)::int n from login_codes where email = $1 and created_at > now() - interval '15 minutes'", [email]);
    if (n >= 5) throw new AuthError("Too many codes requested. Wait a few minutes and try again.");
    await q("insert into login_codes(email, code_hash, expires_at) values ($1, $2, now() + make_interval(mins => $3))",
      [email, sha256(`${email}:${code}`), CODE_TTL_MIN]);
  });
  if (process.env.SMTP_HOST) {
    const t = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587),
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await t.sendMail({
      from: process.env.SMTP_FROM, to: email, subject: "Your azentio.ai sign-in code",
      text: `Your sign-in code is ${code}. It expires in ${CODE_TTL_MIN} minutes and works once.`,
    });
    return { delivered: true, code: demoEcho(email) ? code : undefined };
  }
  return { delivered: false, code: demoEcho(email) ? code : undefined };
}

/** Verifies the code, creates the user record on first sign-in, and starts a session. */
export async function verifyCode(email: string, code: string): Promise<void> {
  const raw = token();
  // The failed-attempt counter must be committed, so a wrong code returns a status instead of
  // throwing inside the transaction (a throw would roll the increment back and disable the lockout).
  const outcome = await system(async (q) => {
    const [row] = await q<{ id: string; code_hash: string; attempts: number }>(
      `select id, code_hash, attempts from login_codes where email = $1 and used_at is null and expires_at > now()
        order by created_at desc limit 1 for update`, [email]);
    if (!row || row.attempts >= 5) return "expired" as const;
    if (!sameHash(row.code_hash, sha256(`${email}:${code}`))) {
      await q("update login_codes set attempts = attempts + 1 where id = $1", [row.id]);
      return "wrong" as const;
    }
    await q("update login_codes set used_at = now() where id = $1", [row.id]);
    // A verified email gets a user record, but no membership: access comes only from invitations or provisioning.
    const [u] = await q<{ id: string }>(
      `insert into users(email, display_name) values ($1, split_part($1, '@', 1))
       on conflict (email) do update set email = excluded.email returning id`, [email]);
    await q("insert into sessions(token_hash, user_id, expires_at) values ($1, $2, now() + make_interval(days => $3))",
      [sha256(raw), u.id, SESSION_DAYS]);
    await q("insert into audit_events(actor_id, action, entity, entity_id) values ($1::uuid, 'auth.signed_in', 'user', $1::text)", [u.id]);
    return "ok" as const;
  });
  if (outcome === "expired") throw new AuthError("The code has expired. Request a new one.");
  if (outcome === "wrong") throw new AuthError("That code is not correct.");
  (await cookies()).set(COOKIE, raw, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_DAYS * 86400,
  });
}

export async function signOut() {
  const c = await cookies();
  const raw = c.get(COOKIE)?.value;
  if (raw) await system((q) => q("delete from sessions where token_hash = $1", [sha256(raw)]));
  c.delete(COOKIE);
}

/** Switching workspace is validated against active membership before it is stored server-side. */
export async function setActiveOrg(userId: string, orgId: string) {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return;
  await system(async (q) => {
    const ok = await q("select 1 from memberships where user_id = $1 and org_id = $2 and status = 'active'", [userId, orgId]);
    if (!ok.length) throw new AuthError("You are not a member of that organisation.");
    await q("update sessions set active_org_id = $1 where token_hash = $2 and user_id = $3", [orgId, sha256(raw), userId]);
  });
}
