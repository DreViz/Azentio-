import { Pool, PoolClient, types } from "pg";

// Return DATE columns as 'YYYY-MM-DD' strings. Converting to a JS Date would shift days across time zones.
types.setTypeParser(1082, (v: string) => v);

// One pool for the process. Connections authenticate as the schema owner.
const g = globalThis as unknown as { __pool?: Pool };
export const pool = g.__pool ?? new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
g.__pool = pool;

export type Ctx = { userId: string | null; orgId: string | null };
export type Q = <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;

function bind(c: PoolClient): Q {
  return async (sql, params) => (await c.query(sql, params as unknown[])).rows;
}

/**
 * Runs `fn` as the signed-in user. Inside the transaction the connection drops to the
 * restricted portal_app role, so Postgres row-level security decides what is visible.
 * This is the only path page and action code uses for user data.
 */
export async function asUser<T>(ctx: Ctx, fn: (q: Q) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("set local role portal_app");
    await c.query("select set_config('app.user_id', $1, true), set_config('app.org_id', $2, true)", [ctx.userId ?? "", ctx.orgId ?? ""]);
    const out = await fn(bind(c));
    await c.query("commit");
    return out;
  } catch (e) {
    await c.query("rollback").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

/** Owner path. Used only by sign-in/session code and seed scripts, never for user-requested data. */
export async function system<T>(fn: (q: Q) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("begin");
    const out = await fn(bind(c));
    await c.query("commit");
    return out;
  } catch (e) {
    await c.query("rollback").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

/** Turns a Postgres exception raised by a policy function into a message safe to show. */
export function dbMessage(e: unknown): string {
  const err = e as { message?: string; code?: string };
  if (err?.code === "42501") return "Not permitted.";
  if (err?.code === "23514") return "Some fields are missing or out of range.";
  if (err?.code === "P0001" && err.message) return err.message;
  return "Something went wrong. Please try again.";
}
