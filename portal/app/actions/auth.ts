"use server";
import { redirect } from "next/navigation";
import { requestCode, verifyCode, signOut, setActiveOrg, demoMode } from "@/lib/auth";
import { getViewer } from "@/lib/session";
import { email as emailField, str, InputError } from "@/lib/validate";

const back = (path: string, params: Record<string, string>) => redirect(`${path}?${new URLSearchParams(params)}`);

export async function requestCodeAction(f: FormData) {
  let email = "";
  let res: { code?: string; delivered: boolean };
  const from = String(f.get("from") ?? "/login") === "/judge" ? "/judge" : "/login";
  try {
    email = emailField(f);
    res = await requestCode(email);
  } catch (e) {
    return back(from, { error: e instanceof InputError || e instanceof Error ? e.message : "Could not send a code." });
  }
  const p: Record<string, string> = { email, step: "code" };
  const next = String(f.get("next") ?? "");
  if (next.startsWith("/") && !next.startsWith("//")) p.next = next;
  if (res.code && demoMode()) p.demo = res.code;
  if (!res.delivered && !res.code) p.error = "Email delivery is not configured on this deployment.";
  return back("/login", p);
}

export async function verifyCodeAction(f: FormData) {
  const email = String(f.get("email") ?? "").toLowerCase();
  try {
    const code = str(f, "code", 6, 6);
    await verifyCode(email, code);
  } catch (e) {
    return back("/login", { email, step: "code", error: e instanceof Error ? e.message : "Sign-in failed." });
  }
  const next = String(f.get("next") ?? "");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/portal");
}

export async function signOutAction() {
  await signOut();
  redirect("/");
}

export async function switchOrgAction(f: FormData) {
  const v = await getViewer();
  if (!v) redirect("/login");
  try {
    await setActiveOrg(v.id, String(f.get("org_id") ?? ""));
  } catch (e) {
    return back("/portal", { error: e instanceof Error ? e.message : "Could not switch workspace." });
  }
  redirect("/portal");
}
