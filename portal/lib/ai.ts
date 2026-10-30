// Minimal Anthropic-compatible Messages API client over fetch (Claude, DeepSeek, ...). Returns null when no key is configured or the
// call fails, so every caller has a deterministic fallback and the portal never depends on the model.
export const aiEnabled = () => !!process.env.ANTHROPIC_API_KEY;

const apiBase = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/+$/, "");

export async function ai(system: string, user: string, opts: { fast?: boolean; maxTokens?: number } = {}): Promise<string | null> {
  if (!aiEnabled()) return null;
  const model = opts.fast ? process.env.AI_FAST_MODEL || "claude-haiku-4-5-20251001" : process.env.AI_MODEL || "claude-sonnet-5";
  try {
    const r = await fetch(`${apiBase}/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: opts.maxTokens ?? 1200, system, messages: [{ role: "user", content: user }] }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!r.ok) {
      console.error("ai call failed", r.status, (await r.text()).slice(0, 300));
      return null;
    }
    const j = (await r.json()) as { content?: { type: string; text?: string }[] };
    return j.content?.filter((c) => c.type === "text").map((c) => c.text).join("") ?? null;
  } catch (e) {
    console.error("ai call error", e);
    return null;
  }
}

/** Extracts the first JSON object from a model reply. */
export function parseJson<T>(text: string | null): T | null {
  if (!text) return null;
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]) as T; } catch { return null; }
}
