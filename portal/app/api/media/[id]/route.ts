import fs from "node:fs/promises";
import path from "node:path";
import { getViewer, db } from "@/lib/session";

// Media lives outside /public. Every request, including a direct link, passes the audience policy.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const v = await getViewer();
  const [m] = await db(v, (q) => q<{ filename: string; mime: string }>("select filename, mime from media where id = $1", [id]));
  if (!m) return new Response("Not found", { status: 404 });
  const file = await fs.readFile(path.join(process.cwd(), "storage", path.basename(m.filename)));
  return new Response(file, {
    headers: {
      "content-type": m.mime,
      "cache-control": "private, no-store",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'",
      "x-content-type-options": "nosniff",
    },
  });
}
